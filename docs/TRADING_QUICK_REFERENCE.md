# Trading System - Quick Reference

**Version:** 0.32.0
**Last Updated:** November 30, 2024

---

## 🚀 Quick Start

### Toggle Trading Mode

```typescript
import { useTradingStore } from '@renderer/store/tradingStore';

// Get current mode
const isSimulatorActive = useTradingStore(state => state.isSimulatorActive);

// Toggle mode
const toggleSimulator = useTradingStore(state => state.toggleSimulator);
toggleSimulator(); // Switches between simulator and real mode
```

### Check Current Mode

```typescript
if (isSimulatorActive) {
  console.log('Using simulator (local data)');
} else {
  console.log('Using real mode (Binance API)');
}
```

---

## 📦 Available Hooks

### useBackendWallet

**Purpose:** Manage real Binance wallets

```typescript
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';

const {
  wallets,          // Wallet[] - List of Binance wallets
  isLoading,        // boolean - Loading state
  createWallet,     // Function to add new wallet
  deleteWallet,     // Function to remove wallet
  syncBalance,      // Function to sync with Binance
} = useBackendWallet();
```

### useBackendTrading

**Purpose:** Manage real Binance orders and positions

```typescript
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';

const {
  orders,           // Order[] - List of orders
  positions,        // Position[] - List of positions
  createOrder,      // Function to create order
  cancelOrder,      // Function to cancel order
  syncOrders,       // Function to sync with Binance
} = useBackendTrading(walletId, symbol);
```

### useTradingStore (Simulator)

**Purpose:** Manage simulator wallets, orders, and positions

```typescript
import { useTradingStore } from '@renderer/store/tradingStore';

const {
  wallets,          // Wallet[] - Simulator wallets
  orders,           // Order[] - Simulator orders
  addWallet,        // Function to add simulator wallet
  addOrder,         // Function to add simulator order
  closeOrder,       // Function to close simulator order
  getPositions,     // Function to get simulator positions
} = useTradingStore();
```

---

## 🔧 Common Patterns

### Create Order (Hybrid)

```typescript
const handleCreateOrder = async (orderData) => {
  const isSimulator = useTradingStore.getState().isSimulatorActive;

  if (isSimulator) {
    // Local simulator
    useTradingStore.getState().addOrder({
      walletId: activeWallet.id,
      symbol: 'BTCUSDT',
      orderDirection: 'long',
      quantity: 0.001,
      entryPrice: 50000,
      status: 'NEW',
    });
  } else {
    // Real Binance
    await createBackendOrder({
      walletId: activeWallet.id,
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '50000',
    });
  }
};
```

### Get Active Wallet (Hybrid)

```typescript
const getActiveWallet = () => {
  const isSimulator = useTradingStore.getState().isSimulatorActive;

  if (isSimulator) {
    const { wallets, activeWalletId } = useTradingStore.getState();
    return wallets.find(w => w.id === activeWalletId);
  } else {
    const { wallets } = useBackendWallet();
    return wallets[0]; // First real wallet
  }
};
```

### List Orders (Hybrid)

```typescript
const getOrders = () => {
  const isSimulator = useTradingStore.getState().isSimulatorActive;

  if (isSimulator) {
    return useTradingStore.getState().orders;
  } else {
    const { orders } = useBackendTrading(walletId, symbol);
    return orders;
  }
};
```

---

## 📊 Data Structures

### Wallet

```typescript
interface Wallet {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  currency: 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC' | 'ETH';
  createdAt: Date;
  performance: WalletPerformancePoint[];
  // ... Binance-specific fields
}
```

### Order

```typescript
interface Order {
  id?: string;
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS';
  price: string;
  origQty: string;
  executedQty: string;
  status: OrderStatus;
  walletId: string;
  // ... other fields
}
```

### Position

```typescript
interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  orders: string[];
}
```

---

## 🎯 Use Cases

### 1. Create Simulator Wallet

```typescript
const { addWallet } = useTradingStore();

addWallet({
  name: 'Test Wallet',
  initialBalance: 10000,
  currency: 'USDT',
});
```

### 2. Place Market Order (Simulator)

```typescript
const { addOrder } = useTradingStore();

addOrder({
  walletId: activeWallet.id,
  symbol: 'BTCUSDT',
  orderDirection: 'long',
  subType: 'limit',
  status: 'NEW',
  quantity: 0.001,
  entryPrice: 50000,
  currentPrice: 50000,
});
```

### 3. Create Real Wallet (Binance)

