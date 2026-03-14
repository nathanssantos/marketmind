# PLAN-06: Bundle Optimization & Architecture Cleanup

## Context
The Electron app ships a single monolithic bundle with no code splitting. All indicator renderers, UI components, and vendor libraries are loaded upfront, increasing initial load time. Additionally, direction types are inconsistent across packages (`LONG/SHORT` vs `up/down` vs `bullish/bearish`), creating unnecessary conversion code and cognitive overhead.

## Branch
`perf/bundle-architecture`

---

## 1. Vite code splitting with `manualChunks`

### File: `apps/electron/vite.config.ts`

### Current:
No `manualChunks` configuration — everything goes into a single bundle.

### Add chunk splitting:

Find the `build` configuration for the renderer and add:

```typescript
build: {
  outDir: isWeb ? 'dist-web' : 'dist',
  emptyOutDir: true,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
        'vendor-chakra': ['@chakra-ui/react'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-i18n': ['i18next', 'react-i18next'],
        'vendor-zustand': ['zustand', 'zustand/middleware/immer', 'immer'],
        'indicators': ['@marketmind/indicators'],
        'fibonacci': ['@marketmind/fibonacci'],
        'trading': ['@marketmind/trading-core', '@marketmind/risk'],
      },
    },
  },
},
```

### Why these splits:
- `vendor-react`: React runtime is stable, rarely changes — browsers cache it long-term
- `vendor-chakra`: Large library (~200KB), loaded once
- `vendor-query`: TanStack Query is independent of UI framework
- `indicators` + `fibonacci`: Heavy calculation libraries, only needed when chart is open
- `trading`: Only needed when trading features are active

### Impact:
- Faster hot module replacement (HMR) in development
- Better caching in production (vendor chunks change less often)
- For Electron: marginal improvement since it's a local app, but still reduces initial parse time

### Verify after change:
```bash
cd apps/electron && pnpm build
ls -la dist/assets/ | head -20  # Should show multiple chunk files
```

---

## 2. Lazy load heavy chart indicator renderers (future consideration)

### Current:
All indicator renderers are statically imported in `useChartIndicatorRenderers.ts`:
```typescript
import { useRSIRenderer } from './useRSIRenderer';
import { useStochasticRenderer } from './useStochasticRenderer';
import { useMACDRenderer } from './useMACDRenderer';
import { useBollingerBandsRenderer } from './useBollingerBandsRenderer';
// ... 15+ more
```

### Assessment:
These are all React hooks, which cannot be conditionally called (rules of hooks). Lazy loading would require restructuring each renderer into a component pattern instead of a hook pattern.

### Recommendation: **Skip for now**
The code splitting in step 1 already separates the `@marketmind/indicators` calculation library into its own chunk. The renderer hooks are thin wrappers that call Canvas API — they're small (1-5KB each) and the overhead of lazy loading infrastructure would exceed the savings.

### If we want this later:
Convert each indicator renderer from a hook to a render function that's called imperatively:
```typescript
// Instead of: const renderRSI = useRSIRenderer(props);
// Use: const renderRSI = createRSIRenderer(props); // pure function, no hooks
```
This would allow dynamic import of renderer modules.

---

## 3. Direction type unification

### Current state:
Three different representations of the same concept across packages:

| Package | Type | Values |
|---------|------|--------|
| `@marketmind/fibonacci` | direction | `'up' \| 'down'` |
| `@marketmind/types` (trading) | side | `'LONG' \| 'SHORT'` |
| `@marketmind/indicators` | TrendDirection | `'bullish' \| 'bearish'` |

### Analysis:
These serve different semantic purposes:
- `LONG/SHORT`: Order/position side (Binance API convention)
- `up/down`: Price movement direction (Fibonacci projection direction)
- `bullish/bearish`: Market sentiment/bias (indicator output)

