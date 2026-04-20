# Browser Testing & Automation

This document describes the browser-automation surface wired up for the repo. It has three layers, each usable on its own.

| Layer | What it is | When to use |
|---|---|---|
| 1. Playwright MCP server | Global MCP, drives a generic Chromium from any agent | Ad-hoc "go look at this page" work, console/network inspection, screenshots |
| 2. Chart perf harness | `apps/electron/e2e/perf/` — Playwright specs that exercise the real chart with mocked tRPC | Reproducible FPS / p95 frame / render-rate numbers, regression checks |
| 3. Electron smoke | `apps/electron/e2e/electron/` — `_electron.launch()` against `dist-electron/main/index.js` | Preload bridge, IPC, packaged-build sanity |

All three rely on the renderer-only `VITE_E2E_BYPASS_AUTH=true` flag to skip `AuthGuard` + `useBackendAuth`. In prod builds the branch is dead-code-eliminated — zero runtime cost.

---

## Layer 1 — Playwright MCP

Install once, globally:

```bash
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest --isolated --headless
```

This edits `~/.claude.json`. Tools are prefixed `mcp__playwright__`:

- `browser_navigate(url)`
- `browser_snapshot()` — accessibility-tree dump (primary read path)
- `browser_evaluate(fn)` — `() => window.__mmPerf?.getSnapshot()` etc.
- `browser_console_messages()` — captured console.* entries
- `browser_network_requests()` — list of requests with status/headers
- `browser_take_screenshot(filename?)`
- `browser_click / browser_type / browser_press_key / browser_wait_for`

Flags:
- `--isolated` — fresh profile per session, no leaking state
- `--headless` — no window flash; drop for visual debugging

---

## Layer 2 — Chart perf harness

### Run

```bash
pnpm --filter @marketmind/electron test:perf
# or for the full dev-server + compare-baseline flow:
./scripts/perf/run-chart-perf.sh
```

### What's in it

- `apps/electron/e2e/perf/chart-perf.spec.ts` — three tests:
  - **5-panel baseline** — macd + rsi + stoch + adx + bollingerBands; asserts fps ≥ 30, slowest section ≤ 20 ms, regression vs baseline ≤ 25 %
  - **overlay-only baseline** — sma + ema + bollingerBands; asserts fps ≥ 40, slowest section ≤ 15 ms
  - **sanity** — adds the 5-panel set, asserts no console errors
- `apps/electron/e2e/perf/chart-hotpath.spec.ts` — hot-path regression tests that exercise real-world data churn (see **Hot-path scenarios** below)
- `apps/electron/e2e/perf/baseline.json` — committed baseline numbers; update via `pnpm --filter @marketmind/electron test:perf:update`
- `apps/electron/e2e/perf/last-run.json` — written by each run, compared against baseline by `scripts/perf/compare-baseline.ts`
- `apps/electron/e2e/helpers/`
  - `trpcMock.ts` — intercepts `**/trpc/**`, returns canned responses (auth, wallet, trading, kline, …). `kline.list` respects `input.limit`.
  - `klineFixtures.ts` — `generateKlines({count, seed, basePrice, volatility, interval, symbol, endTime})` with mulberry32 RNG. Exports `toRawKline()` for shared raw-row serialization.
  - `chartTestSetup.ts` — `enablePerfOverlay`, `addIndicators`, `clearIndicators`, `waitForChartReady`, `waitForFrames`, `driveFrames`, `readPerfSnapshot`, `slowestSectionMs`, `componentRenderRate`, plus the hot-path drivers `pushPriceTicks`, `updateLatestKline`, `appendKline`
  - `consoleCapture.ts` — captures `console.error/warn` via init script; `filterNoiseFromErrors` drops known networking noise

### Hot-path scenarios

The hot-path suite targets the render paths that dominate real trading sessions — price tick storms, current-bar updates, and new-bar appends. Each test sets up overlay indicators, warms up, resets the monitor, then interleaves data mutations with driven frames. Assertions are deliberately loose (fps ≥ 20, slowest section ≤ 25ms) so the regression signal is in the baseline delta, not the thresholds.

