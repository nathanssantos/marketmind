# MarketMind Trading Backend Migration Plan

## Executive Summary

The MarketMind application currently has **dual trading implementations**: a fully-functional **simulator mode** (frontend-only with Zustand + Electron storage) and a **partially implemented real trading mode** (backend with tRPC). This plan outlines the migration strategy to consolidate all trading logic into the backend while maintaining the simulator as a separate, isolated testing environment.

---

## 📊 Current State Analysis

### Frontend Trading Responsibilities (Simulator Mode)

**Location:** `apps/electron/src/renderer/store/tradingStore.ts` (825 lines)

**State Management:**
- `wallets: Wallet[]` - Wallet management with performance tracking
- `orders: Order[]` - Order lifecycle management
- `activeWalletId: string | null` - Active wallet selection
- `defaultQuantity: number` / `quantityBySymbol: Record<string, number>` - Position sizing
- `defaultExpiration: ExpirationType` - Order expiration settings
- `tradingFees: TradingFees` - Binance fee configuration (VIP levels, BNB discount)
- `isSimulatorActive: boolean` - Mode toggle

**Business Logic (28 actions):**
1. **Wallet Management** (7 actions)
   - `addWallet` - Create paper trading wallet
   - `updateWallet` - Modify wallet properties
   - `deleteWallet` - Remove wallet and associated orders
   - `setActiveWallet` - Switch active wallet
   - `getActiveWallet` - Retrieve current wallet
   - `updateWalletBalance` - Manual balance adjustments
   - `recordWalletPerformance` - Track equity curve

2. **Order Management** (10 actions)
   - `addOrder` - Create new order (market/limit/stop)
   - `updateOrder` - Modify order properties
   - `cancelOrder` - Cancel pending order
   - `closeOrder` - Close active position with PnL calculation
   - `getOrdersBySymbol` - Filter orders by symbol
   - `getOrdersByWallet` - Filter orders by wallet
   - `getActiveOrders` - Get all active/pending orders
   - `fillPendingOrders` - Process pending order execution
   - `activateOrder` - Manually activate pending order
   - `processExpiredOrders` - Process expired orders

3. **Position Management** (2 actions)
   - `getPositions` - Calculate current positions from orders
   - `getPositionBySymbol` - Get specific symbol position

4. **Trading Configuration** (5 actions)
   - `setDefaultQuantity` - Set default order size
   - `getQuantityForSymbol` - Get symbol-specific quantity
   - `setQuantityForSymbol` - Set symbol-specific quantity
   - `setDefaultExpiration` - Set default expiration type
   - `updateCurrentPrices` - Update current prices for open orders

5. **Fee Management** (2 actions)
   - `setTradingFees` - Configure Binance fee structure
   - `getTradingFees` - Retrieve current fee configuration

6. **Storage & Sync** (2 actions)
   - `loadFromStorage` - Load from secure storage
   - `saveToStorage` - Persist to secure storage
   - `resetSimulator` - Reset simulator

**Critical Logic:**
- **PnL Calculation:** Complex profit/loss computation with fees
- **Order Execution:** Price-based trigger logic for pending orders
- **Position Netting:** Automatic closing of opposite positions
- **Stop Loss/Take Profit:** Automatic execution on price triggers
- **Fee Calculation:** Entry/exit fee computation per trade
- **Performance Tracking:** Equity curve, win rate, drawdown

### Setup Detection (Auto-Trading)

**Frontend Location:** `apps/electron/src/renderer/services/setupDetection/`
- 13 detector classes (Setup91, Setup92, Setup93, Setup94, Pattern123, BullTrap, BearTrap, etc.)
- `SetupDetectionService.ts` (737 lines) - Orchestration layer

**Backend Location:** `apps/backend/src/services/setup-detection/`
- ✅ **Already migrated!** `SetupDetectionService.ts` (563 lines)
- Same 13 detector classes
- Database integration for caching
- Real-time detection via tRPC

