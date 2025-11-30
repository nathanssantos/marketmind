# Binance OCO Pattern Implementation Guide

## 🎯 Overview

This document explains how to implement the Binance OCO (One-Cancels-Other) pattern in MarketMind's trading simulator to match real exchange behavior and facilitate future integration.

---

## 📚 Binance OCO Basics

### What is OCO?

OCO (One-Cancels-Other) is an order list containing two orders where:
- If one order fills, the other is automatically canceled
- Both orders must have the same quantity
- Both orders share the same `orderListId`

### Common OCO Use Cases

1. **Take-Profit + Stop-Loss**: Protect gains and limit losses simultaneously
2. **Buy Limit + Buy Stop**: Enter position either on pullback or breakout
3. **Sell Limit + Sell Stop**: Exit position either at target or on breakdown

---

## 🏗️ Type Structure

### Order Interface

```typescript
interface Order {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  stopPrice?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  
  walletId?: string;
  setupId?: string;
  setupDirection?: 'LONG' | 'SHORT';
}
```

### OrderList Interface

```typescript
interface OrderList {
  orderListId: number;
  contingencyType: 'OCO' | 'OTO' | 'OTOCO';
  listStatusType: 'RESPONSE' | 'EXEC_STARTED' | 'ALL_DONE';
  listOrderStatus: 'EXECUTING' | 'ALL_DONE' | 'REJECT';
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: Array<{
    symbol: string;
    orderId: number;
    clientOrderId: string;
  }>;
}
```

---

## 🔄 Trading Workflow

### 1. Entry Order (No OCO Yet)

```typescript
const entryOrder: Order = {
  symbol: 'BTCUSDT',
  orderId: 1,
  orderListId: -1,
  clientOrderId: 'entry_001',
  type: 'LIMIT',
  side: 'BUY',
  price: '50000.00',
  origQty: '1.0',
  executedQty: '0',
  status: 'NEW',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: true,
  timeInForce: 'GTC',
  cummulativeQuoteQty: '0',
  origQuoteOrderQty: '0',
};
```

### 2. Entry Fills → Create OCO

When entry order fills:

```typescript
const createOCO = (entryOrder: Order, stopLossPrice: string, takeProfitPrice: string) => {
  const orderListId = generateOrderListId();
  
  const orderList: OrderList = {
    orderListId,
    contingencyType: 'OCO',
    listStatusType: 'EXEC_STARTED',
    listOrderStatus: 'EXECUTING',
    listClientOrderId: `oco_${orderListId}`,
    transactionTime: Date.now(),
    symbol: entryOrder.symbol,
    orders: [],
  };
  
  const stopLoss: Order = {
    symbol: entryOrder.symbol,
    orderId: generateOrderId(),
    orderListId,
    clientOrderId: `sl_${orderListId}`,
    type: 'STOP_LOSS_LIMIT',
    side: entryOrder.side === 'BUY' ? 'SELL' : 'BUY',
    stopPrice: stopLossPrice,
    price: calculateLimitPrice(stopLossPrice, entryOrder.side),
    origQty: entryOrder.origQty,
    executedQty: '0',
    status: 'NEW',
    time: Date.now(),
    updateTime: Date.now(),
    isWorking: true,
    timeInForce: 'GTC',
    cummulativeQuoteQty: '0',
    origQuoteOrderQty: '0',
  };
  
  const takeProfit: Order = {
    symbol: entryOrder.symbol,
    orderId: generateOrderId(),
    orderListId,
    clientOrderId: `tp_${orderListId}`,
    type: 'LIMIT_MAKER',
    side: entryOrder.side === 'BUY' ? 'SELL' : 'BUY',
    price: takeProfitPrice,
    origQty: entryOrder.origQty,
    executedQty: '0',
    status: 'NEW',
    time: Date.now(),
    updateTime: Date.now(),
    isWorking: true,
    timeInForce: 'GTC',
    cummulativeQuoteQty: '0',
    origQuoteOrderQty: '0',
  };
  
  orderList.orders = [
    { symbol: stopLoss.symbol, orderId: stopLoss.orderId, clientOrderId: stopLoss.clientOrderId },
    { symbol: takeProfit.symbol, orderId: takeProfit.orderId, clientOrderId: takeProfit.clientOrderId },
  ];
  
  return { orderList, stopLoss, takeProfit };
};
```

### 3. OCO Execution Logic

