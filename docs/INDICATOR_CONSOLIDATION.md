# 📈 Indicator Consolidation Plan

**Sprint:** 2 - Indicator Consolidation  
**Branch:** `feature/indicator-consolidation`  
**Status:** 📝 Planning  
**Target:** Week 2 of Sprint 2

---

## 🎯 Objectives

1. **Remove all duplicated indicators** from frontend
2. **Single source of truth** in `packages/indicators/src/*`
3. **Update all workers** to use shared package
4. **Zero performance regression**
5. **100% test pass rate** maintained

---

## 📊 Current State

### Shared Package (`packages/indicators`)
✅ **57 indicators** implemented and tested:
- Moving Averages (SMA, EMA, WMA, DEMA, TEMA, HMA)
- Momentum (RSI, MACD, Stochastic, ROC, CMO, TSI, PPO)
- Volatility (ATR, Bollinger Bands, Keltner, Donchian)
- Volume (OBV, MFI, CMF, VWAP, Delta Volume)
- Trend (ADX, DMI, Aroon, Supertrend, Parabolic SAR, Ichimoku)
- Support/Resistance (Pivot Points, Floor Pivots, Fibonacci)
- Patterns (Candlestick patterns, FVG, Swing Points)
- Bitcoin-specific (Dominance, Halving Cycle)
- Crypto-specific (Funding Rate, Open Interest, Liquidations)
- Advanced (Williams %R, Ultimate Oscillator, Mass Index, Elder Ray)
- Custom (IBS, NR7, Cumulative RSI, N-Day High/Low)

### Frontend Duplicates
❌ **8 duplicated implementations:**
1. MACD - `apps/electron/src/renderer/utils/indicators/macd.ts`
2. EMA - `apps/electron/src/renderer/utils/movingAverages.ts`
3. RSI - `apps/electron/src/renderer/utils/rsi.ts`
4. ATR - `apps/electron/src/renderer/utils/indicators/atr.ts`
5. Stochastic - `apps/electron/src/renderer/utils/stochastic.ts`
6. VWAP - `apps/electron/src/renderer/utils/indicators/vwap.ts`
7. Volume - `apps/electron/src/renderer/utils/indicators/volume.ts`
8. ZigZag - `apps/electron/src/renderer/utils/indicators/zigzag.ts`

### Workers Using Duplicates
❌ **3 workers** importing frontend versions:
1. `apps/electron/src/renderer/workers/rsi.worker.ts`
2. `apps/electron/src/renderer/workers/stochastic.worker.ts`
3. `apps/electron/src/renderer/workers/movingAverage.worker.ts`

---

## 🔴 Priority 1: Core Technical Indicators

