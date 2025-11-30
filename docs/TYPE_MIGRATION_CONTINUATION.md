# Type System Migration - Continuation Guide

## 🎯 Mission Critical

**Objective:** Complete migration to Binance-aligned type system with proper OCO (One-Cancels-Other) order list implementation.

**Current Status:** Type definitions updated to match Binance API, implementing OCO pattern where stop-loss and take-profit are separate orders linked via orderListId.

**Key Changes:**
- ✅ Stop-loss and take-profit are now separate Order entries (not embedded fields)
- ✅ Orders are linked via OrderList with orderListId
- ✅ OCO (One-Cancels-Other) pattern matches Binance implementation
- ✅ Native format matching exchange APIs (strings for prices/quantities)
- ✅ No "Binance" or "Exchange" prefixes in type names
- ✅ Clean implementation without deprecated types or legacy traces
- ✅ All tests must pass before committing
- ✅ **ABSOLUTELY NO CODE COMMENTS** - Follow `copilot-instructions.md` rule strictly
- ✅ **ALL copilot-instructions.md rules must be followed** - No exceptions

---

## 📊 Binance OCO Pattern Overview

### How Binance Handles Stop-Loss and Take-Profit

In Binance, stop-loss (SL) and take-profit (TP) are **separate orders** linked together via an **Order List** (OCO - One-Cancels-Other):

1. **Entry Order**: Regular LIMIT or MARKET order (orderListId = -1)
2. **OCO Order List**: Created when entry fills, containing:
   - **Stop-Loss Order**: STOP_LOSS or STOP_LOSS_LIMIT with stopPrice
   - **Take-Profit Order**: LIMIT_MAKER or TAKE_PROFIT_LIMIT with price
3. **Linking**: Both SL and TP orders share the same `orderListId`
4. **Cancellation**: When one order fills, the other is automatically canceled

### Example Structure

```typescript
const entryOrder: Order = {
  orderId: 1,
  orderListId: -1,
  type: 'LIMIT',
  side: 'BUY',
  price: '50000.00',
  origQty: '1.0',
  status: 'FILLED',
  symbol: 'BTCUSDT',
  clientOrderId: 'entry_001',
  executedQty: '1.0',
  cummulativeQuoteQty: '50000.00',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: false,
  timeInForce: 'GTC',
  origQuoteOrderQty: '0',
};

const ocoList: OrderList = {
  orderListId: 100,
  contingencyType: 'OCO',
  listStatusType: 'EXEC_STARTED',
  listOrderStatus: 'EXECUTING',
  listClientOrderId: 'oco_001',
  transactionTime: Date.now(),
  symbol: 'BTCUSDT',
  orders: [
    { symbol: 'BTCUSDT', orderId: 2, clientOrderId: 'sl_001' },
    { symbol: 'BTCUSDT', orderId: 3, clientOrderId: 'tp_001' },
  ],
};

const stopLossOrder: Order = {
  orderId: 2,
  orderListId: 100,
  type: 'STOP_LOSS_LIMIT',
  side: 'SELL',
  stopPrice: '48000.00',
  price: '47900.00',
  origQty: '1.0',
  status: 'NEW',
  symbol: 'BTCUSDT',
  clientOrderId: 'sl_001',
  executedQty: '0',
  cummulativeQuoteQty: '0',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: true,
  timeInForce: 'GTC',
  origQuoteOrderQty: '0',
};

const takeProfitOrder: Order = {
  orderId: 3,
  orderListId: 100,
  type: 'LIMIT_MAKER',
  side: 'SELL',
  price: '55000.00',
  origQty: '1.0',
  status: 'NEW',
  symbol: 'BTCUSDT',
  clientOrderId: 'tp_001',
  executedQty: '0',
  cummulativeQuoteQty: '0',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: true,
  timeInForce: 'GTC',
  origQuoteOrderQty: '0',
};
```

---

---

## 📊 Migration Overview

### What Changed

#### 1. Order Model - Stop-Loss and Take-Profit

**BEFORE (Legacy):**
```typescript
interface Order {
  id: string;
  type: 'long' | 'short';
  status: 'pending' | 'active' | 'filled' | 'cancelled';
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  currentPrice?: number;
}
```

**AFTER (Binance-aligned):**
```typescript
interface Order {
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  price: string;
  origQty: string;
  stopPrice?: string;
  executedQty: string;
}

interface OrderList {
  orderListId: number;
  contingencyType: 'OCO' | 'OTO' | 'OTOCO';
  listStatusType: ListStatusType;
  listOrderStatus: ListOrderStatus;
  orders: Array<{ orderId: number; clientOrderId: string }>;
}
```

