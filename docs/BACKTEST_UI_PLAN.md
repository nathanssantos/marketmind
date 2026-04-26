# Backtest UI — implementation plan

Self-contained brief for a fresh chat. Reads CLAUDE.md, this doc, and the cited files; ships the feature.

## Context

The backtesting engine and CLI are mature (`apps/backend/src/services/backtesting/`, `apps/backend/src/cli/commands/`). Two tRPC routers expose it (`apps/backend/src/routers/backtest/{simple,multi}.ts`), each as a synchronous `mutation` that runs the engine in-process and caches the result in a `Map` (keyed by generated id). **Zero frontend UI exists today** — `git grep -l 'useBacktest\|BacktestModal\|BacktestDialog'` returns nothing under `apps/electron/src/renderer/components`.

Goal: ship a single modal that exposes every backtest knob the CLI/router can take, runs the engine via tRPC, streams progress over the existing socket bus with an honest ETA, renders the result in-modal, and is fully covered by unit + browser + Playwright e2e tests. The CLI keeps working unchanged. The button to open the modal sits next to the screener trigger in the main toolbar.

## Strategy

Single long-lived branch `feat/backtest-modal` cut from `develop`. **One PR per wave** so review/revert stays granular (this is the cadence that worked for the chart-perf overhaul: `chore/chart-perf-overhaul-N` → squash-merge to develop → next wave). Each wave's PR runs the full verification gauntlet plus its own targeted tests.

Cadence reminder: the previous chats merged with `gh pr merge <N> --admin --squash --delete-branch`. CI must be green; if `Lint & Type Check` regresses, fix before merging — do not bypass via `--no-verify`. **Kill any lingering vite server on `:5173`** before running e2e tests (`lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null`) — Playwright's `reuseExistingServer: !process.env.CI` would otherwise reuse a server without `VITE_E2E_BYPASS_AUTH=true`, and `installE2EBridge()` early-returns silently, breaking every test that touches `window.__indicatorStore` / `__drawingStore` / `__priceStore` / `__queryClient`. This is a real footgun documented in the chart-perf history.

Order: **schema → progress channel → modal shell → form → run/results path → progress UI with ETA → polish**. Each wave self-verifies; the final wave proves the loop works end-to-end via Playwright with the socket bridge.

---

### Wave 0 — Shared Zod schema + tRPC alignment (1 PR)

The CLI commands and the existing `backtest.simple.run` / `backtest.multiWatcher` routers each redefine input shape from scratch (CLI uses argv parsing, tRPC uses inline Zod). The modal will be a third client — without a shared schema, drift is inevitable.

- Create `packages/types/src/backtesting/backtestInput.ts`. Define one Zod schema: `simpleBacktestInputSchema`. It must be the union of every knob accepted by the existing router input at `apps/backend/src/routers/backtest/simple.ts` (currently lines 14–60: symbol, interval, dates, capital, position sizing, all 19 filter toggles + their sub-params, Fibonacci config, leverage, cooldown, direction mode, futures-specific). The exhaustive filter list lives in `apps/backend/src/utils/filters/filter-registry.ts` lines 42–243 — every entry there must have a matching Zod field in the schema.
- Export `type SimpleBacktestInput = z.infer<typeof simpleBacktestInputSchema>` and re-export from `packages/types/src/index.ts`.
- Refactor `simple.ts` to consume the shared schema instead of inlining. Same for `multi.ts` if the overlap is meaningful (it is — most knobs are shared; create `multiWatcherBacktestInputSchema = simpleBacktestInputSchema.extend({ watchers: z.array(...) })`).
- Strategy taxonomy: derive `STRATEGY_IDS` from a const-asserted array (the file list under `apps/backend/strategies/builtin/`). The 13 production-ready strategies in `apps/backend/src/constants/index.ts` `DEFAULT_ENABLED_SETUPS` are pre-checked; the rest are togglable. Expose `listStrategies` as a publicProcedure tRPC query that returns `{ id, name, description, isDefault }[]` so the modal doesn't ship a hard-coded list.
- Filter taxonomy: derive `FILTER_DEFINITIONS` (id, label key, kind: 'toggle'|'number'|'enum', default, min/max/step) once in `packages/types/src/backtesting/filterDefinitions.ts`. Both the modal's render loop AND any future CLI help-dump can read from this. Source of truth: `filter-registry.ts`. **No magic numbers** — every default goes into the const, with a doc string referencing the engine line that consumes it.