```typescript
const processOCOOrders = (orders: Order[], orderLists: OrderList[], currentPrice: string) => {
  orderLists.forEach(list => {
    if (list.listOrderStatus !== 'EXECUTING') return;
    
    const ocoOrders = orders.filter(o => o.orderListId === list.orderListId);
    
    ocoOrders.forEach(order => {
      if (order.status !== 'NEW') return;
      
      const priceNum = parsePrice(currentPrice);
      const isFilled = checkOrderFilled(order, priceNum);
      
      if (isFilled) {
        fillOrder(order, currentPrice);
        
        cancelOtherOrders(ocoOrders, order.orderId);
        
        list.listOrderStatus = 'ALL_DONE';
        list.listStatusType = 'ALL_DONE';
      }
    });
  });
};

const checkOrderFilled = (order: Order, currentPrice: number): boolean => {
  const stopPrice = order.stopPrice ? parsePrice(order.stopPrice) : null;
  const limitPrice = parsePrice(order.price);
  
  if (order.type === 'STOP_LOSS_LIMIT' && stopPrice) {
    if (order.side === 'SELL') {
      return currentPrice <= stopPrice;
    }
    return currentPrice >= stopPrice;
  }
  
  if (order.type === 'LIMIT_MAKER') {
    if (order.side === 'SELL') {
      return currentPrice >= limitPrice;
    }
    return currentPrice <= limitPrice;
  }
  
  return false;
};

const cancelOtherOrders = (ocoOrders: Order[], filledOrderId: number) => {
  ocoOrders.forEach(order => {
    if (order.orderId !== filledOrderId && order.status === 'NEW') {
      order.status = 'CANCELED';
      order.updateTime = Date.now();
    }
  });
};
```

---

## 🎯 Store Structure

### State

```typescript
interface TradingState {
  orders: Order[];
  orderLists: OrderList[];
  
  addOrder: (order: Omit<Order, 'orderId' | 'time'>) => void;
  createOCO: (entryOrderId: number, stopLoss: string, takeProfit: string) => void;
  updateOrderPrice: (orderId: number, newPrice: string, newStopPrice?: string) => void;
  cancelOrder: (orderId: number) => void;
  processOrders: (symbol: string, currentPrice: string) => void;
}
```

### Actions

```typescript
const useTradingStore = create<TradingState>((set, get) => ({
  orders: [],
  orderLists: [],
  
  addOrder: (orderData) => {
    const order: Order = {
      ...orderData,
      orderId: generateOrderId(),
      time: Date.now(),
      updateTime: Date.now(),
    };
    
    set(state => ({
      orders: [...state.orders, order],
    }));
  },
  
  createOCO: (entryOrderId, stopLossPrice, takeProfitPrice) => {
    const entryOrder = get().orders.find(o => o.orderId === entryOrderId);
    if (!entryOrder || entryOrder.status !== 'FILLED') return;
    
    const { orderList, stopLoss, takeProfit } = createOCO(
      entryOrder,
      stopLossPrice,
      takeProfitPrice
    );
    
    set(state => ({
      orders: [...state.orders, stopLoss, takeProfit],
      orderLists: [...state.orderLists, orderList],
    }));
  },
  
  processOrders: (symbol, currentPrice) => {
    const state = get();
    const relevantLists = state.orderLists.filter(
      list => list.symbol === symbol && list.listOrderStatus === 'EXECUTING'
    );
    
    processOCOOrders(state.orders, relevantLists, currentPrice);
    
    set({ orders: [...state.orders], orderLists: [...state.orderLists] });
  },
}));
```

---

## 📋 Migration Checklist

### Phase 1: Type System
- [x] Add `OrderList` interface
- [x] Add `ContingencyType`, `ListStatusType`, `ListOrderStatus` types
- [x] Add `orderListId` to Order interface
- [x] Remove `stopLoss` and `takeProfit` from Order interface
- [ ] Update all Order creation to use new format

### Phase 2: Store
- [ ] Add `orderLists` array to state
- [ ] Implement `createOCO` action
- [ ] Implement OCO execution logic in `processOrders`
- [ ] Update order creation to generate OCO when needed
- [ ] Update order cancellation to handle OCO lists

### Phase 3: Components
- [ ] Update chart order creation (entry only, no SL/TP fields)
- [ ] Add OCO creation UI after entry fills
- [ ] Update order display to show linked OCO orders
- [ ] Update order lines to distinguish entry/SL/TP visually
- [ ] Update tooltips to show OCO relationship

### Phase 4: Tests
- [ ] Test OCO creation after entry fill
- [ ] Test SL triggers and TP cancellation
- [ ] Test TP triggers and SL cancellation
- [ ] Test manual cancellation of OCO list
- [ ] Test multiple concurrent OCO lists

---

## 🔗 References

- [Binance OCO API Documentation](https://developers.binance.com/docs/binance-spot-api-docs/rest-api)
- [Binance Order List Endpoints](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#new-order-list---oco-trade)
- [MarketMind Type Migration Guide](/docs/TYPE_MIGRATION_CONTINUATION.md)

---

**Last Updated:** November 29, 2025
**Version:** 1.0