**Key Breaking Changes:**
- `stopLoss` and `takeProfit` **removed** from Order interface
- SL/TP are now **separate Order entries** with `type: 'STOP_LOSS_LIMIT'` or `'LIMIT_MAKER'`
- Orders linked via `orderListId` (shared by entry, SL, and TP orders)
- Use `OrderList` to manage OCO relationships
- `order.id` → `order.clientOrderId` (string identifier)
- `order.type: 'long'/'short'` → `order.side: 'BUY'/'SELL'`
- `order.status: 'pending'` → `order.status: 'NEW'`
- `order.status: 'active'` → `order.status: 'PARTIALLY_FILLED'` (or use `isWorking: boolean`)
- `order.quantity` → `order.origQty` (as string)
- `order.entryPrice` → `order.price` (as string)
- All prices/quantities are **strings**, not numbers

#### 2. Candle/Kline Types (No Changes)

```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}
```

---

## 🔴 Components with Type Errors (100+)

### Critical Migration Steps (in order)

**IMPORTANT:** Stop-loss and take-profit are now **separate orders** linked via `OrderList` (OCO pattern).  
See **[BINANCE_OCO_PATTERN.md](./BINANCE_OCO_PATTERN.md)** for complete OCO implementation guide.

1. **`src/shared/types/trading.ts`** (Priority 1 - DONE)
   - [x] Added `OrderList` interface
   - [x] Added `ContingencyType`, `ListStatusType`, `ListOrderStatus` types  
   - [x] Removed `stopLoss`, `takeProfit` from Order interface
   - [x] Orders now linked via `orderListId`

2. **`src/renderer/store/tradingStore.ts`** (Priority 1)
   - [ ] Add `orderLists: OrderList[]` to state
   - [ ] Implement `createOCO(entryOrderId, stopLossPrice, takeProfitPrice)` action
   - [ ] Update `fillPendingOrders` to create OCO when entry fills
   - [ ] Update `processOrders` to handle OCO execution (one fills, other cancels)
   - [ ] Remove all `order.stopLoss` and `order.takeProfit` references
   - [ ] Change `order.type === 'long'` to `order.side === 'BUY'`
   - [ ] Change `order.status === 'pending'` to `order.status === 'NEW'`
   - [ ] Convert number prices to strings using `formatPrice()`
   - Expected errors: 30+
   - Impact: Core trading logic

3. **`src/renderer/components/Chart/ChartCanvas.tsx`** (Priority 1)
   - [ ] Remove SL/TP input fields from order creation
   - [ ] Entry orders should have `orderListId: -1`
   - [ ] Call store `createOCO()` after entry fills (if SL/TP desired)
   - [ ] Change `type: 'long'/'short'` to `side: 'BUY'/'SELL'`
   - [ ] Change `status: 'pending'` to `status: 'NEW'`
   - [ ] Convert prices to strings: `formatPrice(numericPrice)`
   - Expected errors: 30+
   - Impact: Order creation UI

4. **`src/renderer/components/Chart/ChartTooltip.tsx`** (Priority 2)
   - [ ] Update order display to show OCO relationship
   - [ ] Show linked orders (entry → SL + TP)
   - [ ] Change `order.type === 'long'` to `order.side === 'BUY'`
   - [ ] Change `order.status === 'active'` to check `order.isWorking`
   - [ ] Parse string prices: `parsePrice(order.price)`
   - Expected errors: 20+
   - Impact: User feedback

5. **`src/renderer/components/Chart/useOrderLinesRenderer.ts`** (Priority 2)
   - [ ] Render separate lines for entry, SL, and TP orders
   - [ ] Visual distinction (colors) for OCO-linked orders
   - [ ] Query orders by `orderListId` to find related orders
   - [ ] Parse prices from strings
   - Expected errors: 15+
   - Impact: Visual representation

6. **`src/renderer/components/Chart/useOrderDragHandler.ts`** (Priority 3)
   - [ ] Allow dragging individual SL/TP orders (not fields)
   - [ ] Update `order.price` or `order.stopPrice` (as string)
   - Expected errors: 10+
   - Impact: UX feature

7. **`src/renderer/App.tsx`** (Priority 3)
   - [ ] Update order monitoring to handle OCO lists
   - [ ] Check for filled entry orders and create OCO
   - [ ] Monitor OCO execution (SL/TP triggers)
   - Expected errors: 5+
   - Impact: App-level logic

