# Auto-trading — comprehensive e2e plan

Self-contained brief for a fresh chat. Reads CLAUDE.md, this doc, and the cited files; ships the work on a **single branch** (`feat/auto-trading-e2e`) with a single PR — no wave-by-wave split.

## Context

Auto-trading is the largest unguarded surface in the app today: **zero e2e specs**, no unit coverage on the auto-trading slice of `uiStore`, and the only existing tests are server-side integration tests (testcontainers) that don't touch the renderer at all. After what shipped for Backtest (PRs #150 / #151) and Screener (PR #155), the same coverage shape — Playwright against the dev server, simulating any backend event over the socket bridge, exercising every user-reachable lever — is the template.

Goal: ship a single PR with comprehensive coverage of the **WatcherManager** (Settings → Auto-Trading tab), the **AutoTradingSidebar** (toolbar `LuBot` button), the **AddWatcherDialog**, the **StartWatchersModal**, the **WatchersTab**, the **LogsTab**, and the socket-driven invalidation paths. Cadence the user already validated: drop the wave-by-wave PR split, keep all work on one branch, run tests locally throughout, save CI for the final review.

## What ships today (don't touch unless the spec needs it)

### Entry points
- **Toolbar trigger** — `LuBot` button in `apps/electron/src/renderer/components/Layout/Toolbar.tsx:282-291`, `aria-label={t('autoTrading.sidebar.title', 'Auto Trading')}`. Toggles `isAutoTradingOpen` (preference-backed via `useUIPref('autoTradingSidebarOpen', false)` in `App.tsx:156`).
- **AutoTradingSidebar** — `apps/electron/src/renderer/components/AutoTrading/AutoTradingSidebar.tsx`. Three tabs (`watchers` / `scalping` / `logs`) wired to `uiStore.autoTradingSidebarTab`. Persistent via `syncUI` (line 23 of `uiStore.ts`).
- **Settings → Auto-Trading tab** — opens `WatcherManager` (the big config form). Triggered via Settings dialog → `tabs.autoTrading` value (`SettingsDialog.tsx:81-83`).

### Components in scope
- `apps/electron/src/renderer/components/AutoTrading/AutoTradingSidebar.tsx` — sidebar shell, tabs
- `apps/electron/src/renderer/components/MarketSidebar/tabs/WatchersTab.tsx` — watchers list + StartWatchersModal trigger + DirectionMode + position-size slider + suggestions
- `apps/electron/src/renderer/components/MarketSidebar/tabs/LogsTab.tsx` — live `autoTrading:log` socket events + clear + font-size buttons
- `apps/electron/src/renderer/components/Trading/StartWatchersModal.tsx` — bulk-start dialog (asset/market/timeframe, count, dynamic-rankings selection)
- `apps/electron/src/renderer/components/Trading/AddWatcherDialog.tsx` — single/bulk start dialog (symbol, profile, market type, timeframe)
- `apps/electron/src/renderer/components/Trading/WatcherManager/index.tsx` — root config form
- `apps/electron/src/renderer/components/Trading/WatcherManager/{EmergencyStopSection,DynamicSelectionSection,LeverageSettingsSection,PositionSizeSection,RiskManagementSection,TrailingStopSection,TpModeSection,StopModeSection,EntrySettingsSection,FiltersSection,OpportunityCostSection,PyramidingSection,WatchersList}.tsx` — collapsible config sections
- `apps/electron/src/renderer/components/Settings/AutoTradingTab.tsx` — thin wrapper around `WatcherManager` for the settings dialog

### State
- `apps/electron/src/renderer/store/uiStore.ts` — auto-trading slice: `autoTradingSidebarOpen` / `setAutoTradingSidebarOpen` / `toggleAutoTradingSidebar`, `autoTradingSidebarTab` / `setAutoTradingSidebarTab`, `watchersTableSortKey` / `watchersTableSortDirection` / `setWatchersTableSort`. All persisted via `syncUI`.
- No standalone `autoTradingStore`. Config lives entirely server-side via `trpc.autoTrading.getConfig` + React Query.

