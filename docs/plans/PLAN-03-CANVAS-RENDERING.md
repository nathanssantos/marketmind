# PLAN-03: Canvas Rendering Performance

## Context
The chart canvas uses a layered rendering system (static/data/indicators/overlays) with OffscreenCanvas caching. However, the invalidation is too aggressive — every kline update invalidates ALL layers including the static background. Moving average calculations are O(n*p) and recalculate from scratch on every update. Drawing index resolution runs binary search on every frame. For scalping, the chart must render at 60fps without frame drops during rapid price action.

## Branch
`perf/canvas-rendering`

---

## 1. Granular layer invalidation

### File: `apps/electron/src/renderer/components/Chart/ChartCanvas/useOptimizedRendering.ts`

### Current (lines 207-210):
```typescript
useEffect(() => {
  invalidateAll();
  requestRender();
}, [klines, colors, chartType, showGrid, showVolume]);
```

### Problem
When `klines` changes (every new candle or price update), `invalidateAll()` invalidates the `static` layer (background grid, symbol label) which hasn't changed. The static layer only depends on `colors`, `showGrid`, `symbol`, `marketType`, `timeframe`.

### Solution: Split into targeted invalidation effects

```typescript
useEffect(() => {
  invalidateLayer('data');
  invalidateLayer('indicators');
  requestRender();
}, [klines]);

useEffect(() => {
  invalidateAll();
  requestRender();
}, [colors, chartType, showGrid, showVolume]);
```

### Why this works
- The `backgroundLayer` memo (line 111-118) already has the correct deps: `[manager, colors, showGrid, symbol, marketType, timeframe]` — it doesn't depend on `klines`
- The `dataLayer` memo (line 120-135) depends on `klines` — only this and indicators need invalidation
- The `renderFrame` callback (line 137-198) already checks `isLayerValid('static')` before re-rendering — if static is still valid, it just composites the cached OffscreenCanvas

### Impact
- Skips background re-render on every kline update
- Background rendering includes grid lines (O(width/spacing) line draws) and text rendering — measurable savings

---

## 2. Incremental moving average calculation

### File: `apps/electron/src/renderer/components/Chart/ChartCanvas/useChartRendering.ts`

### Current (lines 89-97):
```typescript
const maValuesCache = useMemo(() => {
  const cache = new Map<string, (number | null)[]>();
  for (const ma of movingAverages) {
    if (ma.visible === false) continue;
    const key = `${ma.type}-${ma.period}`;
    cache.set(key, calculateMovingAverage(klines, ma.period, ma.type));
  }
  return cache;
}, [klines, movingAverages]);
```

### Problem
Every time `klines` changes (new candle appended, real-time close price update), ALL moving averages are recalculated from scratch. For 10K visible klines with 5 MAs, this is 50K+ iterations per update.

### Solution: Detect append-only updates and extend incrementally

```typescript
const prevKlinesRef = useRef<Kline[]>([]);
const prevMaCacheRef = useRef<Map<string, (number | null)[]>>(new Map());

const maValuesCache = useMemo(() => {
  const prev = prevKlinesRef.current;
  const cache = new Map<string, (number | null)[]>();
  const isAppend = klines.length > prev.length &&
    klines.length - prev.length <= 5 &&
    prev.length > 0 &&
    klines[prev.length - 1]?.openTime === prev[prev.length - 1]?.openTime;

  for (const ma of movingAverages) {
    if (ma.visible === false) continue;
    const key = `${ma.type}-${ma.period}`;
    const prevValues = prevMaCacheRef.current.get(key);

    if (isAppend && prevValues && prevValues.length === prev.length) {
      // Last value of prev might have changed (real-time close update)
      // Recalculate only the last `period` values + new values
      const recalcStart = Math.max(0, prev.length - 1);
      const fullValues = calculateMovingAverage(klines, ma.period, ma.type);
      // Reuse prefix, only copy new tail
      const merged = prevValues.slice(0, recalcStart);
      for (let i = recalcStart; i < fullValues.length; i++) {
        merged.push(fullValues[i]!);
      }
      cache.set(key, merged);
    } else {
      cache.set(key, calculateMovingAverage(klines, ma.period, ma.type));
    }
  }

  prevKlinesRef.current = klines;
  prevMaCacheRef.current = cache;
  return cache;
}, [klines, movingAverages]);
```

