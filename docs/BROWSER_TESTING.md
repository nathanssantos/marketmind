# Browser Testing & Automation

This document describes the browser-automation surface wired up for the repo. It has four layers, each usable on its own.

| Layer | What it is | When to use |
|---|---|---|
| 1. Playwright MCP server | Global MCP, drives a generic Chromium from any agent | Ad-hoc "go look at this page" work, console/network inspection, screenshots |
| 2. Chart perf harness | `apps/electron/e2e/perf/` — Playwright specs that exercise the real chart with mocked tRPC | Reproducible FPS / p95 frame / render-rate numbers, regression checks |
| 3. Feature E2E specs | `apps/electron/e2e/*.spec.ts` — Playwright specs covering full user flows + runtime bridges (drawings, stream health, wallet, trading) | Behavioral regression tests that need real DOM + canvas + socket events |
| 4. Electron smoke | `apps/electron/e2e/electron/` — `_electron.launch()` against `dist-electron/main/index.js` | Preload bridge, IPC, packaged-build sanity |

All four rely on the renderer-only `VITE_E2E_BYPASS_AUTH=true` flag to skip `AuthGuard` + `useBackendAuth`. In prod builds the branch is dead-code-eliminated — zero runtime cost.

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
- `apps/electron/e2e/perf/sibling-renders.spec.ts` — sentinel tests that assert non-chart React components (`Portfolio`, `OrdersList`) don't balloon past a fixed re-render ceiling under hot-path drivers. Relies on `perfMonitor.recordComponentRender` calls at the top of each instrumented component.
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
| `kline-append` | `appendKline(page, TestKline)` every 500ms | Same cache path but array grows (new-bar case). |
| `pan-drag-loop` | `drivePan(page, frames, amplitudePx)` — synthetic `mousedown` + rAF-paced `mousemove` + `mouseup` | Viewport-driven redraw (`manager.pan`, dirty-rect invalidation). `renderRate` here is expected to stay near 0 because pan bypasses React. |
| `wheel-zoom-loop` | `driveWheelZoom(page, frames, deltaPx)` — alternating `wheel` events | Zoom path — range recalculation, bounds cache, indicator recompute on viewport change. |
| `indicator-churn` | `addIndicators` / `clearIndicators` cycled every few frames | Mount / unmount cost for indicator instances (`IndicatorEngine` init, panel layout, overlay renderer wiring). |

**Driver helper contract.** All drivers are `page.evaluate` wrappers over `window.__*` stores or Playwright's synthetic input:
- `pushPriceTicks` uses `window.__priceStore.getState().updatePriceBatch(Map)`. Note: `usePriceStore` is **not** subscribed via selectors by `ChartCanvas` — the chart uses an imperative `subscribe()` callback — so this scenario primarily stresses the store itself and any React selectors in sibling components.
- `updateLatestKline` / `appendKline` mutate the React Query cache via `window.__queryClient.setQueriesData({predicate})`. The predicate matches any query keyed on `['kline', 'list']`.
- `drivePan` / `driveWheelZoom` use Playwright's real `page.mouse.*` API, so they go through the same canvas event listeners the app uses in production. Each call interleaves a `requestAnimationFrame` wait so the render loop gets a chance to run between inputs.

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
| `window.__drawingStore` | `utils/e2eBridge.ts` | drawing seeds, tool activation (`drawing-pan.spec.ts`) |
| `window.__connectionStore` | `utils/e2eBridge.ts` | `setWsConnected` — force WS state when no backend is running |
| `window.__canvasManager` | `utils/e2eBridge.ts` (via `exposeCanvasManagerForE2E` in `ChartCanvas` effect) | Read viewport from E2E (`drawing-pan.spec.ts`) |
| `window.__isPanning` | `utils/e2eBridge.ts` (via `exposeIsPanningForE2E` in `ChartCanvas` effect) | Regression guard for pan-stuck bugs |
| `window.__socket` | `services/socketService.ts` (via `exposeSocketForE2E` on connect/disconnect) | Direct socket inspection |
| `window.__socketTestBridge` | `utils/e2eBridge.ts` (paired with `exposeSocketForE2E`) | `emitSocketEvent` — simulate any backend event in E2E |
| `window.__queryClient` | `components/TrpcProvider.tsx` effect | `updateLatestKline`, `appendKline` |

The `e2eBridge.ts` exposures and the `TrpcProvider` queryClient bridge are gated on `IS_E2E_BYPASS_AUTH`; prod builds dead-code-eliminate both via Vite's `import.meta.env.VITE_*` inlining.