### Hooks
- `apps/electron/src/renderer/hooks/useBackendAutoTrading.ts` — the central hook. Reads `getConfig`, `getActiveExecutions`, `getExecutionHistory`, `getWatcherStatus` (polled at `QUERY_CONFIG.REFETCH_INTERVAL.REALTIME`); exposes `updateConfig`, `executeSetup`, `cancelExecution`, `closeExecution`, `startWatcher`, `stopWatcher`, `stopAllWatchers`, `startWatchersBulk`, `emergencyStop`, `toggleAutoTrading`. Also exports `useTopSymbols`, `useDynamicSymbolScores`, `useFilteredSymbolsForQuickStart`, `useTopCoinsByMarketCap`, `useRotationStatus`, `useRotationHistory`, `useTriggerRotation`, `useCapitalLimits`.
- `apps/electron/src/renderer/hooks/useAutoTradingLogs.ts` — subscribes to `autoTrading:log` socket events, maintains a ring buffer of `FrontendLogEntry`s.
- `apps/electron/src/renderer/components/Trading/WatcherManager/hooks/useWatcherConfig.ts` — wraps the dozens of `handleXxxChange` callbacks (TP mode, fibonacci levels, filters, leverage, max-drawdown, margin top-up, etc.).
- `apps/electron/src/renderer/components/Trading/WatcherManager/hooks/useWatcherState.ts` — local UI state: which sections are expanded, quick-start count/timeframe/market, which dialogs are open.

### tRPC procedures (must be mocked)
**Queries:**
- `autoTrading.getConfig` (per wallet)
- `autoTrading.getWatcherStatus` (polled — `realtime` interval)
- `autoTrading.getActiveExecutions`
- `autoTrading.getExecutionHistory`
- `autoTrading.getBtcTrendStatus` (gated by `useBtcCorrelationFilter`)
- `autoTrading.getBatchFundingRates` (gated by `useFundingFilter` + FUTURES)
- `autoTrading.getRotationStatus`
- `autoTrading.getRotationHistory`
- `autoTrading.getFilteredSymbolsForQuickStart`
- `autoTrading.getDynamicSymbolScores`
- `autoTrading.getTopCoinsByMarketCap`
- `autoTrading.getTopSymbols`

**Mutations:**
- `autoTrading.updateConfig` (massive payload — 50+ optional fields)
- `autoTrading.executeSetup`
- `autoTrading.cancelExecution`
- `autoTrading.closeExecution`
- `autoTrading.startWatcher`
- `autoTrading.stopWatcher`
- `autoTrading.stopAllWatchers`
- `autoTrading.startWatchersBulk`
- `autoTrading.emergencyStop`
- `autoTrading.triggerSymbolRotation`

### Socket events (handled by the renderer)
- `autoTrading:log` → `useAutoTradingLogs` (LogsTab)
- `setup-detected` → invalidates `setup.detectCurrent` / `setup.getHistory` / `setup.getStats`
- `position:update`, `position:closed` → re-render trigger (no-op currently per `RealtimeTradingSyncContext.tsx:119-127`)
- `order:update` / `order:created` / `order:cancelled` → schedules orders re-fetch
- `wallet:update` → schedules wallet re-fetch
- `risk:alert` → toast notification
- `trade:notification` → toast
- `notification` → toast

## Strategy

Single branch `feat/auto-trading-e2e` cut from `develop`. **One PR.**

Order: **inventory → uiStore unit tests for auto-trading slice → AutoTradingSidebar e2e → WatchersTab e2e → LogsTab e2e (socket-driven) → StartWatchersModal e2e → AddWatcherDialog e2e → WatcherManager (Settings tab) e2e → packaged-Electron smoke → docs touch-up**.

Each spec stands on its own (own `test.describe` + own `installAutoTradingMock` setup). Don't try to share state across specs — Playwright workers run them in parallel anyway.

### Local pre-flight every iteration

```bash
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint            # 0 errors required
pnpm --filter @marketmind/electron test:unit       # current floor: 1,818
lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null  # kill stale vite
VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test <new spec>
```

The full e2e gauntlet (103 specs across all four projects, current floor) only at the end before opening the PR.

## Critical pitfalls — read before writing specs

### 1. `page.route()` does NOT work inside the Electron renderer
Same trap that bit Backtest and Screener. Use `installTrpcMockOnContext(ctx)` for the Electron path; cross-reference `docs/BROWSER_TESTING.md` Layer 4 + the comment block in `apps/electron/e2e/helpers/trpcMock.ts:213-226`.

