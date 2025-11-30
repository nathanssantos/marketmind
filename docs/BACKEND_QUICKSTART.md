# MarketMind Backend - Developer Quick Start

**Quick reference for working with the MarketMind backend infrastructure.**

---

## 🚀 Quick Commands

```bash
# Start backend server
pnpm --filter @marketmind/backend dev

# Start from backend directory
cd apps/backend && pnpm dev

# Run database migrations
pnpm --filter @marketmind/backend db:migrate

# Generate new migration
pnpm --filter @marketmind/backend db:generate

# Open Drizzle Studio (database GUI)
pnpm --filter @marketmind/backend db:studio

# Run integration tests
node apps/backend/test-integration.mjs

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

---

## 🔌 Using Backend in Frontend

### 1. Import the hook

```typescript
import { useBackendAuth } from '@/hooks/useBackendAuth';
import { useBackendWallet } from '@/hooks/useBackendWallet';
import { useBackendTrading } from '@/hooks/useBackendTrading';
```

### 2. Use in component

```typescript
const MyComponent = () => {
  // Authentication
  const { currentUser, login, logout, isAuthenticated } = useBackendAuth();
  
  // Wallets
  const { wallets, createWallet, syncBalance, isLoading } = useBackendWallet();
  
  // Trading
  const { orders, positions, createOrder, closePosition } = useBackendTrading();
  
  // Example: Login
  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password123');
      console.log('Logged in!');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  // Example: Create wallet
  const handleCreateWallet = async () => {
    try {
      await createWallet({
        name: 'My Binance Wallet',
        exchange: 'binance',
        apiKey: 'xxx',
        apiSecret: 'yyy',
      });
    } catch (error) {
      console.error('Failed:', error);
    }
  };
  
  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {currentUser?.email}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
};
```

---

## 📡 API Endpoints Reference

### Health
```typescript
// Check server health
const { data } = trpc.health.check.useQuery();
// { status: 'ok', timestamp: '...', version: '0.31.0' }
```

### Authentication
```typescript
// Register
await trpc.auth.register.mutate({
  email: 'user@example.com',
  password: 'SecurePass123',
  name: 'John Doe' // optional
});

// Login
await trpc.auth.login.mutate({
  email: 'user@example.com',
  password: 'SecurePass123'
});

// Get current user
const { data: user } = trpc.auth.me.useQuery();

// Logout
await trpc.auth.logout.mutate();
```

### Wallets
```typescript
// List wallets
const { data: wallets } = trpc.wallet.list.useQuery();

// Create wallet
await trpc.wallet.create.mutate({
  name: 'My Wallet',
  exchange: 'binance',
  apiKey: 'xxx',
  apiSecret: 'yyy'
});

// Sync balance from Binance
await trpc.wallet.syncBalance.mutate({ id: 1 });

// Test connection
const { data: result } = await trpc.wallet.testConnection.mutate({
  apiKey: 'xxx',
  apiSecret: 'yyy'
});
```

### Trading
```typescript
// List orders
const { data: orders } = trpc.trading.getOrders.useQuery();

// Create order
await trpc.trading.createOrder.mutate({
  walletId: 1,
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  quantity: 0.001,
  price: 45000
});

// Cancel order
await trpc.trading.cancelOrder.mutate({ id: 1 });

// List positions
const { data: positions } = trpc.trading.getPositions.useQuery();

// Close position
await trpc.trading.closePosition.mutate({
  id: 1,
  exitPrice: 48000
});
```

---

## 🔧 Common Tasks

### Add New Endpoint

1. **Define in router** (`apps/backend/src/routers/[router].ts`):
```typescript
export const myRouter = router({
  myEndpoint: protectedProcedure
    .input(z.object({ param: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation
      return { result: 'success' };
    }),
});
```

2. **Add to main router** (`apps/backend/src/trpc/router.ts`):
```typescript
export const appRouter = router({
  // ... existing routers
  myRouter: myRouter,
});
```

3. **Use in frontend**:
```typescript
const { data } = trpc.myRouter.myEndpoint.useQuery({ param: 'value' });
```

### Add Database Table

1. **Update schema** (`apps/backend/src/db/schema.ts`):
```typescript
export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. **Generate migration**:
```bash
pnpm --filter @marketmind/backend db:generate
```

3. **Apply migration**:
```bash
pnpm --filter @marketmind/backend db:migrate
```

### Debug Backend

1. **Check logs** - Backend uses pino logger with JSON output
2. **Check database**:
```bash
psql marketmind
\dt  # List tables
SELECT * FROM users;  # Query data
```

3. **Test endpoint**:
```bash
curl http://localhost:3001/trpc/health.check
```

---

## 🐛 Troubleshooting

### Port 3001 already in use
```bash
lsof -ti:3001 | xargs kill -9
```

### Database connection failed
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@17

# Verify connection
psql marketmind
```

### Migration failed
```bash
# Reset database (⚠️ deletes all data)
pnpm --filter @marketmind/backend db:drop
pnpm --filter @marketmind/backend db:migrate
```

### TypeScript errors in hooks
- Errors like "Property 'wallet' does not exist" are LSP issues
- Types resolve correctly at build time
- Backend must be running for type inference

### Session not persisting
- Check cookies are enabled
- Verify `credentials: 'include'` in fetch options
- Check session in database: `SELECT * FROM sessions;`

---

## 📊 Project Structure

```
apps/
├── backend/              # Backend server
│   ├── src/
│   │   ├── db/          # Database (schema, migrations)
│   │   ├── routers/     # tRPC routers (health, auth, wallet, trading)
│   │   ├── services/    # Business logic (auth, encryption)
│   │   └── trpc/        # tRPC setup (context, router)
│   └── types.ts         # Type exports
│
├── electron/             # Electron app
│   └── src/
│       └── renderer/
│           ├── hooks/   # Backend hooks (useBackendAuth, etc)
│           └── utils/   # tRPC client (trpc.ts)
│
packages/
├── types/               # Shared TypeScript types
└── indicators/          # Technical analysis utilities
```

---

## 🔐 Security Notes

- **Passwords:** Hashed with Argon2id (OWASP parameters)
- **API Keys:** Encrypted with AES-256-CBC before database storage
- **Sessions:** 30-day expiration, stored in database
- **Cookies:** HTTP-only, secure in production
- **SQL Injection:** Protected by Drizzle ORM parameterized queries

---

## 📚 Documentation

- [Backend README](../../apps/backend/README.md) - Complete setup guide
- [Backend Status](./BACKEND_STATUS.md) - Technical implementation details
- [Authentication Guide](./AUTHENTICATION.md) - Security architecture
- [Integration Status](./BACKEND_INTEGRATION_STATUS.md) - Progress overview

---

## 🎯 Next Features

- [ ] Socket.io for real-time updates
- [ ] Kline synchronization service
- [ ] Rate limiting middleware
- [ ] Request caching layer
- [ ] Comprehensive test suite

---

**Backend URL:** http://localhost:3001  
**tRPC Endpoint:** http://localhost:3001/trpc  
**Version:** 0.31.0