| Scenario | Driver | What it stresses |
|---|---|---|
| `price-tick-storm` | `pushPriceTicks(page, {sym: price})` at ~100 Hz for 10 symbols | `usePricesForSymbols` subscribers, chart imperative subscribe callback. Catches regressions where a component starts subscribing to `usePriceStore` via a selector. |
| `kline-replace-loop` | `updateLatestKline(page, {close, volume})` every 100ms | React Query `kline.list` cache mutation → `useKlinePagination.allKlines` → ChartCanvas re-render. Catches cache-update cost regressions. |
| `kline-append` | `appendKline(page, FixtureKline)` every 500ms | Same cache path but array grows (new-bar case). |

**Driver helper contract.** All drivers are `page.evaluate` wrappers over `window.__*` stores:
- `pushPriceTicks` uses `window.__priceStore.getState().updatePriceBatch(Map)`. Note: `usePriceStore` is **not** subscribed via selectors by `ChartCanvas` — the chart uses an imperative `subscribe()` callback — so this scenario primarily stresses the store itself and any React selectors in sibling components.
- `updateLatestKline` / `appendKline` mutate the React Query cache via `window.__queryClient.setQueriesData({predicate})`. The predicate matches any query keyed on `['kline', 'list']`.

**Running diagnose mode.** To dump the top-5 slowest sections per scenario into `diagnose-<timestamp>.json`:

```bash
pnpm --filter @marketmind/electron test:perf:diagnose
```

Output lands next to `baseline.json` and is git-ignored. Use it to point at real bottlenecks after a failing baseline comparison.

### Store exposures for tests

The harness relies on renderer-side "bridges" installed only when `VITE_E2E_BYPASS_AUTH=true`:

| Exposure | Source | Used by |
|---|---|---|
| `window.__mmPerf` | `utils/canvas/perfMonitor.ts` (unconditional — only surfaces data when the `chart.perf` flag is on) | `readPerfSnapshot`, `resetPerfMonitor` |
| `window.__indicatorStore` | `utils/e2eBridge.ts` | `addIndicators`, `clearIndicators` |
| `window.__preferencesStore` | `utils/e2eBridge.ts` | planned: preference-driven re-render tests |
| `window.__priceStore` | `utils/e2eBridge.ts` | `pushPriceTicks` |
| `window.__queryClient` | `components/TrpcProvider.tsx` effect | `updateLatestKline`, `appendKline` |

The `e2eBridge.ts` exposures and the `TrpcProvider` queryClient bridge are gated on `IS_E2E_BYPASS_AUTH`; prod builds dead-code-eliminate both via Vite's `import.meta.env.VITE_*` inlining.

### Reading perfMonitor output

`readPerfSnapshot(page)` returns `PerfSnapshot`:
- `enabled` — mirrors `localStorage('chart.perf') === '1'`. Always assert this is `true` first; a `false` run means the overlay flag didn't stick (the helper `refreshPerfFlag` resyncs it after navigation).
- `fps` — rolling 1s window. `driveFrames` paces synthetic mousemove events at rAF rate, which caps effective framerate around 25-30 in headless Chromium. Don't chase higher — assert `≥ 20`.
- `lastFrameMs` — wall time of most recent frame. Spikes here point at per-frame stalls.
- `sections[]` — sorted by `lastMs` desc. Named per-pass costs (`klines`, `overlayIndicators`, `panelIndicators`, `grid`, `orderLines`, …). First entry is the slowest; assert `slowestSectionMs(snap) ≤ 25` as a floor, widen per scenario only when justified.
- `componentRenders[]` — sorted by `ratePerSec` desc. Use `componentRenderRate(snap, 'ChartCanvas')` to read a specific component's rate. Always assert on rate, not absolute count.

### Troubleshooting low FPS in tests

- **Use `driveFrames`, not `waitForFrames`, during measurement.** `waitForFrames` only awaits rAF ticks — the chart's render loop marks dirty on pointer events, so without synthetic mousemove the draw never runs. `driveFrames` dispatches mousemove on every frame; that's what exercises the pipeline. `waitForFrames` is still fine for post-mount settling where no measurement happens.
- **Dev server reuse.** `playwright.config.ts` has `reuseExistingServer: !process.env.CI`. If you already have a dev server on 5173 that was started *without* `VITE_E2E_BYPASS_AUTH=true`, the harness will reuse it and every bridge will be missing. Either kill the local dev server, or run the perf project on an isolated port: `PLAYWRIGHT_WEB_PORT=5190 pnpm --filter @marketmind/electron test:perf`.
- **Baseline thrash.** Commit only measured numbers. If `test:perf:update` is run after a *regression* it will silently bless it — review the delta first.

