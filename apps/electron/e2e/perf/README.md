# Chart perf harness

Reproducible FPS / frame-time / render-rate numbers for the chart and its siblings. Catches regressions before they hit prod.

See [`docs/BROWSER_TESTING.md`](../../../../docs/BROWSER_TESTING.md) for the full layered-testing picture; this README is the focused guide for the perf project specifically.

## Run

```bash
pnpm --filter @marketmind/electron test:perf
# or end-to-end (install chromium + run + diff baseline):
./scripts/perf/run-chart-perf.sh
```

Diagnose mode (dumps top-5 slow sections per scenario into a git-ignored `diagnose-<timestamp>.json`):

```bash
pnpm --filter @marketmind/electron test:perf:diagnose
```

Update the baseline (only when a real improvement lands):

```bash
pnpm --filter @marketmind/electron test:perf:update
```

## Files

| File | Role |
|---|---|
| `chart-perf.spec.ts` | Indicator-panel baselines — 5-panel full stack, overlay-only, sanity. Drives the chart with `addIndicators` + `driveFrames`. |
| `chart-hotpath.spec.ts` | Hot-path scenarios — `price-tick-storm`, `kline-replace-loop`, `kline-append`, `pan-drag-loop`, `wheel-zoom-loop`, `indicator-churn`, `many-drawings` (80 mixed drawings under pan+zoom), `price-tick-storm-20` (20-symbol tick storm). |
| `chart-mobile.spec.ts` | Narrow-viewport scenarios (`390×844`) — `mobile-overlay`, `mobile-pan-zoom`, `mobile-tick-storm`. Same assertions as desktop baselines. |
| `sibling-renders.spec.ts` | Sentinel — `Portfolio` + `OrdersList` renders/sec stay ≤ 10 under 10-symbol tick storm. |
| `baseline.json` | Committed. Current accepted numbers for each scenario. |
| `last-run.json` | Git-ignored. Written per run by the specs, diffed by `scripts/perf/compare-baseline.ts`. |

Driver helpers live in [`../helpers/chartTestSetup.ts`](../helpers/chartTestSetup.ts):

- `pushPriceTicks(page, {sym: price})` — `window.__priceStore.getState().updatePriceBatch(Map)`
- `updateLatestKline(page, {close, volume})` / `appendKline(page, TestKline)` — mutate `window.__queryClient` cache keyed on `['kline', 'list']`
- `drivePan(page, frames, amplitudePx)` / `driveWheelZoom(page, frames, deltaPx)` — synthetic `page.mouse.*` paced with rAF
- `driveFrames(page, frames)` — synthetic mousemove on every rAF tick (this is what marks the chart dirty)
- `readPerfSnapshot(page)` / `resetPerfMonitor(page)` — `window.__mmPerf` bridge

All bridges (`window.__*`) are gated on `IS_E2E_BYPASS_AUTH` and dead-code-eliminated in prod builds.

## Adding a new scenario

1. Pick the right spec file — baseline → `chart-perf.spec.ts`, real-world churn → `chart-hotpath.spec.ts`, non-chart React → `sibling-renders.spec.ts`.
2. Inside a `test(...)` block:
   - `clearIndicators(page)` → `addIndicators(page, [...])`
   - Warm up: `waitForFrames(page, WARMUP_FRAMES)` — **no measurement happening here**, `waitForFrames` is fine
   - `resetPerfMonitor(page)`
   - Drive: interleave data mutations (`pushPriceTicks`, `appendKline`, etc.) with `driveFrames(page, N)` — **during measurement use `driveFrames`, never `waitForFrames`**
3. Assert on `readPerfSnapshot(page)` — prefer `slowestSectionMs(snap) ≤ X` and `componentRenderRate(snap, 'Name') ≤ R` over raw totals. Rates survive replay-count changes; absolute counts don't.
4. `writeRunResult(key, entry)` at the end so `compare-baseline.ts` picks up the run.
5. Add the corresponding `baseline.json` entry — copy from the first local green run.

## Noise-floor conventions for assertions

- FPS: `≥ 20` for driven scenarios (rAF-paced mousemove caps near 25-30 in headless Chromium).
- Slowest section: `≤ 25ms` floor per scenario; widen only with a written justification.
- Regression threshold: `compare-baseline.ts` flags `> 10%` deltas.
- Absolute floor: `0.5ms` — below that, noise dominates.
- Relative floor: `50%` — smaller than that on fast sections is usually noise.
- Render rate: assert on `ratePerSec`, not raw `count`.

## Why `driveFrames`, not `waitForFrames`

The chart's render loop marks dirty on **pointer events** (mousemove, wheel, etc.) — raw `requestAnimationFrame` ticks alone don't trigger a draw. `waitForFrames` only awaits rAF, so the canvas stays clean and perf numbers look artificially good. `driveFrames` dispatches a synthetic mousemove on every frame, which is what exercises the same code path as a real user.

Use `waitForFrames` for post-mount settling where no measurement happens. Use `driveFrames` everywhere measurement is active.

## Store-exposure pattern

Any new driver that needs a store hook goes through `apps/electron/src/renderer/utils/e2eBridge.ts`:

```ts
if (IS_E2E_BYPASS_AUTH) {
  (window as unknown as { __fooStore: typeof useFooStore }).__fooStore = useFooStore;
}
```

`IS_E2E_BYPASS_AUTH` is the canonical flag in `apps/electron/src/shared/constants/e2e.ts`. Vite inlines `import.meta.env.VITE_E2E_BYPASS_AUTH` at build time; `false` at prod means the whole `if` block vanishes.

## Baseline file schema

```json
{
  "generatedAt": "2026-04-20T10:30:00.000Z",
  "scenarios": {
    "price-tick-storm": {
      "fps": 28,
      "slowestSectionMs": 12,
      "componentRenders": { "ChartCanvas": 128, "Portfolio": 3.2 }
    }
  }
}
```

Only commit numbers observed locally after a clean run. `test:perf:update` copies `last-run.json` over `baseline.json` verbatim — if the last run was a regression, you just immortalized it.