8. **Test Files** (Priority 4)
   - [ ] Update all test mocks to use new Order structure
   - [ ] Add OCO creation and execution tests
   - [ ] Test one-cancels-other behavior
   - Expected errors: 20+
   - Impact: Test coverage

---

## 🛠️ Migration Strategy

### Phase 1: Core Store (Start Here)

**File:** `src/renderer/store/tradingStore.ts`

**Tasks:**
- [ ] Update Order creation logic to use new field names
- [ ] Change `type: 'long'/'short'` to `side: 'BUY'/'SELL'`
- [ ] Change `status: 'pending'` to `status: 'NEW'`
- [ ] Update price/quantity handling to use strings
- [ ] Use `priceUtils` for string/number conversions
- [ ] Update all Order property access (id → clientOrderId, etc.)
- [ ] Test store actions work correctly

**Code Patterns:**
```typescript
// Import utilities
import { parsePrice, formatPrice, parseQty, formatQty, calculatePnL } from '@shared/utils';

// Creating orders
const newOrder: Order = {
  symbol: 'BTCUSDT',
  orderId: Date.now(),
  clientOrderId: `order_${Date.now()}`,
  price: formatPrice(priceNumber),        // number → string
  origQty: formatQty(quantityNumber),     // number → string
  executedQty: '0',
  status: 'NEW',                          // not 'pending'
  side: 'BUY',                            // not 'long'
  type: 'LIMIT',
  time: Date.now(),
  updateTime: Date.now(),
  // ... rest
};

// Accessing prices/quantities
const priceNum = parsePrice(order.price);           // string → number
const qtyNum = parseQty(order.origQty);             // string → number

// Calculating PnL
const pnl = calculatePnL(
  order.price,              // entry (string)
  currentPrice,             // exit (string)
  order.origQty,            // quantity (string)
  order.side                // 'BUY' or 'SELL'
);
```

### Phase 2: Chart Components

**Files (in order):**
1. `ChartCanvas.tsx`
2. `ChartTooltip.tsx`
3. `useOrderLinesRenderer.ts`
4. `useOrderDragHandler.ts`

**Common Patterns:**

```typescript
// ❌ OLD
if (order.type === 'long') { }
if (order.status === 'pending') { }
const price = order.entryPrice;
const qty = order.quantity;
const display = price.toFixed(2);

// ✅ NEW
if (order.side === 'BUY') { }
if (order.status === 'NEW') { }
const price = parsePrice(order.price);
const qty = parseQty(order.origQty);
const display = parsePrice(order.price).toFixed(2);
```

**Display Logic:**
```typescript
// Format for display
const formattedPrice = parsePrice(order.price).toFixed(precision);
const formattedQty = parseQty(order.origQty).toFixed(quantityPrecision);

// Status labels
const statusLabel = order.status; // Already uppercase: 'NEW', 'FILLED', etc.

// Side labels
const sideLabel = order.side; // 'BUY' or 'SELL'
const colorClass = order.side === 'BUY' ? 'text-green-500' : 'text-red-500';
```

### Phase 3: Tests

**Pattern:**
```typescript
// Update test data
const mockOrder: Order = {
  symbol: 'BTCUSDT',
  orderId: 12345,
  clientOrderId: 'test_order_1',
  price: '50000.00',           // STRING
  origQty: '1.5',              // STRING
  executedQty: '0',
  status: 'NEW',               // Not 'pending'
  side: 'BUY',                 // Not 'long'
  type: 'LIMIT',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: true,
  cummulativeQuoteQty: '0',
  timeInForce: 'GTC',
  orderListId: -1,
  origQuoteOrderQty: '0',
};

// Update assertions
expect(result.side).toBe('BUY');          // not 'long'
expect(result.status).toBe('NEW');        // not 'pending'
expect(parsePrice(result.price)).toBe(50000);  // parse string to number
```

---

## 🧰 Available Utilities

### Price/Quantity Utilities (`src/shared/utils/priceUtils.ts`)

```typescript
// String ↔ Number conversion
parsePrice(price: string | number): number
formatPrice(price: number, precision?: number): string
parseQty(qty: string | number): number
formatQty(qty: number, precision?: number): string

// Calculations (with strings)
calculatePnL(
  entryPrice: string | number,
  exitPrice: string | number,
  quantity: string | number,
  side: 'BUY' | 'SELL'
): string

calculatePnLPercent(
  entryPrice: string | number,
  exitPrice: string | number,
  side: 'BUY' | 'SELL'
): string

// Price comparison
comparePrices(a: string | number, b: string | number): number
```