### How the renderer wiring works

- `import.meta.env.VITE_E2E_BYPASS_AUTH === 'true'` is gated in `apps/electron/src/shared/constants/e2e.ts` (`IS_E2E_BYPASS_AUTH`)
- `AuthGuard.tsx` returns its children unconditionally when the flag is on
- `useBackendAuth.ts` disables the real `auth.me` query and returns `SYNTHETIC_E2E_USER`
- `utils/e2eBridge.ts` exposes Zustand stores on `window.__indicatorStore` and `window.__preferencesStore`, installed from `index.tsx` after `setupPerformanceCleanup()`

None of this runs in production — `import.meta.env.VITE_*` is inlined at build time, so the `if (IS_E2E_BYPASS_AUTH)` branches vanish.

### Adding a new perf scenario

1. Add a `test(...)` block in `chart-perf.spec.ts`
2. `clearIndicators(page)` → `addIndicators(page, [...])`
3. `waitForFrames(page, WARMUP_FRAMES)` → `resetPerfMonitor(page)` → `waitForFrames(page, MEASURE_FRAMES)`
4. Assert on `readPerfSnapshot(page)` — use `slowestSectionMs` and `componentRenderRate`
5. `writeRunResult(key, entry)` so `compare-baseline.ts` picks it up

### Updating the baseline

```bash
pnpm --filter @marketmind/electron test:perf       # fills last-run.json
pnpm --filter @marketmind/electron test:perf:update # copies into baseline.json
```

Only do this when a real improvement lands — regressions should fail, not rewrite history.

---

## Layer 3 — Electron smoke

### Run

```bash
pnpm --filter @marketmind/electron test:e2e:electron
```

The script builds `dist-electron/main/index.js` via `VITE_TARGET=electron vite build` first, then runs the `electron` Playwright project.

### What it covers

- `apps/electron/e2e/electron/app-launch.ts` — `_electron.launch({ args: [MAIN_ENTRY], env: { VITE_E2E_BYPASS_AUTH: 'true', NODE_ENV: 'test' } })`
- `apps/electron/e2e/electron/smoke.spec.ts`:
  - window opens, title set
  - chart canvas mounts
  - preload `window.electron` bridge present
  - `window.__mmPerf` reachable after setting `chart.perf`

Slower than Layer 2 (~30 s boot). Only covers what the Vite renderer path can't: preload, IPC, packaged-app boot.

---

## CLI wrappers

| Script | Purpose |
|---|---|
| `scripts/perf/run-chart-perf.sh` | End-to-end: install Chromium → run perf project → compare baseline |
| `scripts/perf/compare-baseline.ts` | Reads `last-run.json` vs `baseline.json`, prints colored delta table, exits non-zero on regressions > 10% |
| `scripts/perf/update-baseline.ts` | Copies `last-run.json` into `baseline.json` with fresh `generatedAt` |

---

## Troubleshooting

- **`@playwright/test` version mismatch** — align `@playwright/test` and `playwright` in `apps/electron/package.json`. A mixed pair ("two versions of @playwright/test") breaks `test.describe()` at load.
- **`testIgnore` drops all tests** — use `testMatch: '*.spec.ts'` with explicit `testDir`. Glob-based ignores against a shared `./e2e` root have empty intersections in this repo.
- **Auth bypass does nothing** — the webServer in `playwright.config.ts` sets `VITE_E2E_BYPASS_AUTH=true`. If you run the dev server manually, export it yourself: `VITE_E2E_BYPASS_AUTH=true pnpm dev:renderer`.
- **Klines don't show** — `trpcMock.ts` has to be installed *before* `page.goto('/')`. Install it in `beforeEach` and always await the install promise.
- **`window.__indicatorStore` is undefined** — the bridge only installs when the bypass flag is on. Check `localStorage` isn't interfering and that `installE2EBridge()` is called from `index.tsx`.
- **`window.__queryClient` is undefined** — the queryClient bridge runs inside a `useEffect` in `TrpcProvider`, so it needs one paint to be available. `waitForChartReady` already covers this. Same root cause as the indicator-store miss: reusing a dev server that wasn't started with the bypass flag.
