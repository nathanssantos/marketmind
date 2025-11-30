# Component Migration Guide - Backend Integration

This guide helps migrate existing components from localStorage to backend API.

---

## 🎯 Migration Strategy

### Phase 1: TradingSidebar (Priority: High)
### Phase 2: WalletManager (Priority: High)
### Phase 3: OrderTicket (Priority: Medium)
### Phase 4: Settings Components (Priority: Low)

---

## 📋 Pre-Migration Checklist

Before migrating a component:

- [ ] Backend server is running (`pnpm --filter @marketmind/backend dev`)
- [ ] Database migrations are applied
- [ ] User is authenticated (or auth flow is implemented)
- [ ] Relevant hooks are imported and ready
- [ ] Error boundaries are in place
- [ ] Loading states are implemented

---

## 🔄 Migration Pattern

### 1. TradingSidebar Component

**Current State:** Uses localStorage for wallets and orders
**Target State:** Uses `useBackendWallet` and `useBackendTrading` hooks

#### Before (localStorage)

```typescript
const TradingSidebar = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  useEffect(() => {
    // Load from localStorage
    const storedWallets = localStorage.getItem('wallets');
    if (storedWallets) setWallets(JSON.parse(storedWallets));
    
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) setOrders(JSON.parse(storedOrders));
  }, []);
  
  const handleCreateWallet = (data: WalletData) => {
    const newWallet = { id: Date.now(), ...data };
    const updated = [...wallets, newWallet];
    setWallets(updated);
    localStorage.setItem('wallets', JSON.stringify(updated));
  };
  
  // ... rest of component
};
```

#### After (Backend API)

```typescript
import { useBackendWallet } from '@/hooks/useBackendWallet';
import { useBackendTrading } from '@/hooks/useBackendTrading';
import { useBackendAuth } from '@/hooks/useBackendAuth';

const TradingSidebar = () => {
  const { isAuthenticated } = useBackendAuth();
  const { 
    wallets, 
    createWallet, 
    isLoading: isLoadingWallets,
    createError 
  } = useBackendWallet();
  
  const { 
    orders, 
    isLoadingOrders 
  } = useBackendTrading();
  
  // Handle authentication requirement
  if (!isAuthenticated) {
    return <LoginPrompt />;
  }
  
  const handleCreateWallet = async (data: WalletData) => {
    try {
      await createWallet({
        name: data.name,
        exchange: data.exchange,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
      });
      // Wallets list auto-refreshes via React Query
      toast.success('Wallet created successfully');
    } catch (error) {
      toast.error(createError?.message || 'Failed to create wallet');
    }
  };
  
  // Loading state
  if (isLoadingWallets || isLoadingOrders) {
    return <LoadingSpinner />;
  }
  
  // ... rest of component
};
```

#### Key Changes

1. **Replace useState with hooks**: `useBackendWallet`, `useBackendTrading`
2. **Remove localStorage calls**: Data comes from backend
3. **Add authentication check**: Require user to be logged in
4. **Handle async operations**: All mutations return promises
5. **Add error handling**: Use error states from hooks
6. **Add loading states**: Show spinners during API calls
7. **Auto-refresh**: React Query invalidates cache automatically

---

### 2. WalletManager Component

**Current State:** CRUD operations with localStorage
**Target State:** Uses `useBackendWallet` with Binance integration

#### Before

```typescript
const WalletManager = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  
  const handleUpdateWallet = (id: number, updates: Partial<Wallet>) => {
    const updated = wallets.map(w => 
      w.id === id ? { ...w, ...updates } : w
    );
    setWallets(updated);
    localStorage.setItem('wallets', JSON.stringify(updated));
  };
  
  const handleDeleteWallet = (id: number) => {
    const updated = wallets.filter(w => w.id !== id);
    setWallets(updated);
    localStorage.setItem('wallets', JSON.stringify(updated));
  };
};
```

#### After

```typescript
import { useBackendWallet } from '@/hooks/useBackendWallet';

const WalletManager = () => {
  const { 
    wallets, 
    updateWallet, 
    deleteWallet,
    syncBalance,
    testConnection,
    isUpdating,
    isDeleting,
    isSyncing,
    updateError,
    deleteError 
  } = useBackendWallet();
  
  const handleUpdateWallet = async (id: number, updates: Partial<Wallet>) => {
    try {
      await updateWallet(id, updates);
      toast.success('Wallet updated');
    } catch (error) {
      toast.error(updateError?.message || 'Update failed');
    }
  };
  
  const handleDeleteWallet = async (id: number) => {
    if (!confirm('Delete this wallet?')) return;
    
    try {
      await deleteWallet(id);
      toast.success('Wallet deleted');
    } catch (error) {
      toast.error(deleteError?.message || 'Delete failed');
    }
  };
  
  const handleSyncBalance = async (id: number) => {
    try {
      const result = await syncBalance(id);
      toast.success(`Balance synced: ${result.balance} USDT`);
    } catch (error) {
      toast.error('Sync failed - check API keys');
    }
  };
  
  const handleTestConnection = async (apiKey: string, apiSecret: string) => {
    try {
      const result = await testConnection(apiKey, apiSecret);
      if (result.success) {
        toast.success('Connection successful!');
      }
    } catch (error) {
      toast.error('Connection failed');
    }
  };
};
```

#### Key Changes