**Auto-Trading Integration (ChartCanvas.tsx):**
- Lines 1040-1125: Setup detection loop
- Automatic order creation when setup triggers
- Fee viability checking before execution
- Integration with `tradingStore.addOrder`

**Status:** ✅ Setup detection is backend-ready but **order creation is still frontend-only**

### Trading Components

**Location:** `apps/electron/src/renderer/components/Trading/`

1. **OrderTicket.tsx** (294 lines)
   - Manual order creation form
   - ✅ Already supports both simulator and backend modes
   - Uses `useBackendTrading` for real mode

2. **OrdersList.tsx** (389 lines)
   - Display all orders with filters
   - ✅ Already supports both modes
   - Uses `useBackendTrading` and `useTradingStore`

3. **Portfolio.tsx** (176 lines)
   - Position summary and PnL display
   - ✅ Already supports both modes
   - Uses `useBackendTrading`

4. **WalletManager.tsx** (292 lines)
   - Wallet CRUD operations
   - ✅ Already supports backend via `useBackendWallet`
   - Simulator wallets remain frontend-only (expected)

5. **TradingSidebar.tsx** (73 lines)
   - Tab container for all trading panels
   - Mode toggle (simulator vs real)
   - ✅ Already supports both modes

**Status:** ✅ Components are backend-ready for **manual trading**

### Backend Implementation

**Routers:** `apps/backend/src/routers/`

1. **trading.ts** (441 lines) ✅
   - `placeOrder` - Place order on Binance
   - `cancelOrder` - Cancel Binance order
   - `getOrders` - Fetch order history
   - `syncOrders` - Sync from Binance
   - `getPositions` - Fetch positions
   - `updatePosition` - Manual position tracking
   - `closePosition` - Close position with PnL

2. **wallet.ts** (273 lines) ✅
   - `list` - Get user wallets
   - `create` - Create wallet with Binance API validation
   - `update` - Update wallet properties
   - `delete` - Remove wallet
   - `syncBalance` - Sync balance from Binance

3. **setup.ts** (425 lines) ✅
   - `detectCurrent` - Real-time setup detection
   - `detectHistorical` - Historical detection
   - `getDetected` - Fetch detected setups
   - `getPerformance` - Performance analytics
   - `getConfig` / `updateConfig` - Configuration management

**Database Schema:** `apps/backend/src/db/schema.ts`

Tables:
- ✅ `users` - Authentication
- ✅ `sessions` - Session management
- ✅ `wallets` - Wallet storage with encrypted API keys
- ✅ `orders` - Order tracking (Binance integration)
- ✅ `positions` - Position tracking
- ✅ `klines` - TimescaleDB for price data
- ✅ `trading_setups` - Legacy setup tracking
- ✅ `setup_detections` - New setup caching (24h expiration)
- ✅ `ai_conversations` / `ai_trades` - AI integration

**Status:** ✅ Backend infrastructure is **production-ready**

### Frontend Hooks

**Location:** `apps/electron/src/renderer/hooks/`

1. **useBackendTrading.ts** (123 lines) ✅
   - `placeOrder` mutation
   - `cancelOrder` mutation
   - `closePosition` mutation
   - `syncOrders` mutation
   - `updatePosition` mutation
   - `orders` query (with filters)
   - `positions` query
   - React Query integration for caching

2. **useBackendWallet.ts** (100 lines) ✅
   - `wallets` query
   - `createWallet` mutation
   - `updateWallet` mutation
   - `deleteWallet` mutation
   - `syncBalance` mutation
   - Full React Query integration

**Status:** ✅ Hooks are complete and tested

---

