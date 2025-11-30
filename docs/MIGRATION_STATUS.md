# Type System Migration - Current Status

**Last Updated:** 2025-11-29 18:30
**Branch:** develop
**Status:** 🔄 In Progress (Phase 3/4) - 130 errors fixed (269 → 139)

---

## 🎯 Overview

Migrating from legacy Order structure to Binance-aligned types while maintaining backward compatibility during transition.

**Progress:** ✅ 27.5% error reduction (74/269 errors fixed)

---

## ✅ Completed

### Phase 1: Type System Updates

1. **Added temporary compatibility fields** to:
   - `Order` interface - added `id`, `createdAt`, `filledAt`, `closedAt`, `type`, `quantity`, `entryPrice`, `currentPrice`, `stopLoss`, `takeProfit`, etc.
   - `Wallet` interface - added `balance`, made `createdAt` accept both number and Date
   - `WalletPerformancePoint` - made `timestamp` accept both number and Date
   - `Position` interface - added `orders` array, made fields use numbers temporarily
   - Added `ExpirationType` = 'gtc' | 'day' | 'custom'

2. **Created Helper Functions** (`src/shared/utils/orderUtils.ts`):
   - ✅ `getOrderId()` - Returns order ID (supports both old and new fields)
   - ✅ `getOrderSide()` - Returns 'BUY'|'SELL' (converts from old 'long'|'short')
   - ✅ `getOrderPrice()` - Returns price as number (supports entryPrice or price)
   - ✅ `getOrderQuantity()` - Returns quantity as number (supports quantity or origQty)
   - ✅ `getOrderCreatedAt()` - Returns Date (supports createdAt or time)
   - ✅ `getOrderType()` - Returns 'long'|'short' for compatibility
   - ✅ `isOrderLong()`, `isOrderShort()` - Direction checks
   - ✅ `isOrderPending()`, `isOrderActive()`, `isOrderClosed()` - Status checks

3. **Updated tradingStore.ts**:
   - ✅ Created `OrderCreateInput` type for flexible order creation
   - ✅ Updated `addOrder` signature to accept partial Order data
   - ✅ Imported `OrderSide` and `OrderStatus` types

4. **ChartCanvas.tsx** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ `handleLongEntry` - uses `side: 'BUY'` and `status: 'NEW'`
   - ✅ `handleShortEntry` - uses `side: 'SELL'` and `status: 'NEW'`
   - ✅ Setup order creation - uses proper `side` and `status` with string fees
   - ✅ Removed all `type: 'long'|'short'` assignments
   - ✅ Fixed drag preview logic with `isOrderLong()` and `isOrderPending()`
   - ✅ Fixed close order dialog with `getOrderPrice()` and `getOrderType()`

5. **ChartTooltip.tsx** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ Replaced all `order.type === 'long'` with `isOrderLong(order)`
   - ✅ Replaced `order.status === 'active'` with `isOrderActive(order)`
   - ✅ Replaced `order.status === 'pending'` with `isOrderPending(order)`
   - ✅ Fixed `order.entryPrice` with `getOrderPrice(order)`
   - ✅ Fixed `order.quantity` with `getOrderQuantity(order)`
   - ✅ Fixed `order.createdAt` with `getOrderCreatedAt(order)`
   - ✅ Fixed string fee fields with `parseFloat()` for display
   - ✅ Fixed stopLoss/takeProfit optional checks

6. **useOrderDragHandler.ts** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ Fixed `order.id` with `getOrderId(order)`
   - ✅ Fixed status comparisons with `isOrderPending()`, `isOrderActive()`
   - ✅ Fixed type comparisons with `isOrderLong()`, `isOrderShort()`
   - ✅ Fixed `order.entryPrice` with `getOrderPrice(order)`
   - ✅ Fixed undefined check for order in SL/TP mousedown

7. **App.tsx** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ Fixed status comparisons with `isOrderPending()`, `isOrderActive()`
   - ✅ Fixed type comparisons with `isOrderLong()`
   - ✅ Fixed all `order.id` access with `getOrderId(order)`
   - ✅ Fixed stop loss and take profit logging

8. **useOrderLinesRenderer.ts** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ Fixed pending/active filtering with helper functions
   - ✅ Fixed all type comparisons (`isOrderLong`)
   - ✅ Fixed all price access (`getOrderPrice`)
   - ✅ Fixed all quantity access (`getOrderQuantity`)
   - ✅ Fixed all order ID access (`getOrderId`)
   - ✅ Fixed PnL calculations
   - ✅ Fixed status comparisons in activeOrders filter

9. **OrdersList.tsx** - ✅ COMPLETED:
   - ✅ Added orderUtils imports
   - ✅ Fixed status comparisons with `isOrderActive()`, `isOrderPending()`
   - ✅ Fixed type comparisons with `isOrderLong()`
   - ✅ Fixed all `order.id` access with `getOrderId()`
   - ✅ Updated `getStatusColor()` to use Binance OrderStatus values
   - ✅ Fixed PnL string type issues with `parseFloat()`
   - ✅ Replaced `order.filledAt` with `order.updateTime`

10. **TradingSimulatorTab.tsx** - ✅ COMPLETED:
    - ✅ Added helper imports
    - ✅ Fixed status comparisons in order statistics

11. **OrderTicket.tsx** - ✅ COMPLETED:
    - ✅ Created local `OrderDirection` type ('long'|'short')
    - ✅ Fixed status to use 'NEW' instead of 'pending'
    - ✅ Removed incorrect OrderType import

12. **useAITrading.ts** - ✅ COMPLETED:
    - ✅ Fixed status to use 'FILLED' instead of 'active'

