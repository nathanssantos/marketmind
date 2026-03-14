# PLAN-02: Real-time Price Pipeline

## Context
Price updates flow from Binance WebSocket → backend → frontend WebSocket → price store → UI components. In crypto markets, 50-100 price updates/second are common. The current pipeline has no batching, causes double re-renders, and throttles sidebar prices at 1s (too slow for scalping). These issues compound to create visible UI lag and wasted CPU cycles.

## Branch
`perf/realtime-price-pipeline`

---

## 1. Batch WebSocket price updates in frontend

### File: `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx`

### Current (lines 240-246):
```typescript
const handlePriceUpdate = (data: PriceUpdate) => {
  usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
  const callbacks = priceCallbacksRef.current.get(data.symbol);
  if (callbacks) {
    callbacks.forEach((callback) => callback(data.price));
  }
};
```

### Problem
1. Every single price update calls `updatePrice()` which triggers immer draft mutation + Zustand notify
2. Direct callbacks fire independently, potentially causing a second render cycle
3. 100 updates/sec = 100 store writes = 100 potential re-renders

### Solution: Microtask batching

```typescript
const pendingPriceUpdates = useRef(new Map<string, number>());
const priceFlushScheduled = useRef(false);

const flushPriceUpdates = useCallback(() => {
  priceFlushScheduled.current = false;
  const updates = pendingPriceUpdates.current;
  if (updates.size === 0) return;

  const batch = new Map(updates);
  updates.clear();

  // Single store update for all symbols
  usePriceStore.getState().updatePriceBatch(batch);

  // Fire callbacks
  for (const [symbol, price] of batch) {
    const callbacks = priceCallbacksRef.current.get(symbol);
    if (callbacks) callbacks.forEach((cb) => cb(price));
  }
}, []);

const handlePriceUpdate = useCallback((data: PriceUpdate) => {
  pendingPriceUpdates.current.set(data.symbol, data.price);

  if (!priceFlushScheduled.current) {
    priceFlushScheduled.current = true;
    requestAnimationFrame(flushPriceUpdates);
  }
}, [flushPriceUpdates]);
```

This batches all price updates that arrive within a single animation frame (~16ms) into one store write.

---

## 2. Add `updatePriceBatch` to price store

### File: `apps/electron/src/renderer/store/priceStore.ts`

### Add new method to store interface and implementation:

```typescript
interface PriceState {
  // ... existing fields ...
  updatePriceBatch: (updates: Map<string, number>) => void;
}

// Implementation inside create():
updatePriceBatch: (updates) => {
  const now = Date.now();
  set((state) => {
    for (const [symbol, price] of updates) {
      const current = state.prices[symbol];
      if (current) {
        if (current.source !== 'chart' || now - current.timestamp > PRICE_STALENESS_MS) {
          state.prices[symbol] = { price, timestamp: now, source: 'websocket' };
        }
      } else {
        state.prices[symbol] = { price, timestamp: now, source: 'websocket' };
      }
    }
  });
},
```

This triggers only ONE Zustand notification for all symbol updates, instead of N notifications.

---

## 3. Reduce sidebar price throttle

### File: `apps/electron/src/renderer/store/priceStore.ts`

### Current (line 84):
```typescript
const SIDEBAR_PRICE_UPDATE_THROTTLE_MS = 1000;
```

### Change:
```typescript
const SIDEBAR_PRICE_UPDATE_THROTTLE_MS = 250;
```

### Why 250ms and not lower
- Sidebar text rendering at 250ms is visually smooth (4 updates/sec)
- Lower than 100ms would cause visible flickering of numbers
- The chart already uses `useFastPriceForSymbol` which is unthrottled
- With batching from step 1, the actual store writes are already frame-aligned

---

## 4. Remove `klinesLatest` polling

### File: `apps/electron/src/renderer/services/queryConfig.ts`

### Current (lines 54-59):
```typescript
klinesLatest: {
  staleTime: QUERY_STALE_TIMES.REAL_TIME,
  gcTime: QUERY_GC_TIMES.SHORT,
  refetchOnWindowFocus: false,
  refetchInterval: 30 * SECOND,
},
```

### Change:
```typescript
klinesLatest: {
  staleTime: QUERY_STALE_TIMES.REAL_TIME,
  gcTime: QUERY_GC_TIMES.SHORT,
  refetchOnWindowFocus: false,
  refetchInterval: false,
},
```

### Why this is safe
- Kline updates are delivered via WebSocket in real-time
- The chart already receives new klines from the stream
- The 30s poll was a redundant safety net that creates unnecessary network traffic and re-renders
- If WebSocket disconnects, the React Query `staleTime` of 30s will still cause a refetch on next focus

### Alternative (if we want fallback polling)
If we want to keep polling as a WebSocket disconnection fallback:
```typescript
klinesLatest: {
  staleTime: QUERY_STALE_TIMES.REAL_TIME,
  gcTime: QUERY_GC_TIMES.SHORT,
  refetchOnWindowFocus: false,
  refetchInterval: 5 * MINUTE,  // 5min fallback instead of 30s
},
```

---

## 5. Verify no double-render from store + callbacks

### File: `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx`

### Analysis
The `priceCallbacksRef` is used by `subscribeToPrice()` (line ~340-360), which is called by chart components for their specific symbol. These callbacks directly update canvas (not React state), so they don't cause React re-renders.

The `usePriceStore` subscribers (`useFastPriceForSymbol`, `usePricesForSymbols`) are used by sidebar/portfolio components for React-driven price display.

### Conclusion
There is **no actual double-render** issue. The callbacks are imperative canvas updates, not React state changes. The store updates trigger React re-renders only for sidebar components. Both paths are needed. The batching from step 1 is still valuable because it reduces the number of store writes from 100/sec to ~60/sec (one per frame).

---

## 6. Backend WebSocket deduplication (optional optimization)

### File: `apps/backend/src/services/websocket.ts`

### Current behavior
Multiple frontend clients can subscribe to the same symbol, each triggering a separate `binancePriceStreamService.subscribeSymbol()` call. The price stream service likely handles deduplication internally, but verify.

### Check
Look at `binancePriceStreamService.subscribeSymbol()` — if it already deduplicates (only subscribes to Binance once per symbol regardless of client count), no change needed. If not, add reference counting.

---

## Verification

```bash
# Frontend tests
pnpm --filter @marketmind/electron test

# Type check
pnpm --filter @marketmind/electron type-check

# Manual verification:
# 1. Open chart with multiple indicators
# 2. Open DevTools Performance tab
# 3. Record 10 seconds of price updates
# 4. Verify: store writes should batch (1 write per frame, not 1 per update)
# 5. Verify: sidebar prices update smoothly at ~4fps
# 6. Verify: no 30s polling in Network tab (or 5min if using fallback)
```

## Files Modified
- `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx` (batching)
- `apps/electron/src/renderer/store/priceStore.ts` (batch method + throttle)
- `apps/electron/src/renderer/services/queryConfig.ts` (remove polling)
