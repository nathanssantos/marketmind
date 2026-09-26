# Chart pan cadence

How to measure what a user feels when dragging or zooming the chart, and what the measurements say about the current renderer. The existing perf harness (`docs/BROWSER_TESTING.md`, layer 2) reports JS time per render section and a summed FPS. Neither can see a chart that renders too rarely or with uneven spacing, which is what "grainy" panning is. This doc adds the missing view.

## What "fluid" means in numbers

A drag feels fluid when three things hold at the same time:

1. **The chart repaints on every display refresh it can afford.** On a 120 Hz display that is one render every 8.3 ms; on 60 Hz, every 16.7 ms.
2. **Consecutive renders are evenly spaced.** Alternating 33 ms and 50 ms gaps reads as judder even when the average is fine. The p95 of the render-to-render gap should sit close to the p50.
3. **The main thread is not blocked.** No long animation frames, and the page's own `requestAnimationFrame` cadence matches the display.

The probe measures all three directly instead of inferring them from section timings.

## Tooling

- `apps/electron/e2e/helpers/frameProbe.ts` — in-page probe. It wraps `__mmPerf.endFrame` to timestamp every chart render, runs its own rAF loop to record the vsync cadence the page gets, records `mousemove` timestamps while a button is held, times `snapshotBaseLayer` / `restoreBaseLayer` on the exposed `__canvasManager`, and observes `long-animation-frame` and `longtask` entries. `stopFrameProbe` returns a `FrameProbeReport`.
- `apps/electron/e2e/perf/pan-cadence.spec.ts` — the scenario matrix. Every scenario loads a deterministic single-chart layout through the `layout.get` mock, warms up with a 1 s drag, then measures a steady 3 s drag (triangle wave, ~8 ms between input events) or a steady wheel zoom.

```bash
pnpm --filter @marketmind/electron test:perf:cadence                 # headless, all scenarios
pnpm --filter @marketmind/electron exec playwright test --project=perf e2e/perf/pan-cadence.spec.ts --headed --grep "pan-10k:"
PAN_CADENCE_TAG=my-change pnpm --filter @marketmind/electron test:perf:cadence   # tag result keys for an A/B
```

Results go to the git-ignored `apps/electron/e2e/perf/pan-cadence-last-run.json`, one entry per scenario key (suffixed with `@<tag>` when `PAN_CADENCE_TAG` is set), and one summary line per scenario on stdout.

### Scenarios

| Key | What it isolates |
|---|---|
| `pan-500` | Small dataset, idle: the floor of the render loop itself |
| `pan-10k` | The app's real initial load (10,000 klines) |
| `pan-10k-zoomed-out` | ~1.5k visible candles: per-candle draw cost |
| `pan-10k-live` | Live streams (kline, price, bookTicker, depth, scalping) arriving during the drag |
| `pan-10k-indicators` | Overlay indicators (SMA 20, EMA 50) |
| `pan-10k-live-2x2` | Four charts with live streams: sibling contention |
| `wheel-10k` | Wheel zoom in/out at ~60 Hz instead of a drag |
| `pan-10k-dpr2` | Device pixel ratio 2 (Retina): raster and copy cost |

### Metrics per scenario

| Field | Meaning |
|---|---|
| `renders.perSec`, `renders.p50/p95/max` | Render-to-render gap during the gesture. This is the number that maps to what the eye sees. |
| `renders.over34ms` | Gaps longer than two 60 Hz frames: the visible stutters |
| `renderJsMs` | JS time inside the render callback (`perfMonitor` frame time) |
| `baseSnapshotMs`, `baseRestoreMs` | Time spent copying the base layer to/from the offscreen snapshot |
| `raf.nominalMs`, `raf.missedPct` | The vsync interval the page actually receives, and how often the page missed one. `missedPct` near 0 with a low `renders.perSec` means the renderer chose not to draw, not that it could not. |
| `inputToRenderMs` | Age of the latest processed input when a render finished |
| `longAnimationFrames`, `longTasks` | Main-thread blocking during the gesture, with the top scripts by duration |
| `heapDeltaMB` | JS heap growth over the gesture: allocation churn and GC pressure |
| `inputHz` | Achieved input event rate. It drops when the renderer starves the CDP input round-trip, so it doubles as a load indicator. |

