# Binance API Data Model Alignment

## Executive Summary
This document maps MarketMind's current data structures to Binance API standards to facilitate future backend integration and ensure end-to-end type safety.

## 1. Kline/Candlestick Data

### Binance API Response Format
```typescript
[
  1499040000000,      // [0] Kline open time (openTime)
  "0.01634790",       // [1] Open price (open)
  "0.80000000",       // [2] High price (high)
  "0.01575800",       // [3] Low price (low)
  "0.01577100",       // [4] Close price (close)
  "148976.11427815",  // [5] Volume (volume)
  1499644799999,      // [6] Kline close time (closeTime)
  "2434.19055334",    // [7] Quote asset volume (quoteVolume)
  308,                // [8] Number of trades (trades)
  "1756.87402397",    // [9] Taker buy base asset volume (takerBuyBaseVolume)
  "28.46694368",      // [10] Taker buy quote asset volume (takerBuyQuoteVolume)
  "0"                 // [11] Unused field, ignore
]
```

### Current MarketMind Structure
```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Aligned Structure (Binance-Compatible)
```typescript
interface Kline {
  openTime: number;           // Binance: open time
  open: string;               // Binance: open price (as string)
  high: string;               // Binance: high price
  low: string;                // Binance: low price
  close: string;              // Binance: close price
  volume: string;             // Binance: volume
  closeTime: number;          // Binance: close time
  quoteVolume: string;        // Binance: quote asset volume
  trades: number;             // Binance: number of trades
  takerBuyBaseVolume: string; // Binance: taker buy base volume
  takerBuyQuoteVolume: string;// Binance: taker buy quote volume
}

// Keep internal representation for performance
interface CandleInternal {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  trades?: number;
}
```

## 2. Order Data

### Binance Order Response
```typescript
{
  "symbol": "BTCUSDT",
  "orderId": 28,
  "orderListId": -1,
  "clientOrderId": "6gCrw2kRUAF9CvJDGP16IP",
  "transactTime": 1507725176595,
  "price": "0.00000000",
  "origQty": "10.00000000",
  "executedQty": "10.00000000",
  "cummulativeQuoteQty": "10.00000000",
  "status": "FILLED",
  "timeInForce": "GTC",
  "type": "MARKET",
  "side": "SELL"
}
```

### Current MarketMind Structure
```typescript
interface Order {
  id: string;
  walletId: string;
  symbol: string;
  type: 'long' | 'short';
  subType: 'limit' | 'stop';
  status: 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'closed';
  quantity: number;
  entryPrice: number;
  // ... more fields
}
```

### Aligned Structure
```typescript
// Binance order status
type OrderStatus = 
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRED_IN_MATCH';

// Binance order types
type OrderType = 
  | 'LIMIT'
  | 'MARKET'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT'
  | 'LIMIT_MAKER';

// Binance order side
type OrderSide = 'BUY' | 'SELL';

// Binance time in force
type TimeInForce = 'GTC' | 'IOC' | 'FOK';

interface BinanceOrder {
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
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
}

// Internal representation with simulator-specific fields
interface OrderInternal extends Omit<BinanceOrder, 'orderId' | 'orderListId'> {
  id: string;                    // Maps to clientOrderId
  walletId: string;              // Simulator-specific
  orderId?: number;              // Optional Binance orderId
  setupId?: string;              // Simulator-specific
  setupType?: string;            // Simulator-specific
  setupDirection?: 'LONG' | 'SHORT'; // Simulator-specific
  setupConfidence?: number;      // Simulator-specific
  entryFee?: number;             // Simulator-specific
  exitFee?: number;              // Simulator-specific
  totalFees?: number;            // Simulator-specific
  netPnl?: number;               // Simulator-specific
  netPnlPercent?: number;        // Simulator-specific
}
```

## 3. Account/Wallet Data

### Binance Account Response
```typescript
{
  "makerCommission": 15,
  "takerCommission": 15,
  "buyerCommission": 0,
  "sellerCommission": 0,
  "canTrade": true,
  "canWithdraw": true,
  "canDeposit": true,
  "updateTime": 123456789,
  "accountType": "SPOT",
  "balances": [
    {
      "asset": "BTC",
      "free": "4723846.89208129",
      "locked": "0.00000000"
    },
    {
      "asset": "LTC",
      "free": "4763368.68006011",
      "locked": "0.00000000"
    }
  ],
  "permissions": ["SPOT"]
}
```

### Aligned Structure
```typescript
interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: BinanceBalance[];
  permissions: string[];
}

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

