# Screener modal — comprehensive e2e plan

Self-contained brief for a fresh chat. Reads CLAUDE.md, this doc, and the cited files; ships the work.

## Context

The Screener is a beta-tier feature that lets users run market-wide filters across symbols, save custom filter sets, and click into a result to switch the chart. The modal is mature in code (`apps/electron/src/renderer/components/Screener/`) but has **zero e2e coverage** today. This plan mirrors what was just shipped for the Backtest modal: real Playwright specs against the dev server, simulating any backend event over the socket bridge, exercising every user-reachable lever.

The Backtest modal coverage that landed in `develop` (PRs #150 / #151) is the template — same `installTrpcMock` helper, same `chartTestSetup`, same `socketBridge`, same Electron-friendly `installTrpcMockOnContext` for the packaged-app variant.

Goal: ship a single PR with comprehensive Playwright coverage of the Screener modal — open/close, filter wiring, presets, saved screeners, results table, error path, save flow — green on chromium AND inside packaged Electron.

## What ships today (don't touch unless the spec needs it)

**Component (`apps/electron/src/renderer/components/Screener/`)**
- `ScreenerModal.tsx` — root, wires `useScreener` hook + `useScreenerStore`
- `PresetBar.tsx` — horizontally scrollable list of preset filter sets; clicking activates a preset and clears `customFilters`
- `FilterBuilder.tsx` — UI to add custom filter conditions (indicator + operator + value + lookback)
- `FilterChip.tsx` — chips listing the active custom filters with per-chip remove + clear-all
- `SavedScreenersList.tsx` — saved-by-user filter sets with load + delete
- `SaveScreenerDialog.tsx` — separate dialog opened from the footer Save button; takes a name
- `ScreenerResultsTable.tsx` — sortable table of matched symbols with optional `onSymbolClick`
- `constants.tsx` — `SCANNER_TIMEFRAME_OPTIONS`, `SCREENER_INTERVAL_OPTIONS`, `SCANNER_CATEGORY_ORDER`, `SCANNER_ICON_MAP`

**State (`apps/electron/src/renderer/store/screenerStore.ts`)**
- `isScreenerOpen` / `setScreenerOpen` / `toggleScreener`
- `activePresetId` / `setActivePresetId` (mutually exclusive with custom filters in the UI)
- `customFilters` array + `addFilter` / `updateFilter` / `removeFilter` / `clearFilters` / `setFilters`
- `assetClass` (`'CRYPTO' | 'STOCKS'`) / `marketType` (`'SPOT' | 'FUTURES'`) / `interval` (`TimeInterval`) — all hydrated from preferences via `syncUI`
- `sortBy` / `sortDirection` / `toggleSort`

**Hook (`apps/electron/src/renderer/hooks/useScreener.ts`)** — reads:
- `screener.runScreen` (mutation) — fires whenever filters/preset/asset/market/interval change
- `screener.getPresets` (query)
- `setupDetection.listIndicators` (or equivalent — confirm the actual procedure name when you read the file)
- `screener.getSavedScreeners` / `screener.saveScreener` / `screener.deleteScreener`

**Toolbar trigger** — already wired via `useScreenerStore.toggleScreener()` (`apps/electron/src/renderer/components/Layout/Toolbar.tsx` lines 233–242); `LuScanLine` icon, `t('screener.title')` tooltip.

## Strategy

Single branch `feat/screener-modal-e2e` cut from `develop`. **One PR**. Cadence the user explicitly asked for: drop the wave-by-wave PR split, keep all work on one branch, run tests locally throughout, save CI for the final review.

Order: **inventory → unit test for store → chromium e2e flow spec → Electron-side e2e spec → docs touch-up**.

### Local pre-flight every iteration

```bash
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint            # 0 errors required
pnpm --filter @marketmind/electron test:unit       # current floor: 1,800
lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null  # kill stale vite
VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test screener-modal-flow.spec.ts
```

The full e2e gauntlet (78 specs across all four projects) only at the end before opening the PR.

## Critical pitfall — read before writing the Electron spec

> **`page.route()` does NOT work inside the Electron renderer.** Empirically, Playwright's `page.route` enables CDP request interception that conflicts with Vite's ESM module loader; on reload, every `/src/**` and `@vite/client` request fails with `net::ERR_FAILED` and React never mounts (true even when the route pattern matches none of those URLs).

Use `installTrpcMockOnContext(ctx)` from `apps/electron/e2e/helpers/trpcMock.ts` for the Electron path — it patches `window.fetch` via `addInitScript` and never engages CDP. The Electron-app launcher accepts a `setupContext` callback that runs after `_electron.launch()` resolves but before `firstWindow()`:

```ts
launched = await launchApp({
  setupContext: (ctx) => installTrpcMockOnContext(ctx, { klines, overrides: { ... } }),
});
await launched.window.reload();   // first nav races us; reload runs the init script against a fresh page
await launched.window.waitForLoadState('domcontentloaded');
```

Cross-references: `docs/BROWSER_TESTING.md` (Layer 4 has the full explanation + a copy-paste example), `CLAUDE.md` (one-line warning).

## Coverage matrix

The spec must hit every leg of the matrix. Group into **two files**:

### File 1: `apps/electron/e2e/screener-modal-flow.spec.ts` (chromium project)

**A. Open / close**
1. Toolbar `Screener` button toggles the dialog (active state on toolbar button reflects open/closed).
2. Escape closes, re-opens via the same trigger, state survives the close/reopen (`activePresetId` and `customFilters` are not wiped).

**B. Header Selects (asset / market / interval)**
3. Default render shows `Crypto` / `Futures` / `30m` (or whatever `screenerStore.ts` defaults are at the time of writing — derive from the store, don't hardcode).
4. Changing asset class to `Stocks` triggers a new `screener.runScreen` request (use `getTrpcHitCount(page, 'screener.runScreen')` before/after).
5. Same for `marketType` SPOT/FUTURES and `interval` change.
6. **`Select` inside Dialog** — verify the dropdown opens *inside* the dialog (no portal child outside). The `Select` primitive must be passed `usePortal={false}` because Chakra's `DialogPositioner` intercepts portal clicks. Open one Select, click a non-default option, confirm the click reaches the option (i.e. the dropdown is interactive). This is the same memoized rule the Backtest modal lives by.

**C. Presets**
7. `PresetBar` renders all preset chips returned by `screener.getPresets`. Use a fixture with at least 3 presets across 2 categories.
8. Clicking a preset sets `activePresetId` and **clears the custom-filter UI** (the FilterBuilder + FilterChip block disappears — gated on `activePresetId === null`).
9. Clicking the same preset again unselects (returns to custom-filters mode).
10. Switching from preset A → preset B leaves `customFilters` empty (no leak).

**D. Filter builder + chips**
11. From the empty state, add 3 distinct custom filters via `FilterBuilder`. Each appears as a chip in `FilterChip`.
12. Per-chip remove deletes that one filter; the others stay.
13. "Clear all" empties `customFilters`.
14. Updating a filter (changing the operator or value via `FilterRow`) propagates — assert via the chip text and via a new `screener.runScreen` request firing.
15. **Filter / preset mutual exclusion** — selecting a preset hides the FilterBuilder; clearing the preset reveals it again with the previous custom filters preserved (current behavior in `ScreenerModal:108-111` is `if (id !== null) setFilters([])` — verify this matches the spec or document the divergence).

**E. Saved screeners**
16. With one or more custom filters set, footer "Save" enables. With zero filters and `activePresetId === null`, footer Save is disabled.
17. Clicking Save opens `SaveScreenerDialog`. Empty name → submit disabled. Valid name → submit fires `screener.saveScreener` (mock returns the new entry); dialog closes; `SavedScreenersList` shows the new row.
18. Clicking a saved screener loads its filters into `customFilters`, clears `activePresetId`, and triggers a new `runScreen`.
19. Per-row delete fires `screener.deleteScreener`; row disappears from the list (asserted via the mock returning the updated `getSavedScreeners` payload — orchestrate by re-resolving the query mock).

**F. Results table**
20. With a results fixture (5+ rows), the table renders, headers are sortable, clicking a header toggles `sortBy` + `sortDirection` (verify via `aria-sort` or via re-render order).
21. Click a row's symbol cell. With `onSymbolClick` provided to `ScreenerModal`, the callback fires with `(symbol, marketType?)`. Use a wrapper component in the test that captures the call.
22. Footer text matches `screener.footer.results` interpolation (`matched/scanned/time` from `results`).

**G. Refresh + error states**
23. Footer Refresh button calls `refetch` → bumps `screener.runScreen` hit count by exactly 1.
24. When `screener.runScreen` mock is wired to throw, the modal renders the error block (`screener.error` translation) and does NOT show the table. Refresh from the error state retries.

**H. Empty / loading states**
25. With `runScreen` returning an empty `results.results` array, the modal renders the table component (or its empty-state if the table has one — adapt to the component reality).
26. While `runScreen` is in flight (delay the mock by 500ms via a Promise wrapper), the spinner is visible in the body region.

### File 2: `apps/electron/e2e/electron/screener-modal.spec.ts` (electron project)

Smaller-scope — covers what the chromium spec can't: that the modal opens inside the actual packaged Electron app, the header Selects are interactive (CDP/Vite trap reproduction prevention), and a preset click triggers a `screener.runScreen` request. Use `installTrpcMockOnContext` per the pitfall doc.

1. Toolbar trigger opens the dialog; the four header Selects are visible and clickable.
2. Default `screener.runScreen` request happens once on open (use the same hit-counter the chromium spec uses; `installTrpcMockOnContext` mirrors the same `__mmTrpcCounters` global).
3. Clicking a preset chip from a 2-preset fixture triggers a second `runScreen` request.
4. Escape closes the dialog; reopening preserves preset state.

**Don't try to fully duplicate the chromium spec inside Electron** — Electron e2e is expensive (~30s boot per file) and the chromium project already covers the heavy lifting.

## Test fixture shape (single source of truth in the spec file)

Define once in the spec file — same pattern Backtest's `backtest-modal-flow.spec.ts` uses:

```ts
const PRESET_FIXTURE = [
  { id: 'momentum-rising', name: 'Momentum Rising', category: 'momentum', filters: [/* ... */], iconKey: 'TrendingUp' },
  { id: 'volume-spike',    name: 'Volume Spike',     category: 'volume',   filters: [/* ... */], iconKey: 'Zap' },
  { id: 'breakout',         name: 'Breakout',         category: 'volatility', filters: [/* ... */], iconKey: 'Target' },
];

const RESULTS_FIXTURE = {
  results: [
    { symbol: 'BTCUSDT', score: 9.4, change24h: 5.2, /* match the ScreenerResult type */ },
    /* 4 more rows */
  ],
  totalMatched: 5,
  totalSymbolsScanned: 200,
  executionTimeMs: 142,
};

const SAVED_FIXTURE = [
  { id: 'saved-1', name: 'My setup', filters: [/* ... */], createdAt: '2026-04-25T00:00:00.000Z' },
];

const installScreenerMock = (page: Page, opts: { savedOverride?: typeof SAVED_FIXTURE; runOverride?: () => unknown } = {}) =>
  installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'screener.getPresets': () => PRESET_FIXTURE,
      'screener.runScreen': opts.runOverride ?? (() => RESULTS_FIXTURE),
      'screener.getSavedScreeners': () => opts.savedOverride ?? SAVED_FIXTURE,
      'screener.saveScreener': (input: unknown) => ({
        id: `saved-${Date.now()}`,
        name: (input as { name: string }).name,
        filters: [],
        createdAt: new Date().toISOString(),
      }),
      'screener.deleteScreener': () => ({ success: true }),
      // Whatever indicator-list procedure the FilterBuilder consumes:
      'screener.getIndicators': () => [/* small fixture */],
    },
  });
```

Important: do **not** call `installTrpcMock` twice on the same page — `page.exposeFunction('__mmTrpcHitCount', ...)` errors on re-registration. For per-test variants (mutation rejection, alternate fixtures), either use a separate `test.describe` block with its own `beforeEach`, or layer a more-specific `page.route` after the catch-all (last-wins). The Backtest spec at `apps/electron/e2e/backtest-modal-flow.spec.ts:380-407` shows the layered-route pattern.

## Critical files (consolidated)

- `apps/electron/src/renderer/components/Screener/ScreenerModal.tsx` — root
- `apps/electron/src/renderer/components/Screener/{FilterBuilder,FilterChip,FilterRow,PresetBar,SaveScreenerDialog,SavedScreenersList,ScreenerResultsTable,constants}.tsx`
- `apps/electron/src/renderer/store/screenerStore.ts`
- `apps/electron/src/renderer/hooks/useScreener.ts`
- `apps/electron/src/renderer/components/Layout/Toolbar.tsx` (lines 233–242 — trigger)
- `apps/electron/e2e/backtest-modal-flow.spec.ts` (closest reference for spec shape)
- `apps/electron/e2e/electron/backtest-modal.spec.ts` (closest reference for Electron-side spec)
- `apps/electron/e2e/helpers/trpcMock.ts` (`installTrpcMock`, `installTrpcMockOnContext`, `getTrpcHitCount`)
- `apps/electron/e2e/electron/app-launch.ts` (`launchApp({setupContext})`)
- `docs/BROWSER_TESTING.md` Layer 4

## Optional: store unit test

If the store has any non-trivial logic (`toggleSort` cycles, hydrate merging from preferences, mutual exclusion of preset vs custom filters), add `apps/electron/src/renderer/store/__tests__/screenerStore.test.ts` covering those branches. Keep it small — the bulk of coverage lives in e2e.

## Verification gauntlet (run on the final PR)

```bash
pnpm --filter @marketmind/types build
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint            # 0 errors required
pnpm --filter @marketmind/backend lint
pnpm --filter @marketmind/backend test             # floor: 5,366 (don't regress)
pnpm --filter @marketmind/electron test:unit       # floor: 1,800
lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null
VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test    # floor: 78 (will lift to 78 + N)
```

Last-mile: also run `pnpm --filter @marketmind/electron run build:main && VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test --project=electron --reporter=list` to confirm the new Electron spec is green; the project doesn't auto-run inside the chromium gauntlet.

## Risk register

- **`screener.runScreen` may auto-fire on every store change.** That's good for coverage but can spam the mock with timing-sensitive assertions. Prefer hit-count deltas (`before`/`after`) over absolute counts. The Backtest "Show experimental triggers a new listStrategies call" pattern is the model.
- **Filter/preset mutual exclusion has a tiny landmine** — `setActivePresetId(null)` does NOT restore the previous custom filters (they're set to `[]` when a preset gets selected per `ScreenerModal:108-111`). Document the actual behavior in your assertion; if it's surprising, file a separate bug rather than papering over it in the spec.
- **`Select` inside Dialog** without `usePortal={false}` will silently swallow clicks. Add an explicit assertion that opening a Select inside the modal renders inline (no portal child outside the dialog) — same rule the Backtest modal codified.
- **Vite dev server stale on `:5173`** is the single biggest e2e flake source. Always kill before running. Playwright's `reuseExistingServer: !process.env.CI` will reuse a server without `VITE_E2E_BYPASS_AUTH=true` if one is already up, breaking everything that depends on `window.__indicatorStore` / `__priceStore` / `__queryClient`.

## Out of scope

- Building new presets or new filter operators — work with whatever the backend ships.
- Updating the screener backend — assertions on the resolver shape only, no schema changes.
- Cross-device sync of saved screeners.
- Performance regressions of the results table — defer to a perf spec under `e2e/perf/` if/when needed.
- Any changes to `MarketSidebar` — that lives at the indicators-only state now (the Scanner tab was removed in develop alongside this plan; the screener modal is the only path to scanner functionality).

## Pause-and-ask triggers

- Saved-screeners delete UX — does the row disappear optimistically, or does the spec need to wait for `getSavedScreeners` re-fetch? Read `useScreener.ts` to confirm before assuming.
- Empty results — what does `ScreenerResultsTable` render when `results.results.length === 0`? If it's a table with no rows, assert that. If it's a dedicated empty state, find its translation key.
- Sort behavior — does clicking a non-active header reset to `desc` (matching the chart-pattern), or to `asc`? `screenerStore.ts:90-99` has the answer.