### 1.1 MACD

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/macd.ts (78 lines)
export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export const calculateMACD = (
  klines: Kline[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult => {
  // Implementation...
};

// ✅ packages/indicators/src/macd.ts (IDENTICAL)
// Same signature, same implementation
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/macd.ts exists

// All imports updated:
import { calculateMACD } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/indicators/macd.ts`
2. 🔄 Update all imports:
   - `apps/electron/src/renderer/components/Chart/MainChart.tsx`
   - `apps/electron/src/renderer/components/TradingView/indicators/MACDIndicator.tsx`
   - Any hooks using MACD
3. ✅ Run tests
4. ✅ Verify chart rendering

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/indicators/macd.ts`
- Update: Search for `from '../utils/indicators/macd'` → replace with `from '@marketmind/indicators'`

**Tests:**
- Frontend chart tests with MACD
- TradingView indicator tests

---

### 1.2 EMA (Exponential Moving Average)

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/movingAverages.ts
export const calculateEMA = (klines: Kline[], period: number): (number | null)[] => {
  // Implementation...
};

// ✅ packages/indicators/src/movingAverages.ts (IDENTICAL)
export const calculateEMA = (klines: Kline[], period: number): (number | null)[] => {
  // Implementation...
};
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/movingAverages.ts exists

import { calculateEMA, calculateSMA } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/movingAverages.ts`
2. 🔄 Update imports in:
   - `apps/electron/src/renderer/workers/movingAverage.worker.ts` ⚠️
   - All chart components using MA
   - Setup detection services
3. ✅ Run tests
4. ✅ Verify worker bundling

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/movingAverages.ts`
- Update: ~10-15 files importing MA functions
- **Critical:** `movingAverage.worker.ts` (worker needs special attention)

**Tests:**
- Worker tests
- Chart overlay tests
- Setup detection tests using MA

---

### 1.3 RSI (Relative Strength Index)

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/rsi.ts
export interface RSIResult {
  values: (number | null)[];
}

export const calculateRSI = (klines: Kline[], period: number = 2): RSIResult => {
  // Implementation...
};

// ✅ packages/indicators/src/rsi.ts (IDENTICAL)
export interface RSIResult {
  values: (number | null)[];
}

export const calculateRSI = (klines: Kline[], period: number = 2): RSIResult => {
  // Implementation...
};

// ❌ apps/electron/src/renderer/workers/rsi.worker.ts
// Uses frontend version
import { calculateRSI } from '../utils/rsi';
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/rsi.ts exists

// Worker updated:
import { calculateRSI } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/rsi.ts`
2. 🔄 Update `rsi.worker.ts`:
   ```typescript
   // ❌ Before
   import { calculateRSI } from '../utils/rsi';
   
   // ✅ After
   import { calculateRSI } from '@marketmind/indicators';
   ```
3. 🔄 Update all other imports
4. ✅ Test worker in browser
5. ✅ Verify chart rendering

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/rsi.ts`
- Update: `apps/electron/src/renderer/workers/rsi.worker.ts` ⚠️
- Update: All components using RSI

**Tests:**
- Worker tests (critical)
- RSI indicator overlay tests
- Setup detection using RSI

---

### 1.4 ATR (Average True Range)

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/atr.ts
export interface ATRResult {
  values: (number | null)[];
}

export const calculateATR = (klines: Kline[], period: number = 14): ATRResult => {
  // Implementation...
};

// ✅ packages/indicators/src/atr.ts (IDENTICAL)
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/atr.ts exists

import { calculateATR } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/indicators/atr.ts`
2. 🔄 Update all imports
3. ✅ Run tests

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/indicators/atr.ts`
- Update: Volatility-based setup detectors
- Update: Risk calculation utilities

---

### 1.5 Stochastic

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/stochastic.ts
export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export const calculateStochastic = (
  klines: Kline[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult => {
  // Implementation...
};

// ✅ packages/indicators/src/stochastic.ts (IDENTICAL)

// ❌ apps/electron/src/renderer/workers/stochastic.worker.ts
// Uses frontend version
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/stochastic.ts exists

// Worker updated:
import { calculateStochastic } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/stochastic.ts`
2. 🔄 Update `stochastic.worker.ts`
3. 🔄 Update all other imports
4. ✅ Test worker
5. ✅ Verify charts

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/stochastic.ts`
- Update: `apps/electron/src/renderer/workers/stochastic.worker.ts` ⚠️
- Update: Stochastic indicator components

---

### 1.6 VWAP (Volume Weighted Average Price)

**Current Duplication:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/vwap.ts
export const calculateVWAP = (klines: Kline[]): (number | null)[] => {
  // Implementation...
};

// ✅ packages/indicators/src/vwap.ts
export const calculateVWAP = (klines: Kline[]): number[] => {
  // Different return type (no nulls)
};
```

**Target State:**
```typescript
// ✅ ONLY packages/indicators/src/vwap.ts exists
// Return type: number[] (always valid values)

import { calculateVWAP } from '@marketmind/indicators';
```

**Migration Steps:**
1. ❌ Delete `apps/electron/src/renderer/utils/indicators/vwap.ts`
2. 🔄 Update imports
3. ⚠️ Check return type handling (frontend expects nulls, package doesn't return them)
4. 🔄 Adjust code if needed to handle non-null array
5. ✅ Run tests

**Files to Update:**
- Delete: `apps/electron/src/renderer/utils/indicators/vwap.ts`
- Update: VWAP overlay components
- Update: Volume analysis utilities

**Risk:** Minor adjustment needed for null handling

---

## 🟡 Priority 2: Volume & Pattern Indicators

### 2.1 Volume Analysis

**Current State:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/volume.ts
export const calculateVolumeMA = (klines: Kline[], period: number): number[] => {
  // Implementation...
};

export const identifyVolumeSurges = (klines: Kline[], threshold: number): boolean[] => {
  // Implementation...
};

// ❌ apps/electron/src/renderer/utils/patternDetection/core/volumeAnalysis.ts
// Different volume utilities
export const analyzeVolumeProfile = (klines: Kline[]): VolumeProfile => {
  // Implementation...
};
```

**Analysis Needed:**
- Are these truly duplicates or different utilities?
- Should volume profile analysis move to indicators package?
- Or should they remain as frontend-specific pattern detection helpers?

**Migration Steps:**
1. 🔍 Analyze usage patterns
2. 🔍 Determine if consolidation is appropriate
3. 🔄 Migrate to `packages/indicators/src/volume.ts` if general-purpose
4. ✅ Keep in pattern detection if specific to pattern logic

**Decision:** Defer to manual review

---

### 2.2 ZigZag Indicator

**Current State:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/zigzag.ts
export const calculateZigZag = (klines: Kline[], deviation: number): ZigZagPoint[] => {
  // Implementation...
};
```

**Status:** Not in shared package yet

**Options:**
1. Move to `packages/indicators/src/zigzag.ts`
2. Keep as frontend-specific visualization helper

**Decision:** Defer to manual review

---

### 2.3 Support/Resistance Detection

**Current State:**
```typescript
// ❌ apps/electron/src/renderer/utils/indicators/supportResistance.ts
export const detectSupportResistance = (klines: Kline[]): SRLevel[] => {
  // Complex implementation...
};
```

**Status:** Not in shared package

**Analysis:**
- This is more complex pattern detection logic
- May be appropriate to keep in frontend or move to separate package
- Not a simple technical indicator

**Decision:** Keep as-is (not a duplicate)

---

## 🔧 Backend Integration

### IndicatorEngine.ts Update

**Current State:**
```typescript
// apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts
import type { /* ... */ } from '@marketmind/types';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  // ... some from @marketmind/indicators
} from '@marketmind/indicators';

// But also has some inline calculations or alternative imports
```

**Target State:**
```typescript
// ✅ ALL indicator imports from @marketmind/indicators
import {
  // Moving Averages
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateDEMA,
  calculateTEMA,
  calculateHMA,
  
  // Momentum
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateStochRSI,
  calculateROC,
  calculateCMO,
  calculateTSI,
  calculatePPO,
  
  // Volatility
  calculateATR,
  calculateBollingerBands,
  calculateKeltner,
  calculateDonchian,
  
  // Volume
  calculateOBV,
  calculateMFI,
  calculateCMF,
  calculateVWAP,
  
  // Trend
  calculateADX,
  calculateDMI,
  calculateAroon,
  calculateSupertrend,
  calculateParabolicSar,
  
  // ... all 57 indicators
} from '@marketmind/indicators';

// ❌ NO inline calculations
// ❌ NO reimplementations
// ❌ NO alternative imports
```

**Migration Steps:**
1. 🔍 Audit all indicator usage in `IndicatorEngine.ts`
2. 🔄 Replace any inline calculations with imports
3. 🔄 Ensure all imports from `@marketmind/indicators`
4. ✅ Run backend tests
5. ✅ Run integration tests

**Files to Update:**
- `apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts`

**Tests:**
- `apps/backend/src/services/setup-detection/dynamic/__tests__/IndicatorEngine.test.ts`
- `apps/backend/test-integration.mjs`

---

## 🚀 Worker Bundle Configuration

### Critical: Vite Worker Plugin

**Current Config:**
```typescript
// vite.config.ts
export default defineConfig({
  // ...
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: [
      // Need to include @marketmind/indicators
    ],
  },
});
```

**Required Updates:**
```typescript
// vite.config.ts
export default defineConfig({
  // ...
  worker: {
    format: 'es',
    plugins: [
      // Ensure indicators package is bundled
    ],
  },
  optimizeDeps: {
    include: [
      '@marketmind/indicators', // ⚠️ Critical for workers
      '@marketmind/types',
    ],
  },
  resolve: {
    alias: {
      '@marketmind/indicators': path.resolve(__dirname, '../../packages/indicators/src'),
      '@marketmind/types': path.resolve(__dirname, '../../packages/types/src'),
    },
  },
});
```

**Worker Updates:**

```typescript
// ❌ Before (apps/electron/src/renderer/workers/rsi.worker.ts)
import { calculateRSI } from '../utils/rsi';

self.onmessage = (event: MessageEvent) => {
  const { klines, period } = event.data;
  const result = calculateRSI(klines, period);
  self.postMessage(result);
};

// ✅ After
import { calculateRSI } from '@marketmind/indicators';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period: number }>) => {
  const { klines, period } = event.data;
  const result = calculateRSI(klines, period);
  self.postMessage(result);
};
```

**Testing Workers:**
1. Build workers with updated imports
2. Test in development mode
3. Test in production build
4. Verify bundle size (should be similar or smaller)
5. Check performance (should be identical)

---

## 🧪 Testing Strategy

### Unit Tests

**Indicators Package:**
- ✅ Already has comprehensive tests
- ✅ 92% coverage
- No changes needed

**Frontend:**
- 🔄 Update import paths in tests
- ✅ Verify all tests still pass
- No functionality changes

**Backend:**
- 🔄 Update import paths if any local tests
- ✅ Run integration tests
- ✅ Verify calculations match

### Integration Tests

**Chart Rendering:**
```typescript
// Test all indicators render correctly on chart
describe('Chart Indicators', () => {
  it('should render MACD correctly', async () => {
    // Load chart with MACD
    // Verify calculation matches expected
    // Verify visual rendering
  });
  
  it('should render RSI correctly', async () => {
    // ...
  });
  
  // ... all indicators
});
```

**Worker Performance:**
```typescript
describe('Indicator Workers', () => {
  it('should calculate RSI in worker without blocking main thread', async () => {
    const worker = new Worker(new URL('./rsi.worker.ts', import.meta.url));
    const klines = generateTestKlines(1000);
    
    const result = await new Promise((resolve) => {
      worker.postMessage({ klines, period: 14 });
      worker.onmessage = (e) => resolve(e.data);
    });
    
    expect(result.values).toHaveLength(1000);
  });
});
```

**Backend Integration:**
```bash
# Run full backend integration tests
cd apps/backend
pnpm test:integration
```

---

## 📊 Migration Workflow

### Step-by-Step Process

1. **Create feature branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/indicator-consolidation
   ```

