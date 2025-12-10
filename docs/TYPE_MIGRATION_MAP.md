# 🔄 Type Migration Map

**Sprint:** 2 - Type Consolidation  
**Branch:** `feature/type-consolidation`  
**Status:** 📝 Planning  
**Target:** Week 1 of Sprint 2

---

## 🎯 Objectives

1. **Eliminate all type duplication** across frontend, backend, and shared packages
2. **Single source of truth** for each type in `packages/types/src/*`
3. **Zero TypeScript errors** after migration
4. **100% test pass rate** maintained
5. **Clear import paths** using `@marketmind/types`

---

## 📊 Migration Priority

### 🔴 Priority 1: Trading Core Types

#### 1.1 Order Types

**Current State:**
```typescript
// ❌ apps/backend/src/types/binance.ts
export type BinanceOrderSide = 'BUY' | 'SELL';
export type BinanceOrderStatus = 
  | 'NEW' 
  | 'PARTIALLY_FILLED' 
  | 'FILLED' 
  | 'CANCELED' 
  | 'PENDING_CANCEL' 
  | 'REJECTED' 
  | 'EXPIRED';

// ❌ packages/types/src/trading.ts (slightly different)
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 
  | 'NEW' 
  | 'PARTIALLY_FILLED' 
  | 'FILLED' 
  | 'CANCELED' 
  | 'PENDING_CANCEL' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'EXPIRED_IN_MATCH' 
  | 'PENDING_NEW';
```

**Target State:**
```typescript
// ✅ packages/types/src/trading.ts (SINGLE SOURCE)
export type OrderSide = 'BUY' | 'SELL';

export type OrderStatus = 
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRED_IN_MATCH'
  | 'PENDING_NEW';

export type ListOrderStatus = 'EXECUTING' | 'ALL_DONE' | 'REJECT';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  status: OrderStatus;
  type: OrderType;
  price: number;
  quantity: number;
  executedQty: number;
  timestamp: number;
  updateTime: number;
}
```

**Migration Steps:**
1. ✅ Keep comprehensive `OrderStatus` in `packages/types/src/trading.ts`
2. ❌ Remove `BinanceOrderStatus` from `apps/backend/src/types/binance.ts`
3. 🔄 Create type alias in binance.ts if needed:
   ```typescript
   import type { OrderStatus } from '@marketmind/types';
   export type BinanceOrderStatus = OrderStatus;
   ```
4. 🔄 Update all imports:
   ```typescript
   // ❌ Before
   import type { BinanceOrderStatus } from '../types/binance';
   
   // ✅ After
   import type { OrderStatus } from '@marketmind/types';
   ```

**Files to Update:**
- `apps/backend/src/types/binance.ts` - Remove duplicated types
- `apps/backend/src/routers/trading.ts` - Update imports
- `apps/backend/src/services/binance-trading.ts` - Update imports
- `apps/electron/src/shared/utils/orderUtils.ts` - Update imports
- `apps/electron/src/renderer/components/TradingSidebar.tsx` - Update imports

**Tests to Run:**
- `apps/backend/src/routers/__tests__/trading.test.ts`
- `apps/electron/src/shared/utils/__tests__/orderUtils.test.ts`

#### 1.2 Binance Types

**Current State:**
```typescript
// ❌ apps/backend/src/types/binance.ts (120+ lines, backend only)
export interface BinanceOrderResult { /* ... */ }
export type BinanceOrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS_LIMIT' | /* ... */;
export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';
// ... many more
```

**Target State:**
```typescript
// ✅ packages/types/src/binance.ts (NEW FILE - shared across monorepo)
export interface BinanceOrderResult {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: BinanceTimeInForce;
  type: BinanceOrderType;
  side: OrderSide;
  fills?: BinanceFill[];
}

export type BinanceOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT'
  | 'LIMIT_MAKER';

export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface BinanceFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId: number;
}

// ... all other Binance-specific types
```

**Migration Steps:**
1. ✅ Create `packages/types/src/binance.ts`
2. 🔄 Move all Binance types from `apps/backend/src/types/binance.ts`
3. ✅ Export from `packages/types/src/index.ts`:
   ```typescript
   export * from './binance';
   ```
4. ❌ Delete `apps/backend/src/types/binance.ts`
5. 🔄 Update all backend imports:
   ```typescript
   // ❌ Before
   import type { BinanceOrderResult } from '../types/binance';
   
   // ✅ After
   import type { BinanceOrderResult } from '@marketmind/types';
   ```