**Usage Examples:**
```typescript
import { parsePrice, formatPrice, calculatePnL } from '@shared/utils';

// Converting for calculations
const numericPrice = parsePrice(order.price);
const numericQty = parseQty(order.origQty);
const total = numericPrice * numericQty;

// Converting back to string
const updatedOrder = {
  ...order,
  price: formatPrice(newPrice),
};

// PnL calculation
const pnl = calculatePnL(
  order.price,         // '50000.00'
  currentPrice,        // '52000.00'
  order.origQty,       // '1.5'
  order.side           // 'BUY'
);
// Returns: '3000.00' (as string)
```

---

## 🔍 Common Error Patterns & Fixes

### Error: Property 'id' does not exist on type 'Order'
```typescript
// ❌ OLD
const orderId = order.id;

// ✅ NEW
const orderId = order.clientOrderId;
```

### Error: Property 'entryPrice' does not exist
```typescript
// ❌ OLD
const price = order.entryPrice;

// ✅ NEW
const price = parsePrice(order.price);
```

### Error: Property 'quantity' does not exist
```typescript
// ❌ OLD
const qty = order.quantity;

// ✅ NEW
const qty = parseQty(order.origQty);
```

### Error: Type '"long"' is not assignable to type 'OrderType'
```typescript
// ❌ OLD
const newOrder = { type: 'long', ... };

// ✅ NEW
const newOrder = { side: 'BUY', type: 'LIMIT', ... };
```

### Error: Type '"pending"' is not assignable to 'OrderStatus'
```typescript
// ❌ OLD
if (order.status === 'pending') { }

// ✅ NEW
if (order.status === 'NEW') { }
```

### Error: Type 'number' is not assignable to type 'string'
```typescript
// ❌ OLD (in Order creation)
const order = {
  price: 50000,
  quantity: 1.5,
};

// ✅ NEW
const order = {
  price: formatPrice(50000),
  origQty: formatQty(1.5),
};
```

### Error: Property 'toFixed' does not exist on type 'string'
```typescript
// ❌ OLD
const display = order.price.toFixed(2);

// ✅ NEW
const display = parsePrice(order.price).toFixed(2);
```

---

## 📋 Migration Checklist

### Before Starting
- [x] All deprecated types removed from type files
- [x] Type files cleaned (no @deprecated tags)
- [x] priceUtils.ts created and exported
- [ ] Read this document thoroughly
- [ ] **Read copilot-instructions.md thoroughly** - ALL rules apply
- [ ] Understand breaking changes
- [ ] Review priceUtils functions
- [ ] **Remember: ZERO code comments allowed - use self-documenting code and README files**

### Phase 1: Core Store
- [ ] Fix tradingStore.ts Order creation
- [ ] Fix tradingStore.ts Order updates
- [ ] Fix tradingStore.ts Order queries
- [ ] Test store actions manually
- [ ] Run type-check: `npm run type-check`
- [ ] Verify no errors in tradingStore.ts

### Phase 2: Chart Components
- [ ] Fix ChartCanvas.tsx
- [ ] Fix ChartTooltip.tsx
- [ ] Fix useOrderLinesRenderer.ts
- [ ] Fix useOrderDragHandler.ts
- [ ] Run type-check: `npm run type-check`
- [ ] Verify no chart component errors

### Phase 3: Other Components
- [ ] Fix App.tsx
- [ ] Fix any other components with Order usage
- [ ] Run type-check: `npm run type-check`
- [ ] Verify zero TypeScript errors

### Phase 4: Tests
- [ ] Update all Order-related test mocks
- [ ] Fix test assertions
- [ ] Run tests: `npm run test:run`
- [ ] Run browser tests: `npm run test:browser:run`
- [ ] Verify all tests passing

### Phase 5: Validation
- [ ] Run full type-check
- [ ] Run full test suite
- [ ] Test app manually (create orders, view chart, etc.)
- [ ] Verify no console errors
- [ ] Verify UI works correctly
- [ ] Check order tooltips display correctly
- [ ] Check order lines render correctly
- [ ] Check order dragging works