### Better approach (if SMA sliding window from PLAN-05 is done first)
Once `calculateSMA` uses sliding window internally, the full recalculation is already O(n) instead of O(n*p). The incremental approach above is still valuable because it avoids recalculating the first 9,999 values when only 1 new kline was appended. But the benefit is smaller.

### Recommended order: Do PLAN-05 SMA optimization first, then this optimization becomes simpler and the improvement compounds.

---

## 3. Cache drawing index resolution

### File: `apps/electron/src/renderer/components/Chart/useDrawingsRenderer.ts`

### Current behavior
`resolveDrawingIndices()` runs binary search to convert each drawing's timestamp to a kline index. This runs on every render when `klines` changes.

### Problem
- O(D * log K) per render where D = number of drawings, K = kline count
- Most drawings don't change between renders — their timestamps are constant
- Only new klines or a symbol change should trigger re-resolution

### Solution: Memoize resolved drawings by timestamp stability

```typescript
const resolvedDrawingsCache = useRef(new Map<string, Drawing>());
const lastKlinesLength = useRef(0);
const lastFirstKlineTime = useRef(0);

const resolvedDrawings = useMemo(() => {
  const firstTime = klines[0]?.openTime ?? 0;
  const klinesChanged = klines.length !== lastKlinesLength.current ||
    firstTime !== lastFirstKlineTime.current;

  if (klinesChanged) {
    resolvedDrawingsCache.current.clear();
    lastKlinesLength.current = klines.length;
    lastFirstKlineTime.current = firstTime;
  }

  return drawings.map((drawing) => {
    const cacheKey = `${drawing.id}-${drawing.updatedAt}`;
    const cached = resolvedDrawingsCache.current.get(cacheKey);
    if (cached) return cached;

    const resolved = resolveDrawingIndices(drawing, klines);
    resolvedDrawingsCache.current.set(cacheKey, resolved);
    return resolved;
  });
}, [drawings, klines]);
```

### Impact
- When scrolling/panning (viewport change only, klines same): zero re-resolution
- When new kline appended: only new kline count triggers re-resolution (cache cleared)
- When drawing edited: only that drawing's `updatedAt` changes, cache miss only for it

---

## 4. Optimize viewport change invalidation

### File: `apps/electron/src/renderer/components/Chart/ChartCanvas/useOptimizedRendering.ts`

### Current (lines 149-153):
```typescript
if (viewportChanged) {
  lastViewportRef.current = { ...currentViewport };
  invalidateLayer('data');
  invalidateLayer('indicators');
}
```

### This is already correct
The viewport change detection only invalidates `data` and `indicators`, not `static`. This is the right behavior since the grid density might change on zoom but the grid layer is part of `static` and gets re-created via the `backgroundLayer` memo when viewport changes significantly.

### Potential issue
The `backgroundLayer` memo depends on `manager` (which contains viewport state). If `manager` reference changes on every viewport update, the memo recalculates unnecessarily. Verify that `manager` is stable across viewport changes. If yes, no action needed.

---

## Verification

```bash
# Frontend tests
pnpm --filter @marketmind/electron test

# Type check
pnpm --filter @marketmind/electron type-check

# Manual verification:
# 1. Open chart with 5+ MAs enabled and 10+ drawings
# 2. Enable DevTools Performance recording
# 3. Scroll/zoom rapidly for 10 seconds
# 4. Verify: no frame drops below 30fps
# 5. Check flame chart: static layer should NOT appear in render calls during scrolling
# 6. Add console.time('ma-calc') around MA cache to measure improvement
```

## Files Modified
- `apps/electron/src/renderer/components/Chart/ChartCanvas/useOptimizedRendering.ts` (layer invalidation)
- `apps/electron/src/renderer/components/Chart/ChartCanvas/useChartRendering.ts` (incremental MA)
- `apps/electron/src/renderer/components/Chart/useDrawingsRenderer.ts` (drawing cache)
