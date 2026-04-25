# Chart performance baseline

How to capture metrics before/after each wave of the chart performance overhaul (`/Users/nathan/.claude/plans/agora-outra-tarefa-adaptive-dolphin.md`).

## Tooling

- **`chart.perf` overlay** (`apps/electron/src/renderer/components/Chart/ChartPerfOverlay.tsx`). Toggle in DevTools console:
  ```js
  localStorage.setItem('chart.perf', '1');
  // reload
  ```
  Disable: `localStorage.removeItem('chart.perf'); location.reload()`.

- **Global handle**: `window.__mmPerf` exposes the singleton `PerfMonitor`. Useful for snapshotting numbers from DevTools or scripted captures:
  ```js
  __mmPerf.reset();                       // zero counters
  // ... run scenario for 60 s ...
  copy(JSON.stringify(__mmPerf.getSnapshot(), null, 2));
  ```

The overlay shows, in order: FPS, last frame ms, dropped-frame count, long sections (>20 ms), section timings (last/avg ms), **per-instance ChartCanvas render rate**, **store wakes/s**, **socket handlers/s** (sum of handler invocations per dispatched event).

## Measurement scenario

Use this exact recipe before/after each wave so numbers compare apples-to-apples.

1. Cold start the app: `pnpm dev` (or the Electron binary). Sign into a paper / testnet wallet so trading data wires up.
2. Open DevTools → Console: `localStorage.setItem('chart.perf', '1');` then reload.
3. Configure the layout to the **2×2 grid preset**, with these symbols + timeframes (one per panel):
   - **BTCUSDT** — 1m
   - **ETHUSDT** — 5m
   - **SOLUSDT** — 15m
   - **BNBUSDT** — 1h
4. Wait ~10 s for backfill + initial subscription churn to settle.
5. Run `__mmPerf.reset()` in DevTools.
6. Let the grid stream **untouched** (no mouse hover, no drag, no focus change) for **60 seconds**.
7. Capture: `copy(JSON.stringify(__mmPerf.getSnapshot(), null, 2));` and paste into the table below.

For interaction-sensitive metrics, repeat the recipe with these specific user actions over a 60-s window:
- **Hover scenario**: hover over chart A continuously, no other input.
- **Focus-switch scenario**: click panel A, then B, then C, then D, then back to A — once every 10 s.
- **Pan scenario**: pan chart A horizontally with mouse drag, no other input.

## Baseline (pre-Wave 1)

> Fill these numbers **after** Wave 0 lands and before Wave 1 starts. The rows must match exactly so per-wave deltas are comparable.

### Idle (60 s, 2×2 grid streaming, no input)

| Metric | Target | Pre-Wave 1 |
| --- | --- | --- |
| FPS | 55+ | _TBD_ |
| Last frame ms | <16.7 | _TBD_ |
| Dropped frames | 0 | _TBD_ |
| `ChartCanvas#BTCUSDT@1m` renders/s | low | _TBD_ |
| `ChartCanvas#ETHUSDT@5m` renders/s | low | _TBD_ |
| `ChartCanvas#SOLUSDT@15m` renders/s | low | _TBD_ |
| `ChartCanvas#BNBUSDT@1h` renders/s | low | _TBD_ |
| `priceStore` wakes/s | low (per-symbol after Wave 2) | _TBD_ |
| `setupStore` wakes/s | low | _TBD_ |
| `strategyVisualizationStore` wakes/s | low | _TBD_ |
| `tooltipStore.full` wakes/s | low | _TBD_ |
| `tooltipStore.klineIndex` wakes/s | low | _TBD_ |
| `kline:update` handlers/s | ~N×ticks (see note) | _TBD_ |
| `price:update` handlers/s | ~N×ticks | _TBD_ |

> Note: socket-handler counts are per dispatched RAF flush; `socketBus` already coalesces high-rate events to one frame per (event, symbol[, interval]). With 4 charts + 4 symbols streaming klines at ~1-2 Hz each, expect roughly `4 charts × 4 symbols × 1 Hz ≈ 16 handlers/s` baseline for `kline:update` (each chart filters internally).

### Hover-on-A (60 s, hovering chart A only)

| Metric | Pre-Wave 1 |
| --- | --- |
| `ChartCanvas#A` renders/s | _TBD_ |
| `ChartCanvas#B/C/D` renders/s | _TBD_ |
| `tooltipStore.full` wakes/s | _TBD_ |
| `tooltipStore.klineIndex` wakes/s | _TBD_ |

### Focus-switch (60 s, switching focus across panels)

| Metric | Pre-Wave 1 |
| --- | --- |
| `ChartGridPanel` renders/s (each panel) | _TBD_ |

## Per-wave targets

After each wave, re-run the recipe and add a column. Wave-specific exit criteria:

- **Wave 1**: per-chart `ChartCanvas` renders/s drops to a small constant (only mount + viewport/timeframe changes). Idle frame time unchanged or better.
- **Wave 2**: `priceStore` wakes/s for chart A drops to `~ticks/s of chart A's symbol only` (not all symbols combined). `strategyVisualizationStore` and `setupStore` wakes/s drop ~10× when their respective slice is unchanged.
- **Wave 3**: hovering / focus-switching no longer wakes `ChartGridPanel` for unaffected panels.
- **Wave 4**: long-section count drops; resize bursts no longer block the frame budget; `markDirty('overlays')` is replaced by finer flags so mouse-move only redraws the crosshair.
- **Wave 5**: mouse-move-driven sections shrink; drawing toolbar no longer re-renders on unrelated drawing-store updates.
- **Wave 6**: order-line section time shrinks proportional to the number of *changed* orders, not total orders.
- **Wave 7**: trading-query refetch frequency drops; `getActiveExecutions` only refetches when an execution for that chart's symbol changes.
- **Wave 8**: cleanup; no targeted metric.

## Caveats

- The overlay itself is enabled by a flag — disabled it has zero overhead (every record method early-returns). Numbers measured with the overlay ON are roughly representative of OFF, but the overlay's own `useSyncExternalStore` does add a couple renders per second for its DOM updates. Filter that out when reading rates.
- Browser/Electron paint costs are not captured here — use Chromium DevTools' Performance recorder for a layout/paint flame chart if a bottleneck is suspected outside the JS render path.
- Hot-reload during `pnpm dev` adds noise. Always reload the page (`Cmd+R`) before a measurement run.