### 2. Auto-trading needs an active wallet
Every entry point gates on `activeWallet`. The default `installTrpcMock` returns `wallet.list: []`, which means the WatchersTab shows the "no wallets" empty state and the WatcherManager renders the wallet-required block. **Specs must override `wallet.list` and `wallet.listActive`** to return a fixture, AND call `useUIStore.setState({ activeWalletId: <id> })` (or pre-seed `preferences.getByCategory` with `activeWalletId`) so the wallet is treated as active.

Pattern:
```ts
const WALLET_FIXTURE = [{
  id: 'w1',
  name: 'Test Wallet',
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  isActive: true,
  walletBalance: '10000',
  // ... full WalletRecord shape
}];

await installAutoTradingMock(page, { wallets: WALLET_FIXTURE });
await page.goto('/');
await page.evaluate((id) => {
  // Bridge exposed via window when VITE_E2E_BYPASS_AUTH=true
  (window as any).__uiStore?.getState().setActiveWalletId(id);
}, 'w1');
```

If `__uiStore` isn't currently exposed on `window`, this needs adding to the renderer's bypass-auth bridge — same pattern as `__indicatorStore` / `__priceStore`. (Check `chartTestSetup.ts` line 53-74 for the existing bridge declarations.) **Add `__uiStore` to the bridge as part of the unit-tests pass — it's a 5-line change.**

### 3. `getWatcherStatus` is polled
With `refetchInterval: realtimePolling`, it fires every ~5s. Hit-count assertions need to use **deltas** (`before` / `after`), never absolute counts. Same trick the Backtest spec uses for `setupDetection.listStrategies`.

### 4. `updateConfig` payload is massive
50+ optional fields. The mock should accept any subset and echo back the merged config so the next `getConfig` query reflects the update. Pattern: keep a mutable `currentConfig` in closure and have the mock for `updateConfig` merge `input` into it, then `getConfig` returns the same object.

### 5. `WatcherManager` is rendered inside `Settings → Auto-Trading` tab
There's no standalone "WatcherManager modal" to assert on. The path is: open Settings dialog (Cmd/Ctrl+, or via menu), click Auto-Trading tab, then assert. Specs must navigate this path before reaching any WatcherManager assertion. Find the existing Settings-dialog opener — likely a button on the trading sidebar or a keyboard shortcut.

### 6. `Select inside Dialog` rule still applies
The Selects used for asset class / market type / interval inside `StartWatchersModal` and `AddWatcherDialog` need `usePortal={false}` (verify in the source — if any of them don't have it, that's a bug to fix, not paper over). Add the same `usePortal=false` assertion the Screener spec uses.

### 7. Socket bridge required for log + invalidation tests
`emitSocketEvent(page, 'autoTrading:log', ...)` and `emitSocketEvent(page, 'setup-detected', ...)` need `waitForSocket(page)` first, same pattern as the Backtest spec.

## Coverage matrix

Eight spec files, each scoped to one component/feature. Group into `apps/electron/e2e/auto-trading/` subdirectory to keep things tidy.

### File 1: `apps/electron/e2e/auto-trading/sidebar-toggle.spec.ts` (chromium)

**A. Sidebar open / close + tab switching**
1. Toolbar `LuBot` button toggles the sidebar (`active` state on toolbar reflects open/closed).
2. The sidebar renders 3 tabs: Watchers, Scalping, Logs (assert via `dialog.getByRole('tab', ...)` or `[role=tablist]`).
3. Default tab is Watchers — content visible.
4. Clicking each tab switches content. Tab switch persists `autoTradingSidebarTab` via `syncUI` (verify by triggering `preferences.bulkSet` mock).
5. Clicking the sidebar's close button (X) calls the toggle handler — sidebar collapses.
6. Reopening the sidebar after close preserves the last-active tab.

### File 2: `apps/electron/e2e/auto-trading/watchers-tab.spec.ts` (chromium)

**B. Watchers tab — empty state + populated state**
7. With `getWatcherStatus.activeWatchers = []` and an active wallet, render the empty-state block + "Start Watchers" button.
8. With `getWatcherStatus.activeWatchers = [w1, w2, w3]`, render the badge count `3`, the table with 3 rows, and the "Stop All" button.
9. No-wallet state — no `activeWalletId` in `uiStore` — renders the orange "no wallet" block.