2. **Migrate one indicator at a time**
   
   **For each indicator:**
   ```bash
   # 1. Delete frontend duplicate
   rm apps/electron/src/renderer/utils/indicators/macd.ts
   
   # 2. Update all imports (use find/replace)
   # Find: from '../utils/indicators/macd'
   # Replace: from '@marketmind/indicators'
   
   # 3. Type check
   pnpm --filter @marketmind/electron type-check
   
   # 4. Run tests
   pnpm --filter @marketmind/electron test
   
   # 5. If all pass, commit
   git add .
   git commit -m "refactor: remove duplicate MACD, use @marketmind/indicators"
   ```

3. **Update workers** (after all indicators migrated)
   ```bash
   # Update all three workers
   # Test workers extensively
   # Verify bundle sizes
   
   git commit -m "refactor: update workers to use shared indicators"
   ```

4. **Update backend**
   ```bash
   # Update IndicatorEngine.ts
   pnpm --filter @marketmind/backend type-check
   pnpm --filter @marketmind/backend test
   
   git commit -m "refactor: update backend indicator imports"
   ```

5. **Final validation**
   ```bash
   # Full monorepo check
   pnpm type-check
   pnpm test
   pnpm build
   
   # If all pass, push
   git push origin feature/indicator-consolidation
   ```