### Reading perfMonitor output

`readPerfSnapshot(page)` returns `PerfSnapshot`:
- `enabled` — mirrors `localStorage('chart.perf') === '1'`. Always assert this is `true` first; a `false` run means the overlay flag didn't stick (the helper `refreshPerfFlag` resyncs it after navigation).
- `fps` — rolling 1s window. `driveFrames` paces synthetic mousemove events at rAF rate, which caps effective framerate around 25-30 in headless Chromium. Don't chase higher — assert `≥ 20`.
- `lastFrameMs` — wall time of most recent frame. Spikes here point at per-frame stalls.
- `sections[]` — sorted by `lastMs` desc. Named per-pass costs (`klines`, `overlayIndicators`, `panelIndicators`, `grid`, `orderLines`, …). First entry is the slowest; assert `slowestSectionMs(snap) ≤ 25` as a floor, widen per scenario only when justified.
- `componentRenders[]` — sorted by `ratePerSec` desc. Use `componentRenderRate(snap, 'ChartCanvas')` to read a specific component's rate. Always assert on rate, not absolute count.
- `droppedFrames` — count of frames where `lastFrameMs > 33` (i.e. sub-30 fps instantaneous). Incremented in `endFrame`, reset by `reset()`. Stable scenarios should hold this at `0`; a baseline going non-zero is a real signal.
- `longSections` — count of individual `measure()` calls where a section took `> 16ms` (one 60 fps frame). Captures spikes even when `fps` looks fine because the expensive section only landed once.

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

## Layer 3 — Feature E2E specs

`apps/electron/e2e/*.spec.ts` covers user-flow regression tests. These specs run against the real Vite dev server (same as perf) with mocked tRPC, and drive synthetic mouse/keyboard input and synthetic socket events — **no real backend required**.

### Run

```bash
# single spec
npx playwright test --project=chromium e2e/stream-health.spec.ts

# all feature specs
pnpm --filter @marketmind/electron test:e2e
```

### What's in it

| Spec | What it covers |
|---|---|
| `drawing-pan.spec.ts` | Guard against the "chart pans after drawing" regression — 2-click + drag-release ray flows both asserted `__isPanning === false` afterward |
| `stream-health.spec.ts` | Chart-header degradation dot — fires synthetic `stream:health` / `kline:update` events via the socket test bridge, asserts dot visibility + hide-debounce + flicker immunity |
| `trading-flow.spec.ts` | End-to-end trading interactions (symbol selector, chart mount, order placement UI) |
| `wallet-management.spec.ts` | Wallet picker + CRUD flows with the sidebar exposed |

### Socket test bridge (simulate any backend event)

The frontend connects to the backend via `socket.io-client`. In E2E mode there is no backend running, so `socketService.ts` exposes the socket instance on `window.__socket` + a helper bridge on `window.__socketTestBridge` that lets tests invoke the real listeners directly.

Playwright helpers in `apps/electron/e2e/helpers/socketBridge.ts`:

```ts
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

// 1. force the connection-state flag (hooks that gate on isConnected bail without this)
await setWsConnected(page, true);

// 2. wait until a hook has actually registered a listener
await waitForSocket(page, { event: 'stream:health' });

// 3. fire the event — all registered handlers run synchronously
await emitSocketEvent(page, 'stream:health', {
  symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
  status: 'degraded', reason: 'binance-stream-silent',
  lastMessageAt: Date.now(),
});

// Also available for diagnosing: listSocketEvents(page) returns names of
// every event with at least one listener attached.
```

The bridge walks `socket.listeners(event)` and invokes each callback with the payload — same effect as if the backend had emitted the event, without any network round-trip. Any future spec that needs to simulate `order:update`, `setup-detected`, `price:update`, etc. uses the same one-liner.

### Canvas + pan state probes

`exposeCanvasManagerForE2E` and `exposeIsPanningForE2E` (wired in `ChartCanvas` effects under the bypass flag) put the live `CanvasManager` and `isPanning` boolean on `window`. Tests can read viewport or assert on pan state without digging into React internals:

```ts
const viewport = await page.evaluate(() => window.__canvasManager?.getViewport());
const isPanning = await page.evaluate(() => window.__isPanning);
```

### Adding a new feature E2E spec

1. Start from the beforeEach pattern in `stream-health.spec.ts`:
   ```ts
   await installTrpcMock(page, { klines });
   await page.goto('/');
   await waitForChartReady(page);
   await waitForE2EBridge(page);
   await setWsConnected(page, true);        // only if your spec uses the socket
   await waitForSocket(page, { event: X }); // only if your spec uses the socket
   ```
