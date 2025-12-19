# Binance Integration Analysis

## Overview

This document provides a comprehensive analysis of the Binance API integration in MarketMind, identifying issues, risks, and recommendations.

## Executive Summary

The current integration has **critical issues** that could lead to:
- Double exits (both SL and TP filling)
- Orphaned orders on Binance
- Incorrect PnL calculations
- Risk exposure beyond intended levels

## Current Architecture

### Files Analyzed

| File | Purpose |
|------|---------|
| `services/binance-client.ts` | Binance client factory |
| `services/oco-orders.ts` | OCO order service (non-functional) |
| `services/auto-trading.ts` | Order creation logic |
| `services/auto-trading-scheduler.ts` | Setup execution orchestration |
| `routers/trading.ts` | Trading API endpoints |

### SDK Used

- **Package**: `binance` v3.1.5 (MainClient)
- **Available Methods**: `submitNewOrder`, `submitNewOCO`, `cancelOrder`, `cancelOCO`

---

## Critical Issues

### 1. OCO Orders Not Implemented

**Location**: `services/oco-orders.ts:60-67`

**Problem**: The `placeOCO` method doesn't use OCO at all - it just places a single LIMIT order:

```typescript
// Current implementation (WRONG)
const result = await client.submitNewOrder({
  symbol: params.symbol,
  side: params.side,
  type: 'LIMIT',  // Just a regular LIMIT order!
  quantity: params.quantity,
  price: params.price,
  timeInForce: 'GTC',
});
```

**SDK Has Proper Method**:
```typescript
// Available in SDK but NOT used
client.submitNewOCO({
  symbol: 'BTCUSDT',
  side: 'SELL',
  quantity: 0.1,
  price: 45000,           // Take profit limit price
  stopPrice: 42000,       // Stop loss trigger price
  stopLimitPrice: 41900,  // Stop loss limit price
  stopLimitTimeInForce: 'GTC',
});
```

**Impact**: OCO feature is effectively disabled.

---

### 2. SL and TP Orders Are Independent

**Location**: `services/auto-trading-scheduler.ts:1096-1128`

**Problem**: Stop loss and take profit orders are placed as separate, unlinked orders:

```typescript
// Entry fills, then...
if (orderFilled && setup.stopLoss) {
  stopLossOrderId = await autoTradingService.createStopLossOrder(...);
}

if (orderFilled && setup.takeProfit) {
  takeProfitOrderId = await autoTradingService.createTakeProfitOrder(...);
}
```

**createStopLossOrder** places a `STOP_LOSS_LIMIT` order.
**createTakeProfitOrder** places a regular `LIMIT` order.

**Risk**: In volatile markets, both orders could trigger:
1. Price spikes to TP → LIMIT order fills (profit taken)
2. Price crashes to SL → STOP_LOSS_LIMIT triggers (unexpected second exit)

This could result in:
- Selling more than owned (short position created unintentionally)
- Double fees
- Incorrect PnL tracking

---

### 3. Missing OCO Exit Implementation

**Recommendation**: After entry fills, use OCO for exit orders:

```typescript
// Proper implementation using submitNewOCO
const ocoResult = await client.submitNewOCO({
  symbol: setup.symbol,
  side: setup.direction === 'LONG' ? 'SELL' : 'BUY',
  quantity: actualQuantity,
  price: setup.takeProfit,              // Limit price for TP
  stopPrice: setup.stopLoss,            // Stop trigger
  stopLimitPrice: setup.stopLoss * (setup.direction === 'LONG' ? 0.99 : 1.01),
  stopLimitTimeInForce: 'GTC',
});

// Store orderListId for cancellation
const orderListId = ocoResult.orderListId;
```

---

### 4. Order Cancellation Gaps

**Location**: `routers/trading.ts:879-908`

**Problem**: The `cancelTradeExecution` procedure only updates database status:

```typescript
await ctx.db
  .update(tradeExecutions)
  .set({
    status: 'cancelled',
    updatedAt: new Date(),
  })
  .where(eq(tradeExecutions.id, input.id));
```

**Missing**: No Binance API calls to cancel actual orders.

**Contrast with `closeTradeExecution`** (lines 710-732) which does cancel orders:

```typescript
for (const orderId of orderIdsToCancel) {
  try {
    await client.cancelOrder({ symbol: execution.symbol, orderId });
  } catch (error) {
    logger.warn({...}, 'Failed to cancel Binance order');
  }
}
```

---

### 5. Order Type Mapping Issues

**Location**: `services/auto-trading.ts:393-436`

**createStopLossOrder**:
```typescript
type: 'STOP_LOSS_LIMIT',
stopPrice: stopLoss,
price: stopLoss * (orderSide === 'SELL' ? 0.99 : 1.01),  // Slippage protection
```

**createTakeProfitOrder**:
```typescript
type: 'LIMIT',
price: takeProfit,
```

**Issue**: Take profit should ideally be `TAKE_PROFIT_LIMIT` for symmetry and to prevent fills at worse prices during gaps.

---

### 6. Fee Handling

**Location**: `routers/trading.ts:17`

```typescript
const BINANCE_TAKER_FEE = 0.001;  // 0.1%
```

**Issue**:
- BNB discount (25% off) not considered
- Maker vs Taker fee not distinguished
- VIP level discounts not accounted for