Headless Chromium on this machine reports the display's real vsync (about 8 ms on a 120 Hz panel), so headless numbers are comparable with headed ones for cadence. Run headed for the GPU-side truth of a given display and DPR.

## Findings (2026-09-26, `develop` at 691ccd3d)

Measured on an Apple Silicon MacBook Pro with a 120 Hz internal display. Each configuration below is one run of the matrix; `budget` is `CanvasManager.viewportFrameTime` / `overlayOnlyFrameTime` (33 ms on `develop`), `lazy` skips `snapshotBaseLayer()` while `isRecentlyPanning()` is true.

Configurations:

| Tag | budget (ms) | snapshot | window |
|---|---|---|---|
| `final33` | 33 (as on `develop`) | every base render | headless |
| `final16` | 16 | every base render | headless |
| `final0` | 0 | every base render | headless |
| `final16-lazy` | 16 | skipped while panning | headless |
| `final0-lazy` | 0 | skipped while panning | headless |
| `*-headed` | as above | as above | headed, on the 60 Hz external display |

Input events arrive at about 60 Hz in every run (the CDP round-trip caps the synthetic mouse), so 60 renders/s is the ceiling a scenario can reach here. The headless runs see the 120 Hz internal panel (vsync 8 ms); the headed runs landed on the 60 Hz external display (vsync 16 ms).

### final33

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-500 | 1 | 65 | 28.9 | 33.6 / 41.5 / 42.3 | 24 | 1.3 | 1.0 | 7.9 / 0.0 | 15.2 |
| pan-10k | 1 | 65 | 28.9 | 33.4 / 41.3 / 42.6 | 17 | 2.0 | 1.5 | 8.0 / 0.3 | 14.9 |
| pan-10k-zoomed-out | 1 | 1533 | 27.9 | 34.0 / 41.9 / 46.8 | 41 | 3.0 | 1.6 | 8.0 / 0.3 | 13.6 |
| pan-10k-live | 1 | 65 | 29.0 | 33.5 / 41.2 / 41.8 | 22 | 2.0 | 1.6 | 8.0 / 0.0 | 15.5 |
| pan-10k-indicators | 1 | 65 | 28.9 | 33.6 / 41.2 / 42.7 | 23 | 2.2 | 1.9 | 7.9 / 0.3 | 15.1 |
| pan-10k-live-2x2 | 4 | 65 | 93.1 | 7.1 / 33.7 / 41.8 | 12 | 0.1 | 0.0 | 8.1 / 0.3 | 26.0 |
| wheel-10k | 1 | 65 | 28.8 | 33.5 / 41.2 / 42.2 | 26 | 2.4 | 1.5 | 8.2 / 0.0 | 53.2 |
| pan-10k-dpr2 | 1 | 65 | 28.7 | 33.7 / 41.8 / 44.1 | 29 | 5.1 | 4.8 | 8.2 / 0.3 | 14.3 |

### final16

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-500 | 1 | 65 | 56.4 | 16.8 / 24.7 / 25.6 | 0 | 1.6 | 1.3 | 8.2 / 0.0 | 20.6 |
| pan-10k | 1 | 65 | 57.1 | 16.7 / 24.4 / 26.4 | 0 | 1.6 | 1.3 | 7.9 / 0.0 | 20.4 |
| pan-10k-zoomed-out | 1 | 1533 | 54.0 | 16.8 / 25.0 / 27.7 | 0 | 2.3 | 1.2 | 8.1 / 0.3 | 11.6 |
| pan-10k-live | 1 | 65 | 57.1 | 16.7 / 24.2 / 25.6 | 0 | 1.5 | 1.2 | 7.9 / 0.0 | 21.2 |
| pan-10k-indicators | 1 | 65 | 55.8 | 16.8 / 24.5 / 26.2 | 0 | 1.7 | 1.3 | 7.8 / 0.0 | 20.3 |
| pan-10k-live-2x2 | 4 | 65 | 116.6 | 7.1 / 23.2 / 26.3 | 0 | 0.2 | 0.0 | 8.0 / 0.3 | -1.5 |
| wheel-10k | 1 | 65 | 30.4 | 33.3 / 34.3 / 34.6 | 8 | 1.5 | 1.0 | 8.2 / 0.0 | 43.2 |
| pan-10k-dpr2 | 1 | 65 | 39.5 | 25.0 / 26.5 / 33.1 | 0 | 4.6 | 4.3 | 8.0 / 0.0 | 16.9 |