## 🎯 Target State

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (Electron)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐      ┌─────────────────────────┐  │
│  │  Simulator Mode  │      │   Real Trading Mode     │  │
│  │  (Frontend Only) │      │   (Backend Driven)      │  │
│  ├──────────────────┤      ├─────────────────────────┤  │
│  │ - Zustand Store  │      │ - tRPC Queries          │  │
│  │ - Local State    │      │ - React Query Cache     │  │
│  │ - Paper Trading  │      │ - Real Binance API      │  │
│  │ - No Backend     │      │ - Database Persistence  │  │
│  └──────────────────┘      └─────────────────────────┘  │
│           │                           │                 │
│           │                           │                 │
│           └───────────┬───────────────┘                 │
│                       │                                 │
│              ┌────────▼────────┐                        │
│              │ Trading UI      │                        │
│              │ Components      │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
                            │
                            │ tRPC (Real Mode Only)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 BACKEND (Fastify + tRPC)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Trading Business Logic                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ - Order Management (create, update, cancel)      │   │
│  │ - Position Tracking (open, close, PnL)           │   │
│  │ - Wallet Management (balance sync)               │   │
│  │ - Fee Calculation (Binance VIP levels)           │   │
│  │ - Auto-Trading (setup detection → order)         │   │
│  │ - Risk Management (position sizing, exposure)    │   │
│  └──────────────────────────────────────────────────┘   │
│                       │                                 │
│         ┌─────────────┼─────────────┐                   │
│         │             │             │                   │
│         ▼             ▼             ▼                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │PostgreSQL│  │ Binance  │  │WebSocket │               │
│  │  + TSDB  │  │   API    │  │  Server  │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────┘
```

### What Stays in Frontend

**Simulator Mode Only:**
- `tradingStore.ts` - Entire Zustand store (unchanged)
- Paper trading wallets
- Simulated order execution
- Local PnL calculation
- No database, no Binance API

**UI Components (Mode-Agnostic):**
- `OrderTicket.tsx` - Dual-mode form
- `OrdersList.tsx` - Dual-mode display
- `Portfolio.tsx` - Dual-mode positions
- `WalletManager.tsx` - Dual-mode wallets
- `TradingSidebar.tsx` - Mode toggle

**Chart Integration:**
- `ChartCanvas.tsx` - Setup detection rendering
- Manual order entry via keyboard shortcuts
- Visual feedback (order lines, SL/TP)

### What Moves to Backend

**New Backend Responsibilities:**

1. **Auto-Trading Service**
   - Setup detection → Order creation pipeline
   - Risk validation before execution
   - Fee viability checking
   - Position sizing rules
   - Maximum concurrent positions

2. **Order Execution Engine**
   - Binance API integration (already exists)
   - Order state machine (NEW → FILLED → CLOSED)
   - Stop loss / Take profit monitoring
   - Automatic position closing

3. **Position Management**
   - Real-time position aggregation
   - PnL calculation with fees
   - Position netting (long/short)
   - Exposure tracking

4. **Risk Management**
   - Per-wallet exposure limits
   - Maximum position size validation
   - Drawdown monitoring
   - Daily loss limits

5. **Performance Analytics**
   - Trade history aggregation
   - Win rate calculation
   - Risk/reward analytics
   - Setup type performance

**Database Additions:**

New tables needed:
```sql
-- Auto-trading configuration
auto_trading_config (
  id, user_id, wallet_id,
  is_enabled, max_concurrent_positions,
  max_position_size, daily_loss_limit,
  enabled_setup_types[], created_at, updated_at
)

-- Trade execution history
trade_executions (
  id, user_id, wallet_id, setup_id,
  entry_order_id, exit_order_id,
  entry_price, exit_price, quantity,
  pnl, pnl_percent, fees,
  opened_at, closed_at, status
)