### Recommendation: **Don't unify**
These are semantically different concepts that happen to correlate. Forcing them into a single type would lose semantic meaning. Instead, add explicit conversion utilities:

### File: `packages/types/src/direction.ts`

```typescript
export type OrderSide = 'LONG' | 'SHORT';
export type PriceDirection = 'up' | 'down';
export type MarketBias = 'bullish' | 'bearish';

export const sideToDirection = (side: OrderSide): PriceDirection =>
  side === 'LONG' ? 'up' : 'down';

export const directionToSide = (dir: PriceDirection): OrderSide =>
  dir === 'up' ? 'LONG' : 'SHORT';

export const sideToBias = (side: OrderSide): MarketBias =>
  side === 'LONG' ? 'bullish' : 'bearish';

export const biasToSide = (bias: MarketBias): OrderSide =>
  bias === 'bullish' ? 'LONG' : 'SHORT';

export const directionToBias = (dir: PriceDirection): MarketBias =>
  dir === 'up' ? 'bullish' : 'bearish';

export const biasToDirection = (bias: MarketBias): PriceDirection =>
  bias === 'bullish' ? 'up' : 'down';
```

### Usage:
Replace inline conversions like `side === 'LONG' ? 'up' : 'down'` with `sideToDirection(side)` across the codebase.

---

## 4. Clean up console.log statements in production paths

### File: `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx`

### Current:
Multiple `console.log` statements in the WebSocket handlers:
- Line 173: `console.log('[RealtimeSync] Auto-subscribed to:', newSymbols)`
- Line 176: `console.log('[RealtimeSync] Auto-unsubscribed from:', removedSymbols)`
- Line 197: `console.log('[RealtimeSync] Batch subscribing to prices:', symbolsToSubscribe)`
- Line 203: `console.log('[RealtimeSync] WebSocket connected')`
- Line 207: `console.log('[RealtimeSync] WebSocket disconnected:', reason)`
- Line 216: `console.log('[RealtimeSync] Position update received:', ...)`
- Line 265: `console.log('[RealtimeSync] Trade notification received:', ...)`
- Lines 282-294: Multiple notification debug logs

### Solution:
Replace with conditional debug logging or remove entirely:

```typescript
const DEBUG = import.meta.env.DEV;
const log = DEBUG ? console.log.bind(console, '[RealtimeSync]') : () => {};
```

Or use `@marketmind/logger` if it supports browser environments.

### Impact:
- Reduces console noise in production
- Minor performance improvement (console.log with object serialization is not free)

---

## 5. Remove unused re-exports in utils package

### File: `packages/utils/src/klineUtils.ts`

### Current behavior:
This file re-exports from `@marketmind/types` without adding any value. It's a passthrough barrel export.

### Check usage:
Search for `import { ... } from '@marketmind/utils'` that use kline utilities. If all imports can be changed to `@marketmind/types`, remove the re-export file.

### If re-exports are used:
Keep them but add a deprecation comment pointing to the canonical source. Better yet, update the import paths in consuming files and remove the re-exports.

---

## Verification

```bash
# Build and verify chunks
cd apps/electron && pnpm build
ls -la dist/assets/  # Verify multiple chunk files

# Test everything
pnpm test

# Type check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/types type-check

# Lint
pnpm --filter @marketmind/electron lint

# Manual verification:
# 1. Start app, open DevTools Network tab
# 2. Verify multiple JS chunks loaded
# 3. Navigate to chart — verify indicator chunk loaded on demand (if lazy loading applied)
# 4. Check console — no debug logs in production build
```

## Files Modified
- `apps/electron/vite.config.ts` (manualChunks)
- `packages/types/src/direction.ts` (new, direction utilities)
- `packages/types/src/index.ts` (export direction utilities)
- `apps/electron/src/renderer/context/RealtimeTradingSyncContext.tsx` (console.log cleanup)
- `packages/utils/src/klineUtils.ts` (remove if unused)