```typescript
const { createWallet } = useBackendWallet();

await createWallet({
  name: 'My Binance Account',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
});
```

### 4. Place Real Order (Binance)

```typescript
const { createOrder } = useBackendTrading(walletId, symbol);

await createOrder({
  walletId: walletId,
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.001',
  price: '50000',
});
```

### 5. Cancel Order

```typescript
// Simulator
const { cancelOrder } = useTradingStore();
cancelOrder(orderId);

// Real
const { cancelOrder } = useBackendTrading(walletId, symbol);
await cancelOrder({
  walletId,
  symbol,
  orderId: 123456,
});
```

### 6. Get Positions

```typescript
// Simulator
const { getPositions } = useTradingStore();
const positions = getPositions(walletId);

// Real
const { positions } = useBackendTrading(walletId);
```

---

## 🔍 Debugging

### Check Current Mode

```typescript
console.log('Simulator Active:', useTradingStore.getState().isSimulatorActive);
```

### View Store State

```typescript
console.log('Trading Store:', useTradingStore.getState());
```

### View Backend Data

```typescript
const { wallets, orders, positions } = useBackendTrading(walletId, symbol);
console.log('Backend Wallets:', wallets);
console.log('Backend Orders:', orders);
console.log('Backend Positions:', positions);
```

### Monitor React Query Cache

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
console.log('Query Cache:', queryClient.getQueryCache().getAll());
```

---

## 🚨 Common Issues

### Issue: Orders not showing

**Solution:**
```typescript
// Check if wallet is selected
const activeWalletId = useTradingStore.getState().activeWalletId;
if (!activeWalletId) {
  console.error('No wallet selected');
}

// Check mode
const isSimulator = useTradingStore.getState().isSimulatorActive;
console.log('Mode:', isSimulator ? 'Simulator' : 'Real');
```

### Issue: Backend not loading

**Solution:**
```typescript
// Check authentication
const { isAuthenticated } = useBackendAuth();
if (!isAuthenticated) {
  console.error('User not authenticated');
}

// Check backend connection
const { data } = trpc.health.check.useQuery();
console.log('Backend health:', data);
```

### Issue: Type errors

**Solution:**
```typescript
// Always convert backend data to frontend types
const frontendOrders: Order[] = backendOrders.map(convertToFrontendOrder);
```

---

## 📋 Checklists

### Before Switching to Real Mode

- [ ] User is authenticated
- [ ] Backend is running
- [ ] Wallet has valid API keys
- [ ] Testnet mode enabled (for testing)
- [ ] Risk amount is acceptable

### Before Creating Real Order

- [ ] Wallet is selected
- [ ] Balance is sufficient
- [ ] Symbol is valid
- [ ] Price and quantity are correct
- [ ] Stop loss/take profit set (optional)

### After Order Execution

- [ ] Check order status
- [ ] Verify position was opened
- [ ] Monitor PnL
- [ ] Set alerts if needed

---

## 🔗 Related Files

### Components
- [WalletManager.tsx](../apps/electron/src/renderer/components/Trading/WalletManager.tsx)
- [OrdersList.tsx](../apps/electron/src/renderer/components/Trading/OrdersList.tsx)
- [Portfolio.tsx](../apps/electron/src/renderer/components/Trading/Portfolio.tsx)
- [OrderTicket.tsx](../apps/electron/src/renderer/components/Trading/OrderTicket.tsx)

### Hooks
- [useBackendWallet.ts](../apps/electron/src/renderer/hooks/useBackendWallet.ts)
- [useBackendTrading.ts](../apps/electron/src/renderer/hooks/useBackendTrading.ts)

### Store
- [tradingStore.ts](../apps/electron/src/renderer/store/tradingStore.ts)

### Backend
- [wallet.ts](../apps/backend/src/routers/wallet.ts)
- [trading.ts](../apps/backend/src/routers/trading.ts)

---

## 📚 Further Reading

- [TRADING_MIGRATION.md](./TRADING_MIGRATION.md) - Complete migration guide
- [TRADING_MIGRATION_SUMMARY.md](./TRADING_MIGRATION_SUMMARY.md) - Executive summary
- [BACKEND_INTEGRATION_STATUS.md](./BACKEND_INTEGRATION_STATUS.md) - Overall status
- [BACKEND_QUICK_REFERENCE.md](./BACKEND_QUICK_REFERENCE.md) - Backend API reference

---

**Quick Reference Version:** 1.0
**For:** MarketMind v0.32.0+
**Last Updated:** November 30, 2024