Verification:
- `pnpm --filter @marketmind/backend type-check` — clean
- `pnpm --filter @marketmind/backend test` — 5,352+ pass; the `simple.router.test.ts` and any related contract tests (`apps/backend/src/__tests__/routers/backtest.router.test.ts` if it exists, else add) cover the new schema
- `pnpm --filter @marketmind/types build` — clean

Files: `packages/types/src/backtesting/backtestInput.ts` (NEW), `packages/types/src/backtesting/filterDefinitions.ts` (NEW), `packages/types/src/index.ts`, `apps/backend/src/routers/backtest/simple.ts`, `apps/backend/src/routers/backtest/multi.ts`.

### Wave 1 — Progress channel via socketBus (1 PR)

The engine currently emits no progress. The optimizer has an `onProgress(current, total)` callback (`BacktestOptimizer.ts`), but the single-run engines log to console only. We need a stream the modal can read.

- Add `backtest:progress` and `backtest:complete` to `packages/types/src/socket-events.ts` ServerToClientEvents. Payload shapes:
  - `backtest:progress` — `{ backtestId: string; phase: 'fetchingKlines' | 'detectingSetups' | 'simulating' | 'computingMetrics'; processed: number; total: number; etaMs: number | null; startedAt: number }`
  - `backtest:complete` — `{ backtestId: string; resultId: string; durationMs: number }`
  - `backtest:failed` — `{ backtestId: string; error: string }`