**Files to Update:**
- Create `packages/types/src/binance.ts`
- Update `packages/types/src/index.ts`
- Delete `apps/backend/src/types/binance.ts`
- `apps/backend/src/services/binance-trading.ts`
- `apps/backend/src/services/binance-kline-sync.ts`
- `apps/backend/src/services/binance-historical.ts`
- `apps/backend/src/services/binance-kline-stream.ts`
- `apps/backend/src/services/binance-price-stream.ts`

**Tests to Run:**
- All backend integration tests
- `apps/backend/test-integration.mjs`

---

### 🟡 Priority 2: Configuration Types

#### 2.1 SetupDetectionConfig

**Current State:**
```typescript
// ❌ Duplicated in 3 places:
// apps/backend/src/services/setup-detection/SetupDetectionService.ts:18
// apps/electron/src/renderer/services/setupDetection/SetupDetectionService.ts:25
// packages/types/src/setupConfig.ts:67
```

**Target State:**
```typescript
// ✅ packages/types/src/setupConfig.ts (SINGLE SOURCE)
export interface SetupDetectionConfig {
  larryWilliams: {
    setup91: LarryWilliams91Config;
    setup92: LarryWilliams92Config;
    setup93: LarryWilliams93Config;
    setup94: LarryWilliams94Config;
  };
  pattern123: Pattern123Config;
  bearTrap: BearTrapConfig;
  bullTrap: BullTrapConfig;
  breakoutRetest: BreakoutRetestConfig;
  consolidationBreakout: ConsolidationBreakoutConfig;
  volumeSpike: VolumeSpikeConfig;
  rsiDivergence: RSIDivergenceConfig;
  macdCross: MACDCrossConfig;
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  larryWilliams: {
    setup91: DEFAULT_LARRY_WILLIAMS_91_CONFIG,
    setup92: DEFAULT_LARRY_WILLIAMS_92_CONFIG,
    setup93: DEFAULT_LARRY_WILLIAMS_93_CONFIG,
    setup94: DEFAULT_LARRY_WILLIAMS_94_CONFIG,
  },
  pattern123: DEFAULT_PATTERN_123_CONFIG,
  bearTrap: DEFAULT_BEAR_TRAP_CONFIG,
  bullTrap: DEFAULT_BULL_TRAP_CONFIG,
  breakoutRetest: DEFAULT_BREAKOUT_RETEST_CONFIG,
  consolidationBreakout: DEFAULT_CONSOLIDATION_BREAKOUT_CONFIG,
  volumeSpike: DEFAULT_VOLUME_SPIKE_CONFIG,
  rsiDivergence: DEFAULT_RSI_DIVERGENCE_CONFIG,
  macdCross: DEFAULT_MACD_CROSS_CONFIG,
});
```

**Migration Steps:**
1. ✅ Keep definition in `packages/types/src/setupConfig.ts`
2. ❌ Remove from `apps/backend/src/services/setup-detection/SetupDetectionService.ts`
3. ❌ Remove from `apps/electron/src/renderer/services/setupDetection/SetupDetectionService.ts`
4. 🔄 Update imports in both service files:
   ```typescript
   // ❌ Before
   export interface SetupDetectionConfig { /* ... */ }
   
   // ✅ After
   import type { SetupDetectionConfig } from '@marketmind/types';
   import { createDefaultSetupDetectionConfig } from '@marketmind/types';
   ```

**Files to Update:**
- `apps/backend/src/services/setup-detection/SetupDetectionService.ts`
- `apps/electron/src/renderer/services/setupDetection/SetupDetectionService.ts`
- `apps/electron/src/renderer/store/setupConfig.ts`

**Tests to Run:**
- `apps/backend/src/services/setup-detection/__tests__/SetupDetectionService.test.ts`
- `apps/electron/src/renderer/services/setupDetection/__tests__/SetupDetectionService.test.ts`

#### 2.2 TradingSetup vs SetupDetection

**Current State:**
```typescript
// Frontend interface (packages/types/src/tradingSetup.ts)
export interface TradingSetup {
  type: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskReward: number;
  metadata: Record<string, unknown>;
}

// Backend database schema (apps/backend/src/db/schema.ts)
export const setupDetections = pgTable('setup_detections', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  interval: text('interval').notNull(),
  setupType: text('setup_type').notNull(),
  direction: text('direction').notNull(),
  entryPrice: numeric('entry_price').notNull(),
  stopLoss: numeric('stop_loss').notNull(),
  takeProfit: numeric('take_profit').notNull(),
  confidence: numeric('confidence').notNull(),
  riskReward: numeric('risk_reward').notNull(),
  metadata: jsonb('metadata'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
});

export type SetupDetection = typeof setupDetections.$inferSelect;
export type NewSetupDetection = typeof setupDetections.$inferInsert;
```