### Phase 6: Cleanup
- [ ] Remove any temporary debugging code
- [ ] Remove any console.log statements
- [ ] **Remove ALL code comments** - ZERO tolerance
- [ ] Verify no hardcoded strings (all i18n)
- [ ] Check for code duplication
- [ ] **Verify ALL copilot-instructions.md rules followed**
- [ ] Update CHANGELOG.md
- [ ] Create feature branch: `git checkout -b refactor/type-system-migration`
- [ ] Commit with message: `refactor: complete type system migration to exchange format`
- [ ] Push and create PR to develop

---

## 🚨 Critical Rules

**MANDATORY:** Follow ALL rules from `copilot-instructions.md` WITHOUT EXCEPTION.

1. **🔴 NEVER commit with failing tests**
   - Run `npm run test:run` before EVERY commit
   - Run `npm run test:browser:run` before EVERY commit
   - ALL tests must pass

2. **🔴 NEVER commit with TypeScript errors**
   - Run `npm run type-check` before committing
   - Fix ALL errors before proceeding

3. **🔴 NEVER use `any` type**
   - Always use proper types
   - Use `unknown` if type is truly unknown

4. **🔴 ABSOLUTELY NO CODE COMMENTS**
   - ZERO tolerance for inline comments
   - ZERO tolerance for block comments
   - ZERO tolerance for TODO/FIXME/NOTE comments
   - Use self-documenting code (descriptive names, clear logic)
   - Use README files for documentation
   - This rule is NON-NEGOTIABLE

5. **🔴 NEVER commit to main/develop**
   - Always create feature/bugfix branch
   - Open PR for review

6. **🔴 NEVER skip priceUtils**
   - Always use `parsePrice`, `formatPrice`, etc.
   - Never manually convert strings to numbers

7. **🔴 FOLLOW copilot-instructions.md STRICTLY**
   - Read it before starting migration
   - Every rule applies (no magic numbers, early returns, one-line conditionals, etc.)
   - English only in code and commits
   - Latest library versions with official docs
   - Responsive design
   - No hardcoded strings (i18n)
   - DRY principles
   - Single-line blocks when appropriate

---

## 📚 Reference Documentation

### Critical Reading (MANDATORY)
- **`.github/copilot-instructions.md`** - ALL rules must be followed
- **`docs/TYPE_MIGRATION_CONTINUATION.md`** - This document (migration overview)
- **`docs/BINANCE_OCO_PATTERN.md`** - OCO implementation guide (stop-loss/take-profit)

### Related Files
- `docs/BINANCE_TYPE_ALIGNMENT.md` - Detailed type mappings
- `docs/STORAGE_GUIDE.md` - Storage patterns
- `src/shared/utils/priceUtils.ts` - Price utilities
- `src/shared/types/trading.ts` - Trading types (Order, OrderList)
- `src/shared/types/candle.ts` - Candle/Kline types