### final0

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-500 | 1 | 65 | 59.2 | 16.7 / 17.6 / 25.5 | 0 | 1.3 | 1.0 | 8.2 / 0.0 | 21.0 |
| pan-10k | 1 | 65 | 59.3 | 16.7 / 17.7 / 25.1 | 0 | 1.2 | 0.9 | 8.1 / 0.0 | 20.8 |
| pan-10k-zoomed-out | 1 | 1533 | 58.9 | 16.7 / 17.7 / 33.2 | 0 | 1.9 | 1.1 | 8.1 / 0.0 | 20.5 |
| pan-10k-live | 1 | 65 | 59.4 | 16.7 / 17.6 / 25.0 | 0 | 1.3 | 1.0 | 8.2 / 0.0 | 21.7 |
| pan-10k-indicators | 1 | 65 | 59.7 | 16.7 / 17.5 / 17.8 | 0 | 1.2 | 0.9 | 8.1 / 0.0 | 20.8 |
| pan-10k-live-2x2 | 4 | 65 | 118.6 | 7.2 / 17.9 / 25.8 | 0 | 0.2 | 0.0 | 8.2 / 0.0 | -8.5 |
| wheel-10k | 1 | 65 | 30.2 | 33.3 / 34.1 / 34.4 | 5 | 1.7 | 1.1 | 8.2 / 0.0 | 35.8 |
| pan-10k-dpr2 | 1 | 65 | 39.5 | 25.0 / 26.4 / 34.9 | 1 | 3.9 | 3.6 | 8.2 / 0.3 | 16.9 |

### final16-lazy

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-500 | 1 | 65 | 55.8 | 16.7 / 25.0 / 33.2 | 0 | 0.3 | 0.0 | 7.9 / 0.0 | 20.3 |
| pan-10k | 1 | 65 | 52.2 | 16.7 / 25.1 / 58.3 | 1 | 0.3 | 0.0 | 7.9 / 0.0 | 19.7 |
| pan-10k-zoomed-out | 1 | 1533 | 56.5 | 16.7 / 24.2 / 49.8 | 1 | 1.1 | 0.0 | 8.1 / 0.0 | 17.4 |
| pan-10k-live | 1 | 65 | 54.4 | 16.9 / 24.7 / 27.1 | 0 | 0.4 | 0.0 | 7.3 / 0.3 | 20.7 |
| pan-10k-indicators | 1 | 65 | 53.8 | 16.9 / 24.9 / 33.3 | 0 | 0.4 | 0.0 | 7.4 / 0.0 | 20.0 |
| pan-10k-live-2x2 | 4 | 65 | 113.0 | 7.8 / 23.1 / 25.9 | 0 | 0.1 | 0.0 | 7.1 / 0.3 | 29.5 |
| wheel-10k | 1 | 65 | 31.6 | 33.3 / 35.4 / 36.7 | 16 | 0.5 | 0.0 | 7.2 / 0.0 | 45.2 |
| pan-10k-dpr2 | 1 | 65 | 51.9 | 17.6 / 24.9 / 25.9 | 0 | 0.3 | 0.0 | 7.1 / 0.0 | 19.4 |