-- Real-time price cache
price_cache (
  symbol, price, timestamp
) -- For WebSocket price tracking
```

---

## 🚀 Migration Strategy

### Phase 1: Auto-Trading Backend Service (Week 1)

**Goal:** Move setup-triggered order creation to backend

**Tasks:**

1. **Create Auto-Trading Router** (`apps/backend/src/routers/auto-trading.ts`)
   ```typescript
   export const autoTradingRouter = router({
     // Configuration
     getConfig: protectedProcedure.query(),
     updateConfig: protectedProcedure.mutation(),
     
     // Execution
     executeSetup: protectedProcedure.mutation(),
     cancelSetup: protectedProcedure.mutation(),
     
     // Monitoring
     getActiveSetups: protectedProcedure.query(),
     getExecutionHistory: protectedProcedure.query(),
   });
   ```

2. **Create Auto-Trading Service** (`apps/backend/src/services/auto-trading.ts`)
   - `createOrderFromSetup()` - Create orders from setup
   - `validateRiskLimits()` - Check exposure limits
   - `calculatePositionSize()` - Apply sizing rules
   - `buildOrderParams()` - Generate order objects

3. **Database Migrations**
   - Create `auto_trading_config` table
   - Create `trade_executions` table
   - Add indices for performance

4. **Frontend Hook** (`useBackendAutoTrading.ts`)
   ```typescript
   export const useBackendAutoTrading = (walletId: string) => {
     const config = useQuery(['autoTrading', 'config', walletId]);
     const updateConfig = useMutation('autoTrading.updateConfig');
     const executeSetup = useMutation('autoTrading.executeSetup');
     return { config, updateConfig, executeSetup };
   };
   ```

5. **Migrate ChartCanvas Auto-Trading**
   - Replace `tradingStore.addOrder` call with `executeSetup.mutate`
   - Remove fee calculation (moved to backend)
   - Keep setup detection rendering

**Testing:**
- Unit tests for auto-trading service
- Integration tests for setup → order flow
- E2E test: Detect setup → Create order on Binance testnet

### Phase 2: Position Monitoring Service (Week 2)

**Goal:** Monitor active positions and execute SL/TP automatically

**Tasks:**

1. **Create Position Monitor Service** (`apps/backend/src/services/position-monitor.ts`)
   - `checkStopLoss()` - Check SL/TP conditions
   - `executeExit()` - Execute closing order
   - `updatePrices()` - Real-time price updates

2. **WebSocket Price Integration**
   - Subscribe to Binance price streams per active position
   - Cache latest prices in Redis/memory
   - Trigger SL/TP checks on price updates

3. **Scheduled Jobs**
   - Cron job: Check all positions every 1 minute (fallback)
   - WebSocket: Real-time checks (primary)

4. **Frontend WebSocket Hook** (`usePositionUpdates.ts`)
   ```typescript
   export const usePositionUpdates = (walletId: string) => {
     const { data: positions } = useBackendTrading(walletId);
     useWebSocket(`wallet:${walletId}:positions`, (update) => {
       queryClient.setQueryData(['positions', walletId], update);
     });
   };
   ```

**Testing:**
- Mock WebSocket price feeds
- Test SL/TP execution logic
- Test position aggregation accuracy

### Phase 3: Risk Management Layer (Week 3)

**Goal:** Add risk controls to prevent over-leveraging

**Tasks:**

1. **Create Risk Manager Service** (`apps/backend/src/services/risk-manager.ts`)
   - `validateNewPosition()` - Check limits
   - `calculateExposure()` - Total open positions value
   - `checkDailyDrawdown()` - Daily drawdown limit

2. **Add Risk Validation to Order Creation**
   ```typescript
   // In autoTradingRouter.executeSetup
   const riskCheck = await riskManager.validate(walletId, setup);
   if (!riskCheck.isValid) {
     throw new TRPCError({ code: 'BAD_REQUEST', message: riskCheck.reason });
   }
   ```

3. **Frontend Risk Display**
   - Show current exposure in TradingSidebar
   - Warning indicators when approaching limits
   - Risk configuration UI in settings

**Testing:**
- Test exposure calculation accuracy
- Test limit enforcement
- Test concurrent position limits

### Phase 4: Performance Analytics (Week 4)

**Goal:** Comprehensive trading analytics

**Tasks:**

1. **Create Analytics Router** (`apps/backend/src/routers/analytics.ts`)
   ```typescript
   export const analyticsRouter = router({
     getTradeHistory: protectedProcedure.query(),
     getPerformance: protectedProcedure.query(), // Win rate, profit factor
     getSetupStats: protectedProcedure.query(),  // Performance by setup type
     getEquityCurve: protectedProcedure.query(), // Balance over time
   });
   ```

2. **Database Queries**
   - Aggregate PnL by time period
   - Calculate win rate, profit factor, Sharpe ratio
   - Setup type performance comparison

3. **Frontend Components**
   - `PerformancePanel.tsx` - Dashboard with charts
   - `EquityCurveChart.tsx` - Line chart (already exists in simulator)
   - `SetupStatsTable.tsx` - Performance by setup type

**Testing:**
- Test PnL aggregation accuracy
- Test statistical calculations
- Test with large datasets (>10k trades)

### Phase 5: Cleanup & Documentation (Week 5)

**Goal:** Finalize migration and update docs

**Tasks:**

1. **Remove Deprecated Code**
   - Mark `tradingStore.addOrder` usage in ChartCanvas as deprecated
   - Add migration notices to `tradingStore.ts`
   - Remove unused frontend business logic

2. **Update Documentation**
   - `docs/AUTO_TRADING_BACKEND.md` - Architecture overview
   - `docs/TRADING_API_REFERENCE.md` - API endpoints
   - `docs/MIGRATION_GUIDE.md` - Frontend changes

3. **Add Monitoring**
   - Log all order executions
   - Alert on API errors
   - Dashboard for active auto-trading status

**Testing:**
- Full regression test suite
- Performance testing (1000 concurrent positions)
- Failover testing (Binance API downtime)

---

## 🔌 API Endpoints Needed

### Auto-Trading Router (`autoTradingRouter`)

```typescript
{
  // Configuration
  getConfig(walletId: string): AutoTradingConfig
  updateConfig(walletId: string, config: Partial<AutoTradingConfig>): void
  
  // Execution
  executeSetup(setupId: string, walletId: string): { orderId: number }
  cancelSetup(setupId: string): void
  
  // Monitoring
  getActiveSetups(walletId: string): Setup[]
  getExecutionHistory(walletId: string, filters?: {}): TradeExecution[]
}
```

### Risk Management Router (`riskRouter`)

```typescript
{
  validateNewPosition(walletId: string, setup: Setup): { isValid: boolean, reason?: string }
  getCurrentExposure(walletId: string): { totalValue: number, maxAllowed: number }
  getDailyPnL(walletId: string): { pnl: number, limit: number }
}
```

### Analytics Router (`analyticsRouter`)

```typescript
{
  getTradeHistory(walletId: string, filters?: {}): Trade[]
  getPerformance(walletId: string, period: 'day' | 'week' | 'month' | 'all'): Performance
  getSetupStats(walletId: string): SetupPerformance[]
  getEquityCurve(walletId: string, interval: '1h' | '1d'): EquityPoint[]
}
```

---

## 📊 Data Models Needed

### Auto-Trading Configuration

```typescript
interface AutoTradingConfig {
  id: string;
  userId: string;
  walletId: string;
  isEnabled: boolean;
  maxConcurrentPositions: number;
  maxPositionSize: number; // % of wallet balance
  dailyLossLimit: number;  // % of wallet balance
  enabledSetupTypes: SetupType[];
  positionSizing: 'fixed' | 'percentage' | 'kelly';
  createdAt: Date;
  updatedAt: Date;
}
```

### Trade Execution

```typescript
interface TradeExecution {
  id: string;
  userId: string;
  walletId: string;
  setupId: string;
  setupType: SetupType;
  entryOrderId: number;
  exitOrderId?: number;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  openedAt: Date;
  closedAt?: Date;
  status: 'open' | 'closed' | 'cancelled';
}
```

---

## ⚠️ Breaking Changes

### For Users

**None** - Migration is transparent:
- Simulator mode unchanged
- Real trading gains auto-trading features
- UI remains the same

### For Developers

1. **ChartCanvas Auto-Trading**
   ```typescript
   // ❌ OLD (deprecated)
   addOrder({ symbol, walletId, entryPrice, ... });
   
   // ✅ NEW
   executeSetup.mutate({ setupId, walletId });
   ```

2. **Setup Detection**
   ```typescript
   // ❌ OLD (still works, but redundant)
   const setupDetector = new SetupDetectionService(config);
   const setups = setupDetector.detectSetups(klines);
   
   // ✅ NEW (backend-powered)
   const { data: setups } = trpc.setup.detectCurrent.useQuery({ symbol, interval });
   ```

---

## 🧪 Testing Strategy

### Unit Tests

**Backend:**
- Auto-trading service (50+ tests)
- Risk manager (30+ tests)
- Position monitor (40+ tests)
- Analytics queries (20+ tests)

**Frontend:**
- Hook behavior (20+ tests)
- Component rendering (15+ tests)

### Integration Tests

- Setup detection → Order creation flow
- WebSocket price updates → Position monitoring
- Risk validation → Order rejection
- Trade execution → Analytics update

### E2E Tests

1. **Happy Path:**
   - Detect setup → Create order → Fill → Hit TP → Close → Record PnL
   
2. **Risk Rejection:**
   - Detect setup → Risk check fails → No order created

3. **Stop Loss:**
   - Open position → Price drops → SL triggered → Position closed

4. **Concurrent Positions:**
   - Multiple setups → Max limit reached → New orders blocked

### Performance Tests

- 1000 concurrent positions monitoring
- 100 setups detected per second
- 10,000 trade history queries

---

## 📅 Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Auto-Trading Backend | Router, service, migrations, tests |
| 2 | Position Monitoring | WebSocket integration, SL/TP execution |
| 3 | Risk Management | Exposure limits, daily loss limits |
| 4 | Performance Analytics | Charts, statistics, reports |
| 5 | Cleanup & Docs | Remove deprecated code, update docs |

**Total Duration:** 5 weeks  
**Estimated Effort:** 120 hours

---

## 🎯 Success Criteria

1. ✅ All 1,894 frontend tests passing
2. ✅ All 47+ backend tests passing (new tests added)
3. ✅ Zero TypeScript errors
4. ✅ Auto-trading works end-to-end (setup → order → fill → close)
5. ✅ WebSocket position monitoring with <1s latency
6. ✅ Risk limits enforced 100% of the time
7. ✅ Performance analytics match simulator accuracy
8. ✅ Documentation complete

---

## 🔐 Security Considerations

1. **API Key Encryption:**
   - ✅ Already implemented (AES-256-CBC)
   - Backend stores encrypted keys only

2. **Order Validation:**
   - ✅ Server-side validation only (no client trust)
   - Risk checks cannot be bypassed

3. **Rate Limiting:**
   - Add rate limits to auto-trading endpoints
   - Prevent spam order creation

4. **Audit Logging:**
   - Log all order executions with timestamps
   - Track who enabled/disabled auto-trading

---

## 📝 Notes

### Why Keep Simulator in Frontend?

- **Instant Feedback:** No network latency for paper trading
- **Offline Testing:** Works without backend
- **Simplicity:** No database overhead for testing
- **Clear Separation:** Avoid mixing test data with real trades

### Why Not Migrate Simulator to Backend?

- **Complexity:** Adds unnecessary database load
- **Latency:** Real-time updates slower
- **Maintenance:** Doubles backend logic
- **User Experience:** Slower paper trading experience

### Migration Philosophy

**"Move only what needs to move"**
- Simulator stays frontend (by design)
- Real trading moves to backend (for safety & coordination)
- UI components remain mode-agnostic (reusable)

---

## 🚀 Next Steps

1. **Review & Approve Plan**
2. **Create GitHub Issues for Each Phase**
3. **Set Up Backend Test Environment**
4. **Begin Phase 1 Implementation**

---

**End of Migration Plan**