**C. Direction mode + auto-trade percent slider**
10. `DirectionModeSelector` reflects `config.directionMode`. Clicking another option fires `autoTrading.updateConfig` with `{ directionMode: 'long_only' }` (or whatever was clicked). Assert via hit-count delta.
11. Position-size slider. Initial value comes from `config.positionSizePercent`. `onValueChangeEnd` fires `autoTrading.updateConfig` with `positionSizePercent: <value>.toString()`.

**D. Stop All + row click**
12. Clicking "Stop All" fires `autoTrading.stopAllWatchers` mutation; on success the watchers table empties (re-fetch via `getWatcherStatus` invalidation).
13. Clicking a watchers-table row's symbol cell calls `globalActions.navigateToSymbol` — verify via the chart's symbol display updating (or, simpler, verify the row has cursor pointer + click doesn't throw — same pragmatic pattern as the Screener spec).

**E. StartWatchersModal trigger**
14. Clicking the green play `IconButton` (or the empty-state "Start Watchers" button) opens `StartWatchersModal` (`role=dialog`, name = `t('marketSidebar.watchers.startWatchers')`).

### File 3: `apps/electron/e2e/auto-trading/start-watchers-modal.spec.ts` (chromium)

**F. StartWatchersModal — open / close**
15. Open it (via WatchersTab trigger or directly via `setUIStore`). Escape closes.

**G. Asset / market / timeframe Selects**
16. Three Selects inside the modal: market type (SPOT/FUTURES), timeframe, count slider. Each change re-fetches `autoTrading.getFilteredSymbolsForQuickStart` (assert via hit-count delta).
17. **`usePortal=false` rule** — open one Select, click an option inside the dialog (no portal child outside).

**H. Start action**
18. With non-empty filtered symbols, clicking Start fires `autoTrading.startWatchersBulk` with `{symbols, interval, marketType, targetCount}`. Modal closes on success. WatchersTab table re-renders with the new watchers (because the mock for `getWatcherStatus` returns the new fixture after the mutation).
19. With empty filtered symbols, Start is disabled.

### File 4: `apps/electron/e2e/auto-trading/add-watcher-dialog.spec.ts` (chromium)

**I. AddWatcherDialog — single mode**
20. Default mode = single. Asset class / market type / SymbolSelector / TimeframeSelector / profile select / "use default" checkbox visible. Submit button label = "Start".
21. Submit fires `autoTrading.startWatcher` with `{symbol, interval, profileId, marketType}`. Dialog closes.

**J. Bulk mode**
22. Toggling to bulk mode reveals `BulkSymbolSelector`, hides the single-symbol selector. Submit label changes to `Start {{count}} Watchers`.
23. With selected symbols, submit fires `autoTrading.startWatchersBulk` with the array.
24. Switching market type clears `selectedSymbols` (verify by adding a symbol, switching market type, asserting count = 0).

**K. Profile select**
25. With `useDefault = true`, profileSelect is disabled (or has empty value). Toggling off enables it; selecting a profile passes `profileId` in the mutation payload.

### File 5: `apps/electron/e2e/auto-trading/logs-tab.spec.ts` (chromium)

**L. Logs tab — socket-driven**
26. Switch to Logs tab. Empty state shows "Waiting for logs..." (`autoTrading.console.waiting`).
27. `waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 })`.
28. `emitSocketEvent(page, 'autoTrading:log', { level: 'info', message: 'Test log line', symbol: 'BTCUSDT', emoji: '✅', timestamp: Date.now() })` — line appears.
29. Emit 5 more — all 6 visible, ordered correctly.
30. Click `Clear` (`autoTrading.console.clear`) — list empties, "Waiting for logs..." returns.
31. Click `+` font-size button — log lines render at the next size step (assert via inline `font-size` style or computed style).
32. Click `−` (decrease) — back to previous step.
33. **Errors render in red** — emit `{level: 'error', ...}`, assert the line's color via `data-level` attribute or by computed style.

### File 6: `apps/electron/e2e/auto-trading/watcher-manager.spec.ts` (chromium)

The **largest** spec. Open Settings → Auto-Trading tab, then exercise every collapsible.

**M. Open path**
34. Open Settings dialog → click "Auto-Trading" tab → `WatcherManager` content renders.

**N. Emergency stop section**
35. With no active watchers, "Emergency Stop" button is disabled (or hidden — depends on `hasActiveWatchers`).
36. With active watchers, click Emergency Stop → confirm dialog appears. Confirming fires `autoTrading.emergencyStop`. Cancel hides the confirm.

**O. Trading mode toggle**
37. `auto` and `semi_assisted` buttons. Click one → fires `updateConfig` with `tradingMode`. Active state reflects current mode.

**P. Watchers list section** — covered by File 2; in this spec just assert it renders inside the modal.

**Q. Dynamic selection section**
38. Auto-rotation toggle fires `updateConfig` with `enableAutoRotation`.
39. Quick-start count slider, market-type select, timeframe select — all fire the corresponding `getFilteredSymbolsForQuickStart` re-fetch.
40. "Trigger Rotation" button fires `autoTrading.triggerSymbolRotation`.
41. "View Rankings" button opens `DynamicSymbolRankings` dialog (assert dialog opens; deeper coverage of that dialog out of scope per "out of scope" below).

**R. Leverage section** (FUTURES-only — gated on `!isIB`)
42. Slider value reflects `config.leverage`. `onValueChangeEnd` fires `updateConfig` with `leverage`.

**S. Position size section**
43. Three sliders: `positionSizePercent`, `manualPositionSizePercent`, `maxGlobalExposurePercent`. Each fires `updateConfig` with the corresponding stringified value.

**T. Risk management section**
44. Max-drawdown switch toggles `maxDrawdownEnabled` + reveals the percent slider when enabled.
45. Same for max-risk-per-stop.
46. Margin top-up — switch + threshold + percent + max-count. Each control fires `updateConfig`.
47. Auto-cancel-orphans switch.

**U. Trailing stop section**
48. Master enable switch.
49. Activation percent (long + short).
50. Distance percent (long + short).
51. Use-adaptive-trailing switch.
52. Stop-offset mode (auto/fixed) — selecting "fixed" reveals the offset slider.
53. Indicator interval Select — `usePortal=false` rule applies here.

**V. TP mode section**
54. TP calculation mode buttons (`default` / `fibonacci` / `rr_target`). Each fires `updateConfig`.
55. With fibonacci mode, fibonacci-level-long + fibonacci-level-short Selects are visible. Each change fires `updateConfig`.
56. Fibonacci swing range Select (`nearest` / `extended`).

**W. Stop mode section**
57. Initial stop mode buttons (`fibo_target` / `swing` / `atr`). Each fires `updateConfig`.

**X. Entry settings section**
58. **Two sliders** for `maxFibonacciEntryProgressPercentLong` and `maxFibonacciEntryProgressPercentShort` — verify both render distinctly, both fire `updateConfig` with the correct field.
59. **Two sliders** for `minRiskRewardRatioLong` and `minRiskRewardRatioShort`.
60. Three preference toggles (no `updateConfig` mutation — they're trading prefs, not server config): `dragSlEnabled`, `dragTpEnabled`, `slTightenOnly`. Verify each toggle calls `preferences.bulkSet` (or skip if too noisy and just assert they're interactive).

**Y. Filters section**
61. Confluence min-score slider. Each filter toggle (the FilterToggle component) fires `updateConfig` with the corresponding `useXxxFilter` flag. There are **many** filter flags — assert ~3 representative ones (e.g. `useEmaTrendFilter`, `useBtcCorrelationFilter`, `useFundingFilter`) instead of every single one.

**Z. Opportunity cost section** + **AA. Pyramiding section**
62. Opportunity cost — section opens, contains some controls, each fires `updateConfig`. Assert ~2 controls.
63. Pyramiding — section opens, IB-gated controls don't render when `isIB=false`, otherwise visible.

**BB. AddWatcherDialog trigger**
64. From the watchers list section, "+" button opens `AddWatcherDialog` (cross-checks File 4 — just assert the dialog opens).

### File 7: `apps/electron/e2e/auto-trading/socket-invalidations.spec.ts` (chromium)

**CC. setup-detected → query invalidation**
65. Open the WatchersTab. Note the current `setup.detectCurrent` hit count.
66. `emitSocketEvent(page, 'setup-detected', { ... })` — verify hit count grows by ≥ 1 within 5s.

**DD. order:update → orders re-fetch**
67. Open the trading sidebar (or just keep on watchers tab — the `RealtimeTradingSyncContext` is global). Note `trading.getOrders` hit count. Emit `order:update`. Hit count grows.

**EE. position:update / position:closed**
68. Emit `position:update` — `position.list` (or whichever query is wired) hit count grows. Match the actual procedure name to the real wiring; the comment in `RealtimeTradingSyncContext.tsx:119-127` notes those handlers are "no-op currently" — if so, rewrite the test as: "emitting position:update does NOT crash the page" (a regression guard, not a positive assertion).

**FF. risk:alert → toast**
69. Emit `risk:alert` with `{level: 'critical', message: 'Margin warning'}`. Toast appears in the dialog/region.

**GG. autoTrading:log → LogsTab updates**
70. Already covered in File 5; here just verify that emitting from outside the LogsTab still routes correctly (i.e. the global socket listener is mounted regardless of tab visibility).

### File 8: `apps/electron/e2e/electron/auto-trading-sidebar.spec.ts` (electron project)

Smaller-scope. Same pattern as the existing `screener-modal.spec.ts` Electron spec.

71. Toolbar `LuBot` opens the sidebar inside packaged Electron.
72. All three tabs are clickable.
73. Switching to Watchers tab fires `autoTrading.getWatcherStatus`.
74. Closing via the X button collapses the sidebar.

### Optional unit test (small): `apps/electron/src/renderer/store/uiStore.test.ts` (extend existing)

The existing `uiStore.test.ts` already covers tradingSidebarTab + activeWalletId + ordersFilterStatus. **Extend it** with the auto-trading slice instead of writing a new file:
- `autoTradingSidebarOpen` toggle / setter.
- `autoTradingSidebarTab` setter → all 3 values.
- `setWatchersTableSort` cycles direction on same key, resets on different key (same pattern as screenerStore.toggleSort).

Don't create `autoTradingStore.test.ts` — there's no `autoTradingStore`.

## Test fixture shape (single source of truth per spec file)

Each spec file defines its own fixtures + `installAutoTradingMock` helper. **Don't extract into a shared module** — the Backtest + Screener specs each have their own self-contained installer; the readability win of inlining outweighs the small duplication.

```ts
const WALLET_FIXTURE = [{
  id: 'w1',
  name: 'Test Wallet',
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  isActive: true,
  walletBalance: '10000',
  apiKeyEncrypted: 'enc',
  apiSecretEncrypted: 'enc',
  // ... match the WalletRecord shape returned by backend
}];

// Mutable so updateConfig can echo merged state for the next getConfig fetch.
const buildAutoTradingState = () => ({
  config: {
    walletId: 'w1',
    tradingMode: 'auto',
    directionMode: 'auto',
    positionSizePercent: '10',
    leverage: 1,
    enableAutoRotation: true,
    trailingStopEnabled: true,
    // ... full config shape per AUTO_TRADING_CONFIG defaults
  },
  watcherStatus: {
    activeWatchers: [],
    persistedWatchers: 0,
  },
  activeExecutions: [],
  executionHistory: [],
});

const installAutoTradingMock = (page: Page, opts: { wallets?: typeof WALLET_FIXTURE; configOverride?: Partial<Config>; watchersOverride?: ActiveWatcher[] } = {}) => {
  const state = buildAutoTradingState();
  if (opts.configOverride) Object.assign(state.config, opts.configOverride);
  if (opts.watchersOverride) state.watcherStatus.activeWatchers = opts.watchersOverride;

  const wallets = opts.wallets ?? WALLET_FIXTURE;

  return installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => wallets,
      'wallet.listActive': () => wallets,
      'autoTrading.getConfig': () => state.config,
      'autoTrading.getWatcherStatus': () => state.watcherStatus,
      'autoTrading.getActiveExecutions': () => state.activeExecutions,
      'autoTrading.getExecutionHistory': () => state.executionHistory,
      'autoTrading.getBtcTrendStatus': () => ({ trend: 'neutral', interval: '30m' }),
      'autoTrading.getBatchFundingRates': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getRotationHistory': () => [],
      'autoTrading.getFilteredSymbolsForQuickStart': () => ({
        filteredSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        maxAffordableWatchers: 20,
        btcTrend: null,
        skippedTrend: [],
      }),
      'autoTrading.getDynamicSymbolScores': () => [],
      'autoTrading.getTopCoinsByMarketCap': () => [],
      'autoTrading.getTopSymbols': () => [],
      'autoTrading.updateConfig': (input) => {
        Object.assign(state.config, input);
        return state.config;
      },
      'autoTrading.startWatcher': (input: any) => {
        state.watcherStatus.activeWatchers.push({
          watcherId: `w-${Date.now()}`,
          symbol: input.symbol,
          interval: input.interval,
          marketType: input.marketType ?? 'FUTURES',
        });
        return { success: true };
      },
      'autoTrading.startWatchersBulk': (input: any) => {
        for (const symbol of input.symbols) {
          state.watcherStatus.activeWatchers.push({
            watcherId: `w-${symbol}-${Date.now()}`,
            symbol,
            interval: input.interval,
            marketType: input.marketType ?? 'FUTURES',
          });
        }
        return { startedCount: input.symbols.length };
      },
      'autoTrading.stopWatcher': (input: any) => {
        state.watcherStatus.activeWatchers = state.watcherStatus.activeWatchers.filter(
          (w) => !(w.symbol === input.symbol && w.interval === input.interval),
        );
        return { success: true };
      },
      'autoTrading.stopAllWatchers': () => {
        state.watcherStatus.activeWatchers = [];
        return { success: true };
      },
      'autoTrading.emergencyStop': () => {
        state.watcherStatus.activeWatchers = [];
        return { success: true };
      },
      'autoTrading.triggerSymbolRotation': () => ({ success: true }),
    },
  });
};
```

The mutable `state` closure is the same trick the Screener spec uses for `savedScreeners`. It works in `installTrpcMock` (chromium) because resolvers run node-side. For the Electron spec, **don't** rely on closures — pass plain values via `installTrpcMockOnContext` (functions get serialized via `.toString()` and lose their closure variables).

## Critical files (consolidated)

- `apps/electron/src/renderer/components/AutoTrading/AutoTradingSidebar.tsx` — sidebar shell
- `apps/electron/src/renderer/components/MarketSidebar/tabs/{WatchersTab,LogsTab}.tsx`
- `apps/electron/src/renderer/components/Trading/{StartWatchersModal,AddWatcherDialog,BulkSymbolSelector,DynamicSymbolRankings}.tsx`
- `apps/electron/src/renderer/components/Trading/WatcherManager/index.tsx` + all sibling section files
- `apps/electron/src/renderer/components/Settings/{SettingsDialog,AutoTradingTab}.tsx`
- `apps/electron/src/renderer/components/Layout/Toolbar.tsx` (lines 282–291 — `LuBot` trigger)
- `apps/electron/src/renderer/store/uiStore.ts` — auto-trading slice (lines 48–53, 87–89)
- `apps/electron/src/renderer/hooks/useBackendAutoTrading.ts` — central hook
- `apps/electron/src/renderer/hooks/useAutoTradingLogs.ts` — log-buffer hook
- `apps/electron/src/renderer/components/Trading/WatcherManager/hooks/{useWatcherConfig,useWatcherState}.ts`
- `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx` (lines 115–190 — socket invalidations)
- `apps/electron/e2e/screener-modal-flow.spec.ts` — closest reference for spec shape
- `apps/electron/e2e/electron/screener-modal.spec.ts` — closest reference for the Electron spec
- `apps/electron/e2e/helpers/{trpcMock,socketBridge,chartTestSetup,klineFixtures}.ts`
- `docs/BROWSER_TESTING.md` Layer 4

## Dev-side prep work (do FIRST, before writing specs)

These tiny renderer changes unblock the test plan and should land in the same commit (or a precursor commit on the same branch):

1. **Expose `__uiStore` on `window`** when `IS_E2E_BYPASS_AUTH`. Same pattern as `__indicatorStore` / `__priceStore`. Wire it in `apps/electron/src/renderer/main.tsx` (or wherever the existing bridge declarations live — search for `__indicatorStore =`).
2. **Audit Selects inside StartWatchersModal / AddWatcherDialog** for `usePortal={false}`. If any are missing the prop, add it. (Bug fix — same rule the Screener modal already follows.)
3. **Verify `wallet.listActive`** is in the default mock map of `apps/electron/e2e/helpers/trpcMock.ts:12-49`. It's already there. ✅

## Verification gauntlet (run on the final PR)

```bash
pnpm --filter @marketmind/types build
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint            # 0 errors required
pnpm --filter @marketmind/backend lint
pnpm --filter @marketmind/backend test             # floor: 5,366 (don't regress)
pnpm --filter @marketmind/electron test:unit       # floor: 1,818 (will lift to 1,818 + N)
lsof -nP -iTCP:5173 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null
VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test    # floor: 103 (will lift to 103 + ~70)
```

Last-mile: also run `pnpm --filter @marketmind/electron run build:main && VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron exec playwright test --project=electron --reporter=list` to confirm the new Electron spec is green.

## Risk register

- **Polling collisions** — `getWatcherStatus` polls every ~5s. Tests that assert "no new fetch" between actions must use a tight time window or the polling will spuriously trigger a hit. Prefer **deltas** (`before` / `after` action), never absolute counts.
- **`updateConfig` mutation race** — multiple sliders fire `updateConfig` on `onValueChangeEnd`. If a test wiggles two sliders quickly, two pending mutations may settle out of order. Add `await expect.poll(...)` for each mutation hit count instead of asserting both at once.
- **`Select inside Dialog` rule** — same trap. Audit all auto-trading Selects (StartWatchersModal, AddWatcherDialog, WatcherManager interval Selects) for `usePortal={false}`. Bug fix, not a paper-over.
- **Wallet hydration** — every spec must seed `activeWalletId` before opening the sidebar/modal. If `__uiStore` exposure isn't already done, the spec will hit the no-wallet empty state and most assertions will fail.
- **Settings dialog open path** — find a deterministic way to open it (keyboard shortcut, gear button, etc.). If no shortcut exists, expose one via `__uiStore` or directly toggle the `isOpen` state via a window helper.
- **Socket bridge timing** — `waitForSocket(page, { event, minListeners: 1 })` is mandatory before emitting events; otherwise the listener may not be registered yet and the emit gets dropped. Same trap as Backtest's progress-event tests.
- **Chakra Tabs accessibility** — `Tabs.Trigger value="watchers"` may render with `[role=tab][aria-selected=true|false]`. Use that for active-tab assertions instead of color/style.

## Out of scope

- `DynamicSymbolRankings` dialog deep coverage — assert it opens, defer interior to a follow-up.
- `ScalpingDashboard` and the entire `scalping` tab — separate feature with its own watchers + signals + DOM ladder; deserves its own plan.
- `BulkSymbolSelector` deep filtering UX — assert basic open/close + at least one select; the symbol-search interaction is its own complexity layer.
- Backend-side coverage — the `autoTradingService`, `BinanceFuturesUserStream`, `position-sync`, `OCO` are already covered by testcontainers integration tests in `apps/backend/src/__tests__`. No backend changes shipping in this PR.
- Real exchange integration — these specs run entirely against mocked tRPC + the socket test bridge. No live Binance/IB connection.
- Auto-trading scheduler internals — the renderer doesn't directly observe scheduler state; specs target only what's reachable through `getWatcherStatus` polling + socket events.
- Permission/role checks — `protectedProcedure` is bypassed by `installTrpcMock` returning the synthetic e2e user.

## Pause-and-ask triggers

- **Settings dialog opener** — if there's no obvious trigger (keyboard shortcut + visible button), confirm with the user how to open it before writing File 6. May need to add a window-side test helper.
- **`__uiStore` exposure on window** — the bridge change is small but touches the renderer. Confirm the user is fine landing it in the same PR (it's gated on `IS_E2E_BYPASS_AUTH` so production unaffected).
- **`updateConfig` payload schema** — the full shape is huge. If the mock's merge logic disagrees with the actual server validation, some tests may fail with "input validation error". Pivot to: mock returns the input echoed back without validation; only assert the renderer-side behavior, not the server-side input shape.
- **Polling interval interference** — if `getWatcherStatus` polling makes hit-count assertions flaky, consider stubbing `usePollingInterval` to return a much higher interval (e.g. 60_000ms) for tests via a `__pollingInterval` window override.
- **Filter section completeness** — the `FiltersSection` has ~15 filter flags. Confirm with the user which are worth covering per-flag vs. asserting in aggregate ("any flag toggle fires `updateConfig`").

---

**Estimated size:** 8 spec files × 5–10 tests each = ~70 e2e specs. Plus 5–10 uiStore unit tests. ~80 new tests on top of the current 1,818 unit + 103 e2e floor.

**Estimated branch lifetime:** 1–2 days of focused iteration, depending on how much of the dev-side prep work (window bridge for `__uiStore`, Settings opener) needs to happen first.