### final0-lazy

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-500 | 1 | 65 | 59.4 | 16.7 / 18.8 / 28.1 | 0 | 0.3 | 0.0 | 7.0 / 0.0 | 20.9 |
| pan-10k | 1 | 65 | 59.7 | 16.7 / 18.3 / 19.2 | 0 | 0.3 | 0.0 | 7.1 / 0.0 | 20.9 |
| pan-10k-zoomed-out | 1 | 1533 | 59.3 | 16.7 / 18.7 / 23.8 | 0 | 0.8 | 0.0 | 7.2 / 0.0 | -5.9 |
| pan-10k-live | 1 | 65 | 60.0 | 16.7 / 18.6 / 22.9 | 0 | 0.2 | 0.0 | 7.2 / 0.0 | 21.9 |
| pan-10k-indicators | 1 | 65 | 58.8 | 16.7 / 19.0 / 35.2 | 1 | 0.3 | 0.0 | 7.5 / 0.0 | 20.6 |
| pan-10k-live-2x2 | 4 | 65 | 119.8 | 7.6 / 23.2 / 42.1 | 2 | 0.1 | 0.0 | 7.3 / 0.5 | -9.3 |
| wheel-10k | 1 | 65 | 28.7 | 33.4 / 43.0 / 60.2 | 13 | 0.5 | 0.0 | 7.9 / 0.0 | 38.5 |
| pan-10k-dpr2 | 1 | 65 | 42.1 | 24.9 / 33.3 / 66.7 | 1 | 0.3 | 0.0 | 7.8 / 0.0 | 17.3 |

### final33-headed

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-10k | 1 | 65 | 28.9 | 33.3 / 48.0 / 50.1 | 9 | 0.4 | 0.1 | 16.1 / 0.0 | 15.0 |
| pan-10k-live | 1 | 65 | 27.0 | 33.4 / 49.5 / 50.3 | 33 | 0.4 | 0.1 | 15.7 / 0.0 | 14.5 |
| pan-10k-dpr2 | 1 | 65 | 27.4 | 33.4 / 49.3 / 51.5 | 28 | 0.4 | 0.1 | 15.8 / 0.0 | 14.6 |

### final16-lazy-headed

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-10k | 1 | 65 | 57.4 | 16.7 / 17.3 / 33.9 | 0 | 0.3 | 0.0 | 16.5 / 0.0 | 20.5 |
| pan-10k-live | 1 | 65 | 57.4 | 16.7 / 30.8 / 33.8 | 0 | 0.2 | 0.0 | 16.6 / 0.0 | 21.6 |
| pan-10k-dpr2 | 1 | 65 | 55.7 | 16.7 / 32.6 / 35.5 | 2 | 0.2 | 0.0 | 16.4 / 0.0 | 20.1 |

### final0-lazy-headed

| Scenario | charts | visible | renders/s | gap p50 / p95 / max ms | gaps > 34 ms | JS ms p50 | snapshot ms p50 | vsync ms / missed % | heap Δ MB |
|---|---|---|---|---|---|---|---|---|---|
| pan-10k | 1 | 65 | 59.1 | 16.7 / 17.1 / 33.4 | 0 | 0.3 | 0.0 | 16.6 / 0.0 | 20.7 |
| pan-10k-live | 1 | 65 | 51.2 | 16.7 / 33.7 / 35.0 | 5 | 0.4 | 0.0 | 15.8 / 0.0 | 20.5 |
| pan-10k-dpr2 | 1 | 65 | 53.2 | 16.7 / 33.2 / 33.9 | 0 | 0.6 | 0.0 | 15.4 / 0.0 | 20.3 |

### What the numbers say