13. **useOrderNotifications.ts** - ✅ COMPLETED:
    - ✅ Added helper imports
    - ✅ Fixed order.id access with `getOrderId()`
    - ✅ Fixed type comparisons with `isOrderLong()`
    - ✅ Updated status change logic to use Binance status values
    - ✅ Fixed field access with `getOrderPrice()`, `getOrderQuantity()`

14. **usePriceUpdates.ts** - ✅ COMPLETED:
    - ✅ Added helper imports
    - ✅ Fixed status and type comparisons
    - ✅ Fixed order.id access with `getOrderId()`

15. **useSimulatorSync.ts** - ✅ COMPLETED:
    - ✅ Added helper imports
    - ✅ Fixed status comparisons
    - ✅ Fixed type comparisons with `isOrderLong()`
    - ✅ Fixed order.id access with `getOrderId()`

16. **useVolumeRenderer.ts** - ✅ COMPLETED:
    - ✅ Removed unused `candle` parameter

---

## 🔄 In Progress

### Remaining Files (139 TS errors)

1. **useOrderLinesRenderer.ts** (~7 errors):
   - Metadata type issues (isPosition, positionData)
   - String | undefined type assignments
   - Type conversion error on line 394

2. **ChartTooltip.tsx** (~2 errors):
   - Metadata property issues

3. **SymbolSelector.tsx** (~1 error):
   - displayName property type issue

4. **OrdersList.tsx** (~1 error):
   - Date formatting overload issue

5. **OrderTicket.tsx** (~1 error):
   - OrderCreateInput type compatibility

6. **useAITrading.ts** (~1 error):
   - OrderCreateInput type compatibility

7. **Various other files** (~126 errors):
   - Minor type mismatches
   - Optional field handling
   - String vs number conversions
   - Metadata type issues (isPosition, positionData)
   - Some status comparisons in hitbox detection
   - OrderId undefined checks

3. **TradingSimulatorTab.tsx** (~5 errors):
   - Status comparisons

4. **ChartTooltip.tsx** (2 errors):
   - metadata.isPosition and metadata.positionData

5. **Other files** (~98 errors):
   - Various minor fixes needed

---

## ⏳ Not Started

### Components

1. **ChartTooltip.tsx** - Many errors with:
   - Type and status comparisons
   - Optional field access (`entryPrice`, `quantity`)
   - String vs number operations on prices
   - Missing properties (`isPosition`, `positionData`)

2. **useOrderDragHandler.ts** - Issues with:
   - Status and type comparisons
   - Optional field access
   - `order.id` being optional

3. **useOrderLinesRenderer.ts** - Issues with:
   - Status and type comparisons
   - Optional field access for `entryPrice`, `quantity`
   - `order.id` being optional

4. **App.tsx** - Issues with:
   - Type and status comparisons
   - Optional `order.id`

### Store

- **tradingStore.ts** - No changes yet, still using all old fields

### Tests

- All test files need updating to use new structure

---

## 📋 Migration Strategy

### Current Approach: Gradual Migration

1. ✅ **Step 1**: Add temporary compatibility fields (DONE)
2. 🔄 **Step 2**: Update components to use new fields where possible (IN PROGRESS)
3. ⏳ **Step 3**: Update store to manage both old and new fields
4. ⏳ **Step 4**: Remove all old field usages
5. ⏳ **Step 5**: Remove temporary compatibility fields

### Field Mapping Reference

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `order.id` | `order.clientOrderId` | String ID |
| `order.type: 'long'\|'short'` | `order.side: 'BUY'\|'SELL'` | Direction |
| `order.status: 'pending'` | `order.status: 'NEW'` | Pending state |
| `order.status: 'active'` | `order.status: 'FILLED'` | Active state |
| `order.entryPrice` | `parsePrice(order.price)` | Number to string |
| `order.quantity` | `parseQty(order.origQty)` | Number to string |
| `order.createdAt` | `new Date(order.time)` | Timestamp conversion |
| `order.stopLoss` | Separate Order with `type: 'STOP_LOSS_LIMIT'` | OCO pattern |
| `order.takeProfit` | Separate Order with `type: 'LIMIT_MAKER'` | OCO pattern |

---

## 🚨 Critical Issues

1. **269 TypeScript errors** across components
2. **Type comparisons** using old `'long'|'short'` values
3. **Status comparisons** using old `'pending'|'active'` values
4. **Optional field access** not properly handled
5. **String vs number** operations on prices/quantities

---

## 📝 Next Steps

1. Create helper functions for field access:
   ```typescript
   const getOrderSide = (order: Order): 'BUY' | 'SELL' => 
     order.side ?? (order.type === 'long' ? 'BUY' : 'SELL');
   
   const getOrderStatus = (order: Order): OrderStatus =>
     order.status;
   
   const getOrderPrice = (order: Order): number =>
     order.entryPrice ?? parsePrice(order.price);
   
   const getOrderQuantity = (order: Order): number =>
     order.quantity ?? parseQty(order.origQty);
   ```

2. Update all components to use helper functions

3. Update store to create orders with new fields

4. Remove old field usages

5. Remove temporary compatibility fields

---

## 📚 Reference Documents

- `TYPE_MIGRATION_CONTINUATION.md` - Detailed migration guide
- `BINANCE_OCO_PATTERN.md` - OCO order list implementation
- `BINANCE_TYPE_ALIGNMENT.md` - Type alignment with Binance API
- `copilot-instructions.md` - Project rules and guidelines

---

**Remember:** All `copilot-instructions.md` rules apply:
- ✅ NO code comments
- ✅ NO hardcoded strings (use i18n)
- ✅ NO magic numbers
- ✅ ALL tests must pass before committing
- ✅ Create feature branch, never commit to main/develop