1. **New features**: `syncBalance`, `testConnection` (Binance integration)
2. **Better error handling**: Specific error messages from backend
3. **Loading states**: Per-operation loading indicators
4. **Confirmation dialogs**: For destructive operations
5. **Toast notifications**: User feedback for all operations

---

### 3. OrderTicket Component

**Current State:** Manual order creation with localStorage
**Target State:** Uses `useBackendTrading` with Binance execution

#### Before

```typescript
const OrderTicket = () => {
  const handleCreateOrder = (data: OrderData) => {
    const order = {
      id: Date.now(),
      ...data,
      status: 'pending',
      createdAt: new Date(),
    };
    
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    localStorage.setItem('orders', JSON.stringify([...orders, order]));
  };
};
```

#### After

```typescript
import { useBackendTrading } from '@/hooks/useBackendTrading';
import { useBackendWallet } from '@/hooks/useBackendWallet';

const OrderTicket = () => {
  const { wallets } = useBackendWallet();
  const { createOrder, isCreatingOrder, createOrderError } = useBackendTrading();
  
  const [selectedWallet, setSelectedWallet] = useState<number | null>(null);
  
  const handleCreateOrder = async (data: OrderData) => {
    if (!selectedWallet) {
      toast.error('Please select a wallet');
      return;
    }
    
    try {
      const result = await createOrder({
        walletId: selectedWallet,
        symbol: data.symbol,
        side: data.side, // 'BUY' | 'SELL'
        type: data.type, // 'MARKET' | 'LIMIT'
        quantity: data.quantity,
        price: data.price, // optional for MARKET orders
        stopPrice: data.stopPrice, // optional
      });
      
      toast.success(`Order placed: ${result.orderId}`);
    } catch (error) {
      toast.error(createOrderError?.message || 'Order failed');
    }
  };
  
  return (
    <Box>
      <Select 
        value={selectedWallet || ''} 
        onChange={(e) => setSelectedWallet(Number(e.target.value))}
      >
        <option value="">Select Wallet</option>
        {wallets.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </Select>
      
      {/* Order form */}
      <Button 
        onClick={handleCreateOrder} 
        isLoading={isCreatingOrder}
      >
        Place Order
      </Button>
    </Box>
  );
};
```

#### Key Changes

1. **Wallet selection**: User must choose which wallet to use
2. **Real execution**: Orders are sent to Binance
3. **Order validation**: Backend validates before sending
4. **Order confirmation**: Real order ID returned
5. **Loading state**: Disable button during execution

---

## 🔐 Authentication Flow

All backend operations require authentication. Implement login flow:

```typescript
// In your App.tsx or main layout
import { useBackendAuth } from '@/hooks/useBackendAuth';

const App = () => {
  const { isAuthenticated, currentUser, isLoading } = useBackendAuth();
  
  if (isLoading) return <LoadingScreen />;
  
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  
  return (
    <MainLayout user={currentUser}>
      {/* Your app components */}
    </MainLayout>
  );
};
```

### Login Screen Example

```typescript
import { useBackendAuth } from '@/hooks/useBackendAuth';

const LoginScreen = () => {
  const { login, register, isLoggingIn, loginError } = useBackendAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Auto-redirects on success
    } catch (error) {
      toast.error(loginError?.message || 'Login failed');
    }
  };
  
  return (
    <form onSubmit={handleLogin}>
      <Input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
      />
      <Input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
      />
      <Button type="submit" isLoading={isLoggingIn}>
        Login
      </Button>
    </form>
  );
};
```

---

## ⚠️ Common Pitfalls

### 1. Not checking authentication

```typescript
// ❌ BAD
const { wallets } = useBackendWallet();

// ✅ GOOD
const { isAuthenticated } = useBackendAuth();
if (!isAuthenticated) return <LoginPrompt />;
const { wallets } = useBackendWallet();
```

### 2. Not handling loading states

```typescript
// ❌ BAD
return <div>{wallets.map(...)}</div>;

// ✅ GOOD
if (isLoading) return <LoadingSpinner />;
return <div>{wallets.map(...)}</div>;
```

### 3. Not handling errors

```typescript
// ❌ BAD
await createWallet(data);

// ✅ GOOD
try {
  await createWallet(data);
  toast.success('Created!');
} catch (error) {
  toast.error(createError?.message || 'Failed');
}
```

### 4. Mixing localStorage and backend

```typescript
// ❌ BAD - Don't use both!
const { wallets } = useBackendWallet();
localStorage.setItem('wallets', JSON.stringify(wallets));

// ✅ GOOD - Trust the backend
const { wallets } = useBackendWallet();
// Wallets are already synced with backend
```

---

## 🧪 Testing After Migration

```typescript
// Test that component works without localStorage
beforeEach(() => {
  localStorage.clear();
});

test('loads wallets from backend', async () => {
  render(<WalletManager />);
  
  await waitFor(() => {
    expect(screen.getByText('My Wallet')).toBeInTheDocument();
  });
  
  // Verify no localStorage access
  expect(localStorage.getItem).not.toHaveBeenCalled();
});
```

---

## 📚 Reference

- [Backend Quick Start](./BACKEND_QUICKSTART.md) - API usage examples
- [Backend README](../apps/backend/README.md) - Complete API reference
- [Authentication Guide](./AUTHENTICATION.md) - Security details

---

**Next:** Start with TradingSidebar migration - highest priority!