**Target State:**
```typescript
// ✅ packages/types/src/tradingSetup.ts
export interface TradingSetup {
  type: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskReward: number;
  metadata: Record<string, unknown>;
}

// ✅ apps/backend/src/db/schema.ts (keep as is, it's DB schema)
// But add conversion functions:

import type { TradingSetup } from '@marketmind/types';

export const toSetupDetection = (
  setup: TradingSetup,
  symbol: string,
  interval: string
): NewSetupDetection => ({
  symbol,
  interval,
  setupType: setup.type,
  direction: setup.direction,
  entryPrice: setup.entryPrice.toString(),
  stopLoss: setup.stopLoss.toString(),
  takeProfit: setup.takeProfit.toString(),
  confidence: setup.confidence.toString(),
  riskReward: setup.riskReward.toString(),
  metadata: setup.metadata,
});

export const fromSetupDetection = (detection: SetupDetection): TradingSetup => ({
  type: detection.setupType,
  direction: detection.direction as 'LONG' | 'SHORT',
  entryPrice: parseFloat(detection.entryPrice),
  stopLoss: parseFloat(detection.stopLoss),
  takeProfit: parseFloat(detection.takeProfit),
  confidence: parseFloat(detection.confidence),
  riskReward: parseFloat(detection.riskReward),
  metadata: detection.metadata as Record<string, unknown>,
});
```

**Migration Steps:**
1. ✅ Keep both types (different purposes: runtime vs DB)
2. ✅ Create conversion functions in `apps/backend/src/db/schema.ts`
3. 🔄 Update setup detection service to use conversions
4. ✅ Document the relationship

**Files to Update:**
- `apps/backend/src/db/schema.ts` - Add conversion functions
- `apps/backend/src/services/setup-detection/SetupDetectionService.ts` - Use conversions

---

### 🟢 Priority 3: Pattern Types

#### 3.1 PatternRelationship

**Current State:**
```typescript
// ❌ Duplicated in 2 places:
// apps/electron/src/renderer/utils/patternDetection/types.ts
// apps/electron/src/renderer/utils/patternDetection/core/patternRelationships.ts
```

**Target State:**
```typescript
// ✅ packages/types/src/pattern.ts
export interface PatternRelationship {
  pattern1: AIPattern;
  pattern2: AIPattern;
  timeOverlap: number;
  priceOverlap: number;
  isNested: boolean;
  isSequential: boolean;
  relationship: 'nested' | 'sequential' | 'overlapping' | 'independent';
}
```

**Migration Steps:**
1. ✅ Add to `packages/types/src/pattern.ts`
2. ❌ Remove from both locations
3. 🔄 Update imports

---

## 🚀 Migration Workflow

### Step-by-Step Process

1. **Create feature branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/type-consolidation
   ```

2. **Migrate one type group at a time**
   - Start with Priority 1 (Trading Core)
   - Then Priority 2 (Configuration)
   - Finally Priority 3 (Patterns)

3. **For each type:**
   ```bash
   # 1. Update/create shared type
   # 2. Remove duplicates
   # 3. Update imports
   # 4. Run type check
   pnpm --filter @marketmind/electron type-check
   pnpm --filter @marketmind/backend type-check
   
   # 5. Run tests
   pnpm test
   
   # 6. Commit if all pass
   git add .
   git commit -m "refactor: consolidate <TypeName> to shared package"
   ```

4. **Final validation**
   ```bash
   # Full monorepo check
   pnpm type-check
   pnpm test
   pnpm build
   
   # If all pass, push
   git push origin feature/type-consolidation
   ```

5. **Create PR to develop**

---

## ✅ Success Criteria

- [ ] All duplicated types removed
- [ ] Single import path for each type: `@marketmind/types`
- [ ] Zero new TypeScript errors
- [ ] 100% test pass rate (1,084+ tests)
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] Production builds verified

---

## 📊 Progress Tracking

### Priority 1: Trading Core ⏳
- [ ] Order types (OrderSide, OrderStatus)
- [ ] Binance types (BinanceOrderResult, etc.)
- [ ] Create packages/types/src/binance.ts
- [ ] Delete apps/backend/src/types/binance.ts
- [ ] Update ~15 import statements

### Priority 2: Configuration ⏳
- [ ] SetupDetectionConfig consolidation
- [ ] TradingSetup ↔ SetupDetection conversion functions
- [ ] Update 5 service files

### Priority 3: Patterns ⏳
- [ ] PatternRelationship consolidation
- [ ] Update pattern detection files

---

## 📝 Notes

- All migrations are **non-breaking** (TypeScript compiler validates)
- Each type group can be migrated **independently**
- Tests **must pass** after each migration
- No functionality changes, **only reorganization**
- **Low risk** operation (compiler catches all issues)

---

**Last Updated:** December 10, 2025  
**Next Review:** After Priority 1 completion