1. **The renderer throttles itself to about 29 renders/s during every drag, on every dataset, at every zoom level.** `CanvasManager.scheduleRender` skips a frame whenever less than `viewportFrameTime` (33 ms) passed since the last render, measured with `performance.now()` inside the rAF callback. The page never misses a vsync (`missed` stays at or below 0.5 %) and JS per render is 1–3 ms, so the chart could paint every frame and chooses not to. At 60 Hz the skip lands on 2 or 3 vsyncs, so the gaps alternate between 33 and 50 ms (`final33-headed`: p50 33 ms, p95 48–50 ms). At 120 Hz it lands on 4 or 5 vsyncs (33–42 ms). Uneven 30 fps is what reads as "grainy".
2. **Dropping the budget fixes the cadence by itself.** With 16 ms or 0 ms the same scenarios render at 55–60/s with p50 16.7 ms and p95 17–25 ms, and the count of gaps above 34 ms goes to zero. The bimodal cadence that live kline ticks produced (a tick sets the `klines` flag and switches the budget to 16 ms mid-drag) disappears with it. 0 ms is marginally steadier than 16 ms on the 120 Hz panel (p95 17.6 vs 24.5 ms) because the 16 ms check still rounds up to 3 vsyncs now and then.
3. **The base-layer snapshot is most of the per-frame JS, and it is wasted during a pan.** Every base render copies the whole canvas into an offscreen canvas (`snapshotBaseLayer`) so that a later overlay-only frame can blit it back. During a drag every frame is a base render, so the copy is thrown away on the next frame. It costs 1.0–1.9 ms at DPR 1 and 4.8 ms at DPR 2, that is 75–94 % of the JS time per frame. Skipping it while `isRecentlyPanning()` cuts JS per frame to 0.3 ms and lifts the DPR 2 scenario from 39 to 52–56 renders/s.
4. **What remains after both fixes.** On the 60 Hz display, `pan-10k-live` and `pan-10k-dpr2` still show a p95 around 31–34 ms (one missed vsync now and then) while `pan-10k` sits at 17 ms. The candidates from the code map, in order: per-tick work that is not pan-aware (`mergeKlines` copies the whole array and the `avgCache` rebuild parses every kline on every live tick; `ChartPanelHeader` re-renders per tick), and the GPU cost of clearing and rasterising a 2× full-canvas every frame (`getContext('2d')` without `alpha: false` / `desynchronized: true`; no translate-and-redraw-strip path).
5. **Wheel zoom allocates 12–18 MB/s.** `wheel-10k` grows the heap by 36–53 MB in 3 s in every configuration, against 15–21 MB for a drag. Each wheel event calls `setViewport` and re-renders the whole `ChartCanvas` component, and the zoom step is a fixed ±10 % regardless of `deltaY`.
6. **Allocation churn during a drag is 5–7 MB/s** in every configuration (visible-slice arrays, `KlineDraw` objects, `Date` objects and label records in the time scale, `parseFloat` on string OHLC). It did not produce a long animation frame in these runs, so it is a second-order item.

### Recommended order of work

1. Remove the wall-clock budget for viewport and overlay frames in `CanvasManager.scheduleRender`; render on every rAF while dirty. If a cap is still wanted, derive it from the rAF timestamp and one vsync, never from `performance.now()` against 33 ms.
2. Make `snapshotBaseLayer` lazy: skip it while `isRecentlyPanning()`, or snapshot only when an overlay-only frame is about to need it.
3. Re-run `test:perf:cadence` headed on the display in use and compare the `pan-10k-live` and `pan-10k-dpr2` p95 before working on the live-tick path and the canvas context options.
4. Move the wheel path off React state the same way the pan path already is, and scale the zoom step by `deltaY`.
5. Fix the existing harness blind spots so its gates mean something: `componentRenderRate(snap, 'ChartCanvas')` never matches the recorded key `ChartCanvas#SYMBOL@TF` (so the pan re-render cap is vacuous), `p95FrameMs` is the slowest section's last sample rather than a percentile, and the fixtures load 500 klines where the app loads 10,000.

### Harness caveats

- The synthetic mouse is capped near 60 Hz by the CDP round-trip, so the 120 Hz behaviour of the app is only partially exercised. A real trackpad on the internal display can produce 120 input events per second; the fixes above still apply, but the p95 there should be measured with the perf overlay (`chart.perf`) in the running app.
- `__canvasManager` is the last mounted chart, so `snapshot` timings in the 2×2 scenario belong to a sibling and read as 0; the single-chart scenarios are the ones to compare.
- Runs taken while another process saturates the CPU show input rates below 45 Hz and long gaps without any long animation frame; treat those as invalid and re-run.