**Actual Binance Fees**:
| Level | Maker | Taker |
|-------|-------|-------|
| Regular | 0.10% | 0.10% |
| VIP 1 | 0.09% | 0.10% |
| With BNB | 0.075% | 0.075% |

---

## Recommended Fixes

### Priority 1: Implement True OCO for Exits

Replace separate SL/TP order placement with OCO:

```typescript
async createExitOCO(
  wallet: Wallet,
  symbol: string,
  quantity: number,
  stopLoss: number,
  takeProfit: number,
  side: 'LONG' | 'SHORT'
): Promise<{ orderListId: number; stopLossOrderId: number; takeProfitOrderId: number }> {
  const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
  const slLimitPrice = stopLoss * (orderSide === 'SELL' ? 0.995 : 1.005);

  const client = createBinanceClient(wallet);

  const result = await client.submitNewOCO({
    symbol,
    side: orderSide,
    quantity,
    price: takeProfit,
    stopPrice: stopLoss,
    stopLimitPrice: slLimitPrice,
    stopLimitTimeInForce: 'GTC',
  });

  return {
    orderListId: result.orderListId,
    stopLossOrderId: result.orders[0].orderId,
    takeProfitOrderId: result.orders[1].orderId,
  };
}
```

### Priority 2: Fix cancelTradeExecution

Add Binance order cancellation:

```typescript
cancelTradeExecution: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const [execution] = await ctx.db.select()...;
    const [wallet] = await ctx.db.select()...;

    if (!isPaperWallet(wallet) && env.ENABLE_LIVE_TRADING) {
      const client = createBinanceClient(wallet);

      // Cancel all associated orders
      const orderIds = [
        execution.entryOrderId,
        execution.stopLossOrderId,
        execution.takeProfitOrderId,
      ].filter(Boolean);

      for (const orderId of orderIds) {
        try {
          await client.cancelOrder({ symbol: execution.symbol, orderId });
        } catch (e) {
          // Order may already be filled/cancelled
        }
      }
    }

    await ctx.db.update(tradeExecutions)...;
  }),
```

### Priority 3: Store OCO orderListId

Add `orderListId` column to `tradeExecutions` table for proper OCO cancellation:

```typescript
// In schema
orderListId: integer('order_list_id'),

// Cancellation using OCO
await client.cancelOCO({
  symbol: execution.symbol,
  orderListId: execution.orderListId,
});
```

### Priority 4: Improve Fee Calculation

```typescript
interface FeeConfig {
  makerFee: number;
  takerFee: number;
  bnbDiscount: boolean;
}

const calculateFee = (
  value: number,
  orderType: 'MARKET' | 'LIMIT',
  config: FeeConfig
): number => {
  const baseFee = orderType === 'MARKET' ? config.takerFee : config.makerFee;
  const discount = config.bnbDiscount ? 0.75 : 1;
  return value * baseFee * discount;
};
```

---

## API Endpoint Reference

### Current Binance Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/order` | POST | submitNewOrder |
| `/api/v3/order` | DELETE | cancelOrder |
| `/api/v3/ticker/price` | GET | getSymbolPriceTicker |
| `/api/v3/allOrders` | GET | getAllOrders |

### Missing Endpoints (Should Use)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/orderList/oco` | POST | submitNewOCO |
| `/api/v3/orderList` | DELETE | cancelOCO |
| `/api/v3/orderList/otoco` | POST | submitNewOrderListOTOCO |

**Note**: The old `/api/v3/order/oco` endpoint is deprecated. Use `/api/v3/orderList/oco` instead.

---

## Database Schema Recommendations

Add columns to `trade_executions`:

```sql
ALTER TABLE trade_executions ADD COLUMN order_list_id INTEGER;
ALTER TABLE trade_executions ADD COLUMN entry_fill_price DECIMAL(20,8);
ALTER TABLE trade_executions ADD COLUMN entry_filled_qty DECIMAL(20,8);
ALTER TABLE trade_executions ADD COLUMN commission DECIMAL(20,8);
ALTER TABLE trade_executions ADD COLUMN commission_asset VARCHAR(10);
```

---

## Testing Recommendations

1. **Use Binance Testnet**: Set `BINANCE_TESTNET_ENABLED=true`
2. **Test OCO Cancellation**: Verify both orders cancel when one fills
3. **Test Double Exit Scenario**: Simulate rapid price movement through both SL and TP
4. **Verify Order State Sync**: Ensure DB matches Binance order states

---

## Summary

| Issue | Severity | Status |
|-------|----------|--------|
| OCO not implemented | 🔴 Critical | Needs fix |
| SL/TP not linked | 🔴 Critical | Needs fix |
| cancelTradeExecution incomplete | 🟡 High | Needs fix |
| Fee calculation basic | 🟢 Low | Enhancement |
| Order sync gaps | 🟡 High | Needs investigation |

---

## Next Steps

1. Implement `submitNewOCO` for exit orders
2. Add `orderListId` to database schema
3. Fix `cancelTradeExecution` to cancel Binance orders
4. Add order state synchronization service
5. Implement proper fill price tracking
6. Add commission tracking

---

*Analysis Date: 2025-12-19*
*Binance SDK Version: 3.1.5*
*MarketMind Version: 0.31.0+*