6. **Create PR to develop**

---

## ✅ Success Criteria

- [ ] Zero duplicated indicator implementations
- [ ] All indicators imported from `@marketmind/indicators`
- [ ] Workers functioning correctly with shared package
- [ ] Backend using shared package exclusively
- [ ] Zero new TypeScript errors
- [ ] 100% test pass rate (1,084+ tests)
- [ ] No performance regression
- [ ] Frontend builds successfully
- [ ] Backend builds successfully
- [ ] Production builds verified
- [ ] Bundle sizes acceptable (no major increase)

---

## 📊 Progress Tracking

### Priority 1: Core Technical Indicators ⏳
- [ ] MACD - Delete frontend, update imports
- [ ] EMA - Delete frontend, update imports + worker
- [ ] RSI - Delete frontend, update imports + worker
- [ ] ATR - Delete frontend, update imports
- [ ] Stochastic - Delete frontend, update imports + worker
- [ ] VWAP - Delete frontend, update imports (check null handling)

### Priority 2: Volume & Pattern ⏳
- [ ] Volume - Analyze if truly duplicate
- [ ] ZigZag - Decide: migrate or keep frontend-only
- [ ] Support/Resistance - Keep as-is (not duplicate)

### Workers ⏳
- [ ] Update rsi.worker.ts
- [ ] Update stochastic.worker.ts
- [ ] Update movingAverage.worker.ts
- [ ] Test worker bundling
- [ ] Verify worker performance

### Backend ⏳
- [ ] Audit IndicatorEngine.ts
- [ ] Remove inline calculations
- [ ] Update all imports
- [ ] Run integration tests

---

## 🎯 Estimated Effort

- **Indicator Migration:** 1 day (6 files to delete, ~20 import updates)
- **Worker Updates:** 0.5 days (3 workers, testing)
- **Backend Updates:** 0.5 days (IndicatorEngine.ts)
- **Testing & Validation:** 0.5 days
- **Total:** 2-3 days

---

## ⚠️ Risks & Mitigation

### Risk 1: Worker Bundle Issues
**Mitigation:**
- Test workers in dev mode first
- Verify Vite config includes `@marketmind/indicators`
- Check bundle output
- Fallback: Keep worker imports local if bundling fails

### Risk 2: Performance Regression
**Mitigation:**
- Benchmark before/after
- Monitor bundle sizes
- Test with large datasets (10,000+ klines)
- Optimize if needed

### Risk 3: Null Handling Differences
**Mitigation:**
- Audit return types carefully
- Adjust code to handle (number | null)[] vs number[]
- Add type assertions if needed
- Comprehensive testing

---

## 📝 Notes

- Workers are **critical** - test thoroughly
- Bundle size **must not increase significantly**
- Performance **must remain same or better**
- All migrations are **non-functional changes**
- **Low risk** overall (compile-time safety)

---

**Last Updated:** December 10, 2025  
**Next Review:** After Priority 1 completion