// Internal wallet for simulator
interface WalletInternal {
  id: string;
  name: string;
  balances: {
    [asset: string]: {
      free: number;
      locked: number;
      total: number;
    };
  };
  initialBalance: number;
  currency: 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC';
  createdAt: number;
  performance: WalletPerformancePoint[];
}
```

## 4. Symbol/Exchange Info

### Binance Exchange Info
```typescript
{
  "symbol": "LTCBTC",
  "status": "TRADING",
  "baseAsset": "LTC",
  "baseAssetPrecision": 8,
  "quoteAsset": "BTC",
  "quotePrecision": 8,
  "quoteAssetPrecision": 8,
  "orderTypes": ["LIMIT", "LIMIT_MAKER", "MARKET", "STOP_LOSS_LIMIT", "TAKE_PROFIT_LIMIT"],
  "icebergAllowed": true,
  "ocoAllowed": true,
  "isSpotTradingAllowed": true,
  "isMarginTradingAllowed": true,
  "filters": [...]
}
```

### Aligned Structure
```typescript
interface BinanceSymbol {
  symbol: string;
  status: 'TRADING' | 'HALT' | 'BREAK';
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: OrderType[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: SymbolFilter[];
}

interface SymbolFilter {
  filterType: string;
  [key: string]: string | number | boolean;
}
```

## 5. Implementation Strategy

### Phase 1: Create Binance-Compatible Types
- Add new types in `/src/shared/types/binance.ts`
- Keep existing internal types for backwards compatibility
- Create converter functions between Binance and internal formats

### Phase 2: Update Services
- Create BinanceAdapter service for converting between formats
- Update MarketDataService to use Binance types for API calls
- Add transformation layer for internal use

### Phase 3: Migrate Gradually
- Update components to use new types where beneficial
- Maintain dual support during transition
- Remove old types after full migration

### Phase 4: Backend Alignment
- Ensure backend uses same Binance-compatible types
- Implement end-to-end type safety
- Share types package between frontend and backend

## 6. Key Differences

| Field | Binance Format | Our Current Format | Notes |
|-------|---------------|-------------------|-------|
| Prices | string | number | Binance uses strings for precision |
| Timestamps | milliseconds | milliseconds | ✅ Already aligned |
| Order Side | 'BUY'/'SELL' | 'long'/'short' | Need mapping |
| Order Status | Uppercase enums | lowercase | Need standardization |
| Asset Symbols | Uppercase (BTCUSDT) | Mixed case | Need normalization |

## 7. Benefits

1. **Backend Integration**: Direct mapping to Binance API
2. **Type Safety**: End-to-end TypeScript types
3. **Consistency**: Standardized data model
4. **Future-Proof**: Ready for live trading
5. **Performance**: Optimized data structures
6. **Maintainability**: Single source of truth

## 8. Migration Checklist

- [ ] Create `/src/shared/types/binance.ts` with all Binance types
- [ ] Create converter utilities in `/src/shared/utils/binanceConverters.ts`
- [ ] Update MarketDataService to use Binance types
- [ ] Create type aliases for backwards compatibility
- [ ] Update tests to use new types
- [ ] Document type conversion points
- [ ] Update API integration code
- [ ] Validate with real Binance API data