- Add a thin `BacktestProgressReporter` class in `apps/backend/src/services/backtesting/BacktestProgressReporter.ts`. Constructor takes `{ backtestId, io, totalSteps }`. Methods: `setPhase(phase, total)`, `tick(processed)`, `complete(resultId)`, `fail(error)`. Internally tracks `startedAt` and computes ETA as `(elapsed / processed) * (total - processed)` — clamped to `null` until at least 5% of steps have run (otherwise the estimate is useless noise).
- Thread an optional reporter through `BacktestEngine.run` and `MultiWatcherBacktestEngine.run`. Three pulse points: after kline fetch (phase=fetchingKlines, total=1, processed=1), inside the kline simulation loop (phase=simulating, processed=i, total=klines.length, throttle to one tick per 5% of progress so we don't flood the socket), at metrics-computation start (phase=computingMetrics, total=1).
- The simple/multi tRPC mutations now mint a backtestId before invoking the engine, return that id immediately to the caller, and run the engine on a fire-and-forget Promise. The mutation's response shape becomes `{ backtestId: string }` — the actual result is fetched via the existing `getResult({id})` query once the client receives `backtest:complete`.
- Backend test: `apps/backend/src/__tests__/services/backtesting/BacktestProgressReporter.test.ts` covers ETA math under the 5% floor, throttling, terminal events.

Verification:
- Backend tests cover the reporter unit-test
- A new contract test in `apps/backend/src/__tests__/routers/backtest.router.test.ts` asserts the mutation now returns `{ backtestId }` (not the full result) and that subsequent `getResult` returns the cached entry once the run finishes
- Socket events typed end-to-end (no `any` in the dispatcher)

Files: `packages/types/src/socket-events.ts`, `apps/backend/src/services/backtesting/BacktestProgressReporter.ts` (NEW), `apps/backend/src/services/backtesting/BacktestEngine.ts`, `apps/backend/src/services/backtesting/MultiWatcherBacktestEngine.ts`, `apps/backend/src/routers/backtest/simple.ts`, `apps/backend/src/routers/backtest/multi.ts`, `apps/backend/src/__tests__/services/backtesting/BacktestProgressReporter.test.ts` (NEW).

### Wave 2 — Modal shell + toolbar trigger (1 PR)

Open/close machinery + the new toolbar button. Zero behaviour beyond rendering an empty modal yet.

- New store `apps/electron/src/renderer/store/backtestModalStore.ts` (zustand). Same shape as `useScreenerStore` (which the toolbar references at `apps/electron/src/renderer/components/Layout/Toolbar.tsx:129-132`): `{ isBacktestOpen: boolean; openBacktest: () => void; closeBacktest: () => void; toggleBacktest: () => void }`. Use `subscribeWithSelector` middleware so future imperative subscribers don't pay the broad-wake cost (per Wave 2 of the chart-perf overhaul).
- Toolbar button: edit `apps/electron/src/renderer/components/Layout/Toolbar.tsx`. After the screener block at lines 233–242 (the `<TooltipWrapper label={t('screener.title')}>` + `<ToggleIconButton>` with `<LuScanLine />`), add the same shape with `LuPlay` (or `LuFlaskConical`) icon and `t('backtest.title')` label. Wire to the new store's `toggleBacktest`. Place it visually next to the screener — the user's reference screenshot shows the cluster: external-link, activity, book-open, scan-line (screener), and the new button slots in immediately after.
- New component: `apps/electron/src/renderer/components/Backtest/BacktestModal.tsx`. Use the existing `FormDialog` primitive (`apps/electron/src/renderer/components/ui/FormDialog.tsx`). For now: title `t('backtest.title')`, body says "coming soon", footer hidden. `size="lg"`, `contentMaxH="80vh"`. **Components only from `@renderer/components/ui`** per CLAUDE.md.
- Mount the modal once in `apps/electron/src/renderer/components/Layout/MainLayout.tsx` (or wherever the screener modal mounts — search for `<ScreenerModal` and put it adjacent).
- i18n: add `backtest.title`, `backtest.openTooltip` to all 4 locales (`apps/electron/src/renderer/locales/{en,pt,es,fr}/translation.json`). Keep keys hierarchical under `backtest.*` so future waves slot in cleanly.

Verification:
- `pnpm --filter @marketmind/electron type-check` — clean
- `pnpm --filter @marketmind/electron lint` — 0 errors
- New unit test `apps/electron/src/renderer/components/Backtest/BacktestModal.test.tsx`: open/close behaviour, title rendered. Use `renderWithChakra` helper (find existing example in `apps/electron/src/renderer/components/ui/FormDialog.test.tsx`).
- New e2e spec `apps/electron/e2e/backtest-modal-open.spec.ts`: click toolbar button → dialog visible → click close → dialog hidden. Pre-step: `await waitForE2EBridge(page)`. **Sanity check first**: `lsof -nP -iTCP:5173 -sTCP:LISTEN` returns nothing before running.

Files: `apps/electron/src/renderer/store/backtestModalStore.ts` (NEW), `apps/electron/src/renderer/components/Backtest/BacktestModal.tsx` (NEW), `apps/electron/src/renderer/components/Backtest/index.ts` (NEW barrel), `apps/electron/src/renderer/components/Layout/Toolbar.tsx`, `apps/electron/src/renderer/components/Layout/MainLayout.tsx`, `apps/electron/src/renderer/locales/{en,pt,es,fr}/translation.json`, `apps/electron/src/renderer/components/Backtest/BacktestModal.test.tsx` (NEW), `apps/electron/e2e/backtest-modal-open.spec.ts` (NEW).

### Wave 3 — Form (every knob, organized) (1 PR)

Render the full input surface inside the modal. **Don't run the backtest yet** — the submit button can be disabled or no-op. Goal: every option from the shared Zod schema is reachable, validated, and i18n-ready.

- Internal layout: `Tabs.Root` (4 tabs) inside the FormDialog body. Tabs:
  1. **Basic** — symbol, marketType (SPOT/FUTURES Select), interval Select, startDate + endDate (HTML `<input type="date">` wrapped in `Field`), initialCapital NumberInput, leverage NumberInput (only when marketType=FUTURES — conditional render).
  2. **Strategies** — checkbox grid driven by `trpc.backtest.listStrategies.useQuery()` from Wave 0. Pre-select the 13 in `DEFAULT_ENABLED_SETUPS`. Use the bulk-select pattern from `apps/electron/src/renderer/components/Trading/BulkSymbolSelector.tsx` (Select All / Deselect All buttons + `string[]` state). Selection drives `setupTypes` field of the schema.
  3. **Filters** — render `FILTER_DEFINITIONS` from Wave 0. Each toggle as `Switch`; numeric sub-params as `NumberInput` revealed only when the parent toggle is on (e.g., `useChoppinessFilter` → reveals `choppinessThresholdHigh/Low/Period`). Group with `CollapsibleSection`s by family: trend (trend/EMA, MTF, regime, supertrend, BTC correlation), momentum (stochastic family, momentum-timing, ADX), volume (volume, funding, VWAP, FVG), volatility (Bollinger squeeze, choppiness), session, confluence.
  4. **Risk** — slippage, commission, positionSizePercent, minRiskRewardRatio (long/short split), stop-loss/take-profit percent, partial exits config, trailing-stop config, futures funding/liquidation toggles, fibonacci config (tpCalculationMode, fibonacciTargetLevel{Long,Short}, maxFibonacciEntryProgressPercent{Long,Short}).
- State: single `useState<SimpleBacktestInput>` populated from `simpleBacktestInputSchema.parse({})` (defaults from the schema; if the schema's `.default()` chain isn't enough, expose a `getDefaultBacktestInput()` factory in `packages/types/src/backtesting/backtestInput.ts`). All form changes go through a single `setField('symbol', value)` helper to keep diffs tiny — the form is too big for prop drilling.
- Validation: parse with `simpleBacktestInputSchema.safeParse(state)` on each change. Surface field-level errors via `Field`'s `invalid` + `errorText` props (per `apps/electron/src/renderer/components/Trading/CreateWalletDialog.tsx` pattern). Submit button disabled when `!result.success`.
- **`Select` inside `Dialog` requires `usePortal={false}`** — Chakra's DialogPositioner intercepts portal clicks. This is an existing memory item; missing it will silently break every dropdown in the modal.
- Tests:
  - Unit: `BacktestModal.form.test.tsx` covers each tab renders, default values populated from schema, conditional fields appear/disappear (leverage only when futures, sub-params only when toggle on), submit disabled with empty symbol, errorText shows for invalid date range.
  - e2e: `backtest-modal-form.spec.ts` opens modal, switches tabs, fills the form, asserts submit button enables/disables.

Files: `apps/electron/src/renderer/components/Backtest/BacktestModal.tsx` (extended), `apps/electron/src/renderer/components/Backtest/tabs/{BasicTab,StrategiesTab,FiltersTab,RiskTab}.tsx` (NEW — keep each tab a focused file), `apps/electron/src/renderer/components/Backtest/BacktestForm.test.tsx` (NEW), `apps/electron/e2e/backtest-modal-form.spec.ts` (NEW), translations updated.

### Wave 4 — Run + results path (1 PR)

Wire submit → tRPC → polling/socket → display result.

- New hook `apps/electron/src/renderer/hooks/useBacktestRun.ts`. Owns the tRPC mutation (`trpc.backtest.simple.run.useMutation()`), tracks `backtestId | null`, subscribes to `backtest:progress` / `backtest:complete` / `backtest:failed` via `useSocketEvent`. Exposes `{ start(input), status: 'idle' | 'running' | 'success' | 'failed', progress: ProgressState | null, result: BacktestResult | null, error: string | null, reset() }`. `useSocketEvent` pattern is at `apps/electron/src/renderer/hooks/socket/useSocketEvent.ts` — handlers run via ref so React re-renders are bounded.
- On `backtest:complete` payload's `resultId`, the hook fires `trpc.backtest.simple.getResult.useQuery({ id: resultId })` and exposes the data through `result`. Cancellation: `reset()` stops listening but the backend run continues to completion (acceptable for v1; flag a future cancellation API as "out of scope").
- Modal body switches on hook status: `idle` → form, `running` → progress UI (Wave 5), `success` → results panel (read-only summary: trades count, total PnL, win rate, max drawdown, Sharpe, equity curve mini-chart if cheap, "View full report" link to a future detail page). `failed` → error toast + back to form.
- Results panel: stay minimal in this wave — `Stat` primitives from `ui/`, no new chart yet. The detailed equity-curve viz is a follow-up. Add a "Run another" button that calls `reset()`.
- Unit + e2e tests cover: submit disabled until valid → submit fires mutation → modal switches to "running" → simulated `backtest:complete` → results render → "Run another" returns to form. The progress UI itself isn't exercised here (Wave 5).

Files: `apps/electron/src/renderer/hooks/useBacktestRun.ts` (NEW), `apps/electron/src/renderer/hooks/__tests__/useBacktestRun.test.ts` (NEW), `apps/electron/src/renderer/components/Backtest/BacktestResults.tsx` (NEW), `apps/electron/src/renderer/components/Backtest/BacktestModal.tsx` (status switch), `apps/electron/e2e/backtest-modal-run.spec.ts` (NEW), `apps/electron/e2e/helpers/trpcMock.ts` (extend with `backtest.simple.run` and `backtest.simple.getResult` overrides — see `apps/electron/e2e/specs/wallet-management.spec.ts` for the override pattern).

### Wave 5 — Progress UI + ETA (1 PR)

The visible centerpiece. Make the bar honest.

- New component `apps/electron/src/renderer/components/Backtest/BacktestProgress.tsx`. Uses `Progress` primitive (`apps/electron/src/renderer/components/ui/progress.tsx`) for the bar; never goes backwards (clamp `displayedProgress = Math.max(prev, current)` in a ref so a late socket message can't ungird the bar).
- Visible elements: progress bar, current phase label (i18n keys `backtest.progress.phase.{fetchingKlines,detectingSetups,simulating,computingMetrics}`), elapsed time, ETA text. ETA formatting: `< 60s` → "~Xs remaining"; `< 60m` → "~Xm Ys remaining"; otherwise "~Hh Mm remaining". When `etaMs` is `null` (early in the run) show "calculating ETA…" — never show "0s" or "Infinity".
- Smoothing: backend throttles to ~one progress event per 5% of work, so per-second smoothing happens client-side via a simple Kalman-like filter on `etaMs`: `displayedEta = displayedEta * 0.7 + nextEta * 0.3`. Refresh "elapsed" once per second via `setInterval` while status === 'running'.
- Cancel button: present but soft — calls `reset()` on the hook (stops listening). Backend continues; that's fine.
- Browser test (`apps/electron/src/renderer/components/Backtest/BacktestProgress.browser.test.tsx`): construct the component with controlled props, advance time via `vi.useFakeTimers`, assert the bar width / ARIA `valuenow` updates correctly. The browser environment is needed because the Progress primitive uses real CSS layout; jsdom can't measure it (per the chart-perf playbook).
- e2e (`apps/electron/e2e/backtest-modal-progress.spec.ts`): start a run, emit a sequence of `backtest:progress` events via `emitSocketEvent` (helper at `apps/electron/e2e/helpers/socketBridge.ts` — pattern from `apps/electron/e2e/stream-health.spec.ts:44-56`), assert the bar advances and ETA text appears, finally emit `backtest:complete` and assert results panel renders.

Files: `apps/electron/src/renderer/components/Backtest/BacktestProgress.tsx` (NEW), `apps/electron/src/renderer/components/Backtest/BacktestProgress.browser.test.tsx` (NEW), `apps/electron/e2e/backtest-modal-progress.spec.ts` (NEW), translations updated.

### Wave 6 — Polish (1 PR, smallest)

Cleanup + the reachability checks that make the feature "done".

- Recent runs list: tRPC already has `backtest.simple.list` — surface the last N runs in a small `Tabs` panel inside the modal ("Run new" / "Recent"). Each item shows symbol, interval, finalEquity, button to "Re-run with these params" (loads the cached input back into the form).
- Keyboard shortcut: `Cmd/Ctrl+Shift+B` opens the modal. Wire via the existing pattern in `apps/electron/src/renderer/hooks/useTradingShortcuts.ts` (or wherever shortcuts are registered).
- Telemetry: tag `perfMonitor.recordComponentRender('BacktestModal')` when the modal mounts so future regressions show in `chart.perf` overlay. Cheap and the convention is already established.
- README/docs: add a one-paragraph section to `docs/CLAUDE.md`-adjacent docs ("Backtest UI" → "Open via toolbar play icon, or `Cmd+Shift+B`. Same engine as the CLI; results cached server-side for 1h.").
- Final e2e smoke: a single spec `apps/electron/e2e/backtest-modal-full-loop.spec.ts` exercises the entire happy path (open → fill → run → progress → result → re-run with previous params → close).

Files: `apps/electron/src/renderer/components/Backtest/RecentRunsTab.tsx` (NEW), `apps/electron/src/renderer/hooks/useTradingShortcuts.ts` (extend), translations updated, `apps/electron/e2e/backtest-modal-full-loop.spec.ts` (NEW).

---

## Critical files (consolidated)

**Backend (waves 0, 1):**
- `apps/backend/src/routers/backtest/simple.ts` (lines 14–60 = current input schema; the source of truth to replicate in the shared schema)
- `apps/backend/src/routers/backtest/multi.ts`
- `apps/backend/src/routers/backtest/results.ts`
- `apps/backend/src/services/backtesting/BacktestEngine.ts` (engine entry, will accept reporter)
- `apps/backend/src/services/backtesting/MultiWatcherBacktestEngine.ts`
- `apps/backend/src/services/backtesting/BacktestOptimizer.ts` (existing `onProgress` callback — use the pattern)
- `apps/backend/src/utils/filters/filter-registry.ts` (filter taxonomy)
- `apps/backend/src/constants/index.ts` (`DEFAULT_ENABLED_SETUPS`)
- `apps/backend/strategies/builtin/` (strategy ids — directory listing)

**Types package (wave 0):**
- `packages/types/src/backtesting/backtestInput.ts` (NEW)
- `packages/types/src/backtesting/filterDefinitions.ts` (NEW)
- `packages/types/src/socket-events.ts` (extended in wave 1)
- `packages/types/src/index.ts` (re-exports)

**Frontend (waves 2–6):**
- `apps/electron/src/renderer/components/Layout/Toolbar.tsx` (lines 233–242 — clone the screener button block)
- `apps/electron/src/renderer/components/Layout/MainLayout.tsx` (mount point)
- `apps/electron/src/renderer/store/backtestModalStore.ts` (NEW — clone `screenerStore.ts` shape)
- `apps/electron/src/renderer/store/screenerStore.ts` (reference)
- `apps/electron/src/renderer/components/Screener/ScreenerModal.tsx` (reference for modal+tabs pattern)
- `apps/electron/src/renderer/components/Backtest/{BacktestModal,BacktestForm,BacktestResults,BacktestProgress,RecentRunsTab}.tsx` (NEW)
- `apps/electron/src/renderer/components/Backtest/tabs/{BasicTab,StrategiesTab,FiltersTab,RiskTab}.tsx` (NEW)
- `apps/electron/src/renderer/hooks/useBacktestRun.ts` (NEW)
- `apps/electron/src/renderer/hooks/socket/useSocketEvent.ts` (existing — pattern)
- `apps/electron/src/renderer/components/ui/FormDialog.tsx` (existing primitive)
- `apps/electron/src/renderer/components/ui/progress.tsx` (existing primitive — extend if indeterminate mode is needed)
- `apps/electron/src/renderer/components/ui/CollapsibleSection.tsx` (existing primitive)
- `apps/electron/src/renderer/components/Trading/CreateWalletDialog.tsx` (reference: form validation pattern)
- `apps/electron/src/renderer/components/Trading/BulkSymbolSelector.tsx` (reference: array multi-select pattern)
- `apps/electron/src/renderer/components/Settings/SettingsDialog.tsx` (reference: modal + tabs)
- `apps/electron/src/renderer/locales/{en,pt,es,fr}/translation.json`

**Tests:**
- `apps/electron/e2e/helpers/trpcMock.ts` (extend per wave 4)
- `apps/electron/e2e/helpers/socketBridge.ts` (use `emitSocketEvent` per wave 5)
- `apps/electron/e2e/helpers/chartTestSetup.ts` (`waitForE2EBridge` pattern)
- `apps/electron/e2e/stream-health.spec.ts` (closest reference for "open modal → emit progressive socket events → assert UI updates")
- `apps/electron/e2e/specs/wallet-management.spec.ts` (closest reference for "open modal → fill form → submit → assert tRPC called")

## Verification gauntlet (run on every wave PR)

```bash
pnpm --filter @marketmind/types build
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint            # 0 errors required, warning count must not regress
pnpm --filter @marketmind/backend lint
pnpm --filter @marketmind/backend test             # current floor: 5,352 passing
pnpm --filter @marketmind/electron test:unit       # current floor: 1,782 passing
pnpm --filter @marketmind/electron test:browser    # current floor: 97 passing
pnpm --filter @marketmind/electron test:perf       # current floor: 18 passing — must not regress baseline.json
```

**Pre-e2e on local**: `lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null; true` (kill any stale vite dev server so Playwright spawns its own with `VITE_E2E_BYPASS_AUTH=true`).

Per-wave green rule: type-check clean, lint clean, all suites passing, **no new perf regression** (chart.perf overlay's `ChartCanvas#<symbol>@<timeframe>` rate must stay near 0 under tick storm).

## Risk register

- **Wave 1 changes the tRPC mutation contract** from "returns full result" to "returns `{ backtestId }` and emit progress over socket". Callers of the old shape break. Mitigation: grep the renderer for any consumer (none today per the `useBacktest*` audit), but the next chat must re-grep before merging Wave 1. Document the change in the PR body.
- **Socket emission from inside the engine** runs on the backend Node process. Make sure the engine still works with `io = undefined` (CLI path) — `BacktestProgressReporter` should treat a missing `io` as a no-op. The CLI must keep working; it's the regression test.
- **Select inside Dialog** without `usePortal={false}` will silently swallow clicks. Document at the top of `BacktestModal.tsx` and add a unit-test assertion that opening a Select inside the modal renders inline (no portal child outside the dialog).
- **ETA estimation** can mislead users if the simulation is non-uniform (e.g., setup detection is far slower than the rest). The 5% floor + per-phase reset mitigates the worst case; if users complain it's still wrong, reduce smoothing weight or switch to per-phase ETA only.
- **Stale vite server** is the #1 e2e flake source — call out in the wave-2 PR description so the next chat doesn't repeat the chart-perf overhaul's lost hour.

## Open decisions / pause-and-ask triggers

Pause and ask before:

- Adding a "cancel running backtest" feature beyond the soft `reset()` (would need a server-side `AbortController` wired through `BacktestEngine.run` — meaningful design, defer to wave 7 if the user wants it).
- Building the equity curve mini-chart inside the results panel (could reuse `ChartCanvas` but rendering 1000-point line chart inside a modal warrants a styling pass).
- Persisting recent runs across reloads (localStorage vs server-side per user — has security implications for shared machines).
- Exposing the optimizer / walkforward / monte-carlo CLIs in the same modal — they have different inputs and could overwhelm the form. Each likely deserves its own button/modal.

Will NOT pause for:

- Mechanical schema mirroring (CLI/router → Zod) where the source of truth is unambiguous.
- Adding new translation keys (just ensure all 4 locales updated).
- Picking the toolbar icon (use `LuPlay` or `LuFlaskConical` — pick the one not already used in the toolbar).

## Out of scope

Tempting adjacent work to defer to follow-up plans:

- Optimizer / Walkforward / Montecarlo modals (separate plan).
- Backtest result detail page (full equity curve, per-trade table, indicator overlay on the chart with the trade markers).
- Saved backtest configurations as a first-class entity (currently just cached results, not configs).
- Cross-device backtest sync (results are in-memory `Map`s today; persisting them is a separate plan).
- Integration with the auto-trading path (auto-promote a profitable backtest config to a live watcher) — meaningful UX design needed.