2. Drive state via the `window.__*` bridges (stores) or `emitSocketEvent` (backend events).
3. Assert via Playwright locators on visible DOM (`getByTestId`, `getByRole`, etc.) or via `page.evaluate` reading bridge state.
4. Kill any stale `vite` dev server on port 5173 before running tests — Playwright's `reuseExistingServer: !CI` will reuse a server that was started without the bypass flag.

---

## Layer 4 — Electron smoke

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

---

## Writing a new browser test

Browser tests live next to the source they cover, suffixed `.browser.test.ts(x)`, and run via `pnpm --filter @marketmind/electron test:browser:run` on the Playwright-backed vitest provider (real Chromium, real DOM, real canvas). Use them **only** where jsdom is demonstrably insufficient — Canvas pixel math, `getBoundingClientRect`, font metrics, hit-testing. Everything else should stay in jsdom.

### Pattern A — isolated pure function / renderer

Best for pixel-drawing renderers and viewport math. No React, no full chart mount.

```ts
// apps/electron/src/renderer/components/Chart/ChartCanvas/renderers/renderFVG.browser.test.tsx
import { describe, expect, test } from 'vitest';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { renderFVG } from './renderFVG';

const makeCtx = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);
  const manager = new CanvasManager(canvas);
  return { manager, ctx: canvas.getContext('2d')! };
};

test('unfilled gap created before visible window still renders', () => {
  const { manager, ctx } = makeCtx();
  renderFVG({ manager, /* viewport, klines, indicators */ });
  // Read pixel at expected zone coords — value != 0 means drawn.
  const { data } = ctx.getImageData(200, 150, 1, 1);
  expect(data[3]).toBeGreaterThan(0);
});
```

Key rules:
- Mount the canvas in `document.body` — otherwise `getBoundingClientRect` returns zeros.
- Use `ctx.getImageData` to assert on pixels, not on internal function calls.
- Clean up between tests with `afterEach(() => document.body.innerHTML = '')`.

### Pattern B — hook under `renderHook`

Best for hooks that touch pointer events or layout measurements. Uses `@testing-library/react`'s `renderHook` plus synthetic input dispatched on real DOM.

```tsx
// apps/electron/src/renderer/components/Chart/useOrderDragHandler.browser.test.tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useOrderDragHandler } from './useOrderDragHandler';

test('drag SL 20px up updates order at yToPrice(newY)', async () => {
  const updateOrder = vi.fn();
  const yToPrice = vi.fn((y: number) => y);
  const hook = renderHook(() =>
    useOrderDragHandler({ orders: [/* ... */], updateOrder, yToPrice, /* ... */ }),
  );
  // Dispatch mousedown/mousemove/mouseup via document.dispatchEvent(...)
  await act(async () => { /* dispatch + wait two rAF */ });
  expect(updateOrder).toHaveBeenCalledWith(expect.objectContaining({ stopLoss: 180 }));
});
```

Key rules:
- Wait two `requestAnimationFrame` ticks (`waitTwoFrames()`) after pointer events — the chart throttles on rAF.
- Assert on callback args (`updateOrder` invocation), not on internal hook state. Testing internals means the test fails on any refactor, even when behavior is preserved.

### What doesn't belong here

- Anything that fits in jsdom — keep those in `*.test.ts(x)`. The browser provider is slower and costs a Playwright browser per run.
- Full-app E2E flows — those belong in `apps/electron/e2e/*.spec.ts` against the Vite dev server with `VITE_E2E_BYPASS_AUTH=true`.
- Perf assertions — those belong in `apps/electron/e2e/perf/` against the full chart with the perf overlay enabled.

### Where the browser tests currently live

| File | What it exercises |
|---|---|
| `ChartCanvas.browser.test.tsx` | End-to-end chart mount — baseline render + resize |
| `useOrderDragHandler.browser.test.tsx` | SL/TP pixel drag → `yToPrice` conversion, clamping, disable prefs |
| `ChartCanvas/renderers/renderFVG.browser.test.tsx` | FVG zone pixel sampling, viewport-culling regression |
| `ChartCanvas/renderers/renderFibonacci.browser.test.tsx` | Fibonacci "nearest" pivot-selection regression, level hit-testing |
| `utils/canvas/ViewportNavigator.browser.test.ts` | `clientX - rect.left` pixel → data-index math |