### Binance API Documentation
- [Binance REST API](https://developers.binance.com/docs/binance-spot-api-docs/rest-api)
- [OCO Order Lists](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#new-order-list---oco-trade)
- [Order Types and Structures](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#new-order-trade)

### Key Enums Reference
```typescript
// OrderStatus
'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED' | 'EXPIRED_IN_MATCH' | 'PENDING_NEW'

// OrderSide
'BUY' | 'SELL'

// OrderType
'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER'

// TimeInForce
'GTC' | 'IOC' | 'FOK'

// ContingencyType (Order Lists)
'OCO' | 'OTO' | 'OTOCO'

// ListOrderStatus
'EXECUTING' | 'ALL_DONE' | 'REJECT'
```

---

## 🎯 Success Criteria

Migration is complete when:
- ✅ Zero TypeScript errors (`npm run type-check`)
- ✅ All tests passing (`npm run test:run` + `npm run test:browser:run`)
- ✅ **ZERO code comments in ANY file** (critical requirement)
- ✅ All copilot-instructions.md rules followed
- ✅ App runs without console errors
- ✅ Orders follow Binance OCO pattern (stop-loss/take-profit as separate orders)
- ✅ OrderList properly links OCO orders via orderListId
- ✅ One-cancels-other behavior works correctly
- ✅ Order tooltips display OCO relationships
- ✅ Order lines render for entry, SL, and TP separately
- ✅ Order dragging works for individual SL/TP orders
- ✅ No deprecated types in codebase
- ✅ No legacy type mappers used
- ✅ All prices/quantities as strings in Order interface
- ✅ priceUtils used throughout for conversions
- ✅ Simulator behavior matches Binance real trading API

---

## 💡 Tips

1. **Understand OCO Pattern First**
   - Read `BINANCE_OCO_PATTERN.md` thoroughly
   - Stop-loss and take-profit are **separate orders**, not fields
   - Orders are linked via `orderListId`
   - When one fills, the other is canceled automatically

2. **Work incrementally**
   - Fix one file at a time
   - Run type-check after each file
   - Don't try to fix everything at once

3. **Use Find & Replace wisely**
   - Replace `order.stopLoss` with queries for linked SL order
   - Replace `order.takeProfit` with queries for linked TP order
   - Replace `order.id` → `order.clientOrderId`
   - Replace `order.entryPrice` → `parsePrice(order.price)`
   - Replace `order.quantity` → `parseQty(order.origQty)`
   - Replace `order.type === 'long'` → `order.side === 'BUY'`
   - Replace `order.status === 'pending'` → `order.status === 'NEW'`
   - But REVIEW each replacement!

4. **Test OCO behavior**
   - Create entry order
   - Entry fills → OCO created with SL + TP
   - SL triggers → TP canceled
   - TP triggers → SL canceled
   - Manual cancel → entire OCO list canceled

5. **Refer to priceUtils**
   - When you need to convert string → number: `parsePrice`, `parseQty`
   - When you need to convert number → string: `formatPrice`, `formatQty`
   - When you need calculations: `calculatePnL`, `calculatePnLPercent`

6. **Query for linked orders**
   ```typescript
   const getLinkedOrders = (orderListId: number): Order[] => {
     return orders.filter(o => o.orderListId === orderListId);
   };
   
   const getStopLoss = (orderListId: number): Order | null => {
     return orders.find(o => 
       o.orderListId === orderListId && 
       (o.type === 'STOP_LOSS' || o.type === 'STOP_LOSS_LIMIT')
     ) || null;
   };
   
   const getTakeProfit = (orderListId: number): Order | null => {
     return orders.find(o => 
       o.orderListId === orderListId && 
       (o.type === 'TAKE_PROFIT' || o.type === 'TAKE_PROFIT_LIMIT' || o.type === 'LIMIT_MAKER')
     ) || null;
   };
   ```

7. **Code cleanliness is CRITICAL**
   - No comments allowed (use self-documenting code)
   - No magic numbers (extract to constants)
   - No `any` types
   - No hardcoded strings (use i18n)
   - Single-line blocks when appropriate: `if (condition) return value;`
   - Early returns over nested ifs

8. **Before each commit, verify**
   ```bash
   npm run type-check      # Must pass
   npm run test:run        # Must pass
   npm run test:browser:run # Must pass
   npm run lint            # Must pass
   grep -r "\/\/" src/     # Must return empty (no // comments)
   grep -r "\/\*" src/     # Must return empty (no /* comments)
   ```

---

---

## 📦 Simulator vs Real Trading

### Account/Wallet Structure

**Real Binance Account:**
```typescript
interface Account {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: 'SPOT';
  balances: Balance[];
  permissions: string[];
}
```

**Simulator Wallet (extends Account):**
```typescript
interface Wallet extends Account {
  id: string;              // Simulator-specific: unique wallet ID
  name: string;            // Simulator-specific: user-defined name
  initialBalance: number;  // Simulator-specific: starting balance
  currency: WalletCurrency; // Simulator-specific: base currency
  createdAt: number;       // Simulator-specific: creation timestamp
  performance: WalletPerformancePoint[]; // Simulator-specific: historical performance
}
```

### Key Principles

1. **Simulator inherits from real types**: `Wallet extends Account`
2. **Real API fields remain unchanged**: All Binance API fields preserved
3. **Simulator adds metadata**: Only add fields not in real API (id, name, performance)
4. **Backend will map**: Future backend maps `Wallet.id` to real Binance account credentials

### Migration Path to Real Trading

```typescript
// Simulator (current)
const wallet: Wallet = {
  id: 'wallet_123',
  name: 'My Test Wallet',
  makerCommission: 10,
  takerCommission: 10,
  canTrade: true,
  balances: [{ asset: 'USDT', free: '10000.00', locked: '0' }],
  // ... other fields
};

// Real trading (future backend)
const accountConfig = {
  walletId: 'wallet_123',        // Maps to API credentials
  apiKey: process.env.BINANCE_KEY,
  apiSecret: process.env.BINANCE_SECRET,
};

const realAccount = await binance.getAccount(); // Returns Account type
// Backend merges simulator metadata with real account data
```

---

**Last Updated:** November 29, 2025
**Version:** 2.1
**Status:** Ready for OCO migration with Account alignment
