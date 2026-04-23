# MarketMind Backend

Backend server for MarketMind trading platform, built with Fastify, tRPC, and PostgreSQL.

## Architecture

- **Framework:** Fastify 5.6.2
- **API:** tRPC 11.7.2 (type-safe RPC)
- **Database:** PostgreSQL 17 + TimescaleDB 2.23.1
- **ORM:** Drizzle ORM 0.44.7
- **Authentication:** Argon2 password hashing + session-based auth
- **Trading:** Binance SDK 3.1.5

## Directory Structure

```
apps/backend/
├── src/
│   ├── db/
│   │   ├── client.ts           # PostgreSQL connection
│   │   ├── schema.ts           # Database schema
│   │   └── migrations/         # SQL migrations
│   ├── routers/
│   │   ├── health.ts           # Health check endpoints
│   │   ├── auth.ts             # Authentication
│   │   ├── wallet.ts           # Wallet management
│   │   └── trading.ts          # Trading operations
│   ├── services/
│   │   ├── auth.ts             # Password hashing, session management
│   │   └── encryption.ts       # API key encryption (AES-256-CBC)
│   ├── trpc/
│   │   ├── index.ts            # tRPC instance
│   │   ├── context.ts          # Request context
│   │   └── router.ts           # Main router
│   ├── env.ts                  # Environment validation
│   └── index.ts                # Server entry point
├── test-api.mjs                # Manual API testing
├── test-integration.mjs        # Integration tests
└── types.ts                    # Type exports
```

## Setup

### Prerequisites

1. **PostgreSQL 17 + TimescaleDB 2.23.1**
   ```bash
   brew install postgresql@17 timescaledb
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Database Setup**
   ```bash
   # Create database and user
   psql postgres
   CREATE DATABASE marketmind;
   CREATE USER marketmind WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE marketmind TO marketmind;
   \c marketmind
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   \q
   ```

4. **Install Dependencies**
   ```bash
   # From project root
   pnpm install
   ```

### Development

```bash
# Start backend server (from project root)
pnpm --filter @marketmind/backend dev

# Or from backend directory
cd apps/backend
pnpm dev

# Server starts on http://localhost:3001
# tRPC endpoint: http://localhost:3001/trpc
```

### Database Migrations

```bash
# Generate new migration
pnpm --filter @marketmind/backend db:generate

# Apply migrations
pnpm --filter @marketmind/backend db:migrate

# Drop database (⚠️ destructive)
pnpm --filter @marketmind/backend db:drop

# Studio (GUI)
pnpm --filter @marketmind/backend db:studio
```

## API Reference

### Health Router

```typescript
// Check server health
trpc.health.check.useQuery()
// Returns: { status: 'ok', timestamp: string, version: string }

// Ping with optional message
trpc.health.ping.useQuery({ message: 'Hello' })
// Returns: { pong: true, echo: string }
```

### Auth Router

```typescript
// Register new user
trpc.auth.register.useMutation({
  email: 'user@example.com',
  password: 'SecurePassword123',
  name: 'John Doe' // optional
})

// Login
trpc.auth.login.useMutation({
  email: 'user@example.com',
  password: 'SecurePassword123'
})

// Get current user (requires authentication)
trpc.auth.me.useQuery()

// Logout
trpc.auth.logout.useMutation()
```

### Wallet Router

All wallet endpoints require authentication.

```typescript
// List all wallets
trpc.wallet.list.useQuery()

// Get wallet by ID
trpc.wallet.getById.useQuery({ id: 1 })

// Create wallet
trpc.wallet.create.useMutation({
  name: 'My Binance Wallet',
  exchange: 'binance',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
})

// Update wallet
trpc.wallet.update.useMutation({
  id: 1,
  name: 'Updated Name',
  apiKey: 'new_api_key', // optional
  apiSecret: 'new_api_secret' // optional
})

// Delete wallet
trpc.wallet.delete.useMutation({ id: 1 })

// Sync balance with Binance
trpc.wallet.syncBalance.useMutation({ id: 1 })

// Test Binance connection
trpc.wallet.testConnection.useMutation({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
})
```

### Trading Router

All trading endpoints require authentication.

```typescript
// List all orders
trpc.trading.getOrders.useQuery()

// Get order by ID
trpc.trading.getOrderById.useQuery({ id: 1 })

// Create order
trpc.trading.createOrder.useMutation({
  walletId: 1,
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  quantity: 0.001,
  price: 45000,
  stopPrice: 44000 // optional
})

// Cancel order
trpc.trading.cancelOrder.useMutation({ id: 1 })

// Sync orders from Binance
trpc.trading.syncOrders.useMutation({ walletId: 1 })

// List all positions
trpc.trading.getPositions.useQuery()

// Create position
trpc.trading.createPosition.useMutation({
  walletId: 1,
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryPrice: 45000,
  quantity: 0.001,
  stopLoss: 44000, // optional
  takeProfit: 50000 // optional
})

// Close position
trpc.trading.closePosition.useMutation({
  id: 1,
  exitPrice: 48000
})
```

## Security

### Password Hashing
- **Algorithm:** Argon2id (OWASP recommended)
- **Parameters:** 
  - Memory: 19456 KiB
  - Iterations: 2
  - Parallelism: 1

### API Key Storage
- **Encryption:** AES-256-CBC
- **Key Derivation:** PBKDF2 (100,000 iterations)
- **Storage:** Encrypted values in PostgreSQL

### Sessions
- **Generation:** `crypto.randomBytes(32)`
- **Storage:** Database with expiration
- **Lifetime:** 30 days
- **Transport:** HTTP-only cookies

## Testing

```bash
# Run integration tests
node apps/backend/test-integration.mjs

# Manual API testing
node apps/backend/test-api.mjs
```

## Frontend Integration

The backend is consumed by the Electron app using tRPC hooks:

```typescript
import { useBackendAuth } from '@/hooks/useBackendAuth';
import { useBackendWallet } from '@/hooks/useBackendWallet';
import { useBackendTrading } from '@/hooks/useBackendTrading';

// Authentication
const { login, logout, currentUser, isAuthenticated } = useBackendAuth();

// Wallets
const { wallets, createWallet, syncBalance } = useBackendWallet();

// Trading
const { orders, positions, createOrder, closePosition } = useBackendTrading();
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://marketmind:password@localhost:5432/marketmind

# Server
PORT=3001
NODE_ENV=development

# Session
SESSION_SECRET=your-random-secret-key

# Encryption
ENCRYPTION_KEY=your-encryption-key
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@17

# Check TimescaleDB extension
psql marketmind -c "SELECT * FROM pg_extension WHERE extname = 'timescaledb';"
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
lsof -ti:3001 | xargs kill -9
```

### Migration Errors

```bash
# Drop all tables and re-migrate (⚠️ destructive)
pnpm --filter @marketmind/backend db:drop
pnpm --filter @marketmind/backend db:migrate
```

## Performance

- **Connection Pooling:** PostgreSQL pool (max 20 connections)
- **Query Optimization:** Drizzle ORM with prepared statements
- **Indexes:** All foreign keys and frequently queried columns
- **TimescaleDB:** Optimized time-series queries for klines
- **Compression:** Automatic chunk compression after 7 days

## Exchange stream resilience

Both `BinanceKlineStreamService` (SPOT) and `BinanceFuturesKlineStreamService` (USDT-M futures) ship with a watchdog + synthesis fallback that keeps the chart alive during partial Binance WS incidents (e.g. when `@kline_*` / `@aggTrade` / `@markPrice` stop emitting but `@trade` stays alive).

### Watchdog (`services/binance-kline-stream.ts`)

- Each subscription tracks `lastMessageAt` + `healthStatus` (`'healthy' | 'degraded'`) + `lastReconnectAt`.
- A 15 s interval checks every sub. Silence > 60 s flips `healthy → degraded`, emits `stream:health` on the socket, and triggers a forced reconnect (`closeAll(true)` + fresh `start()` + `resubscribeAll()`), rate-limited to once per 120 s.
- Any real frame arriving resets `lastMessageAt` via `recordMessageReceived`. If status was degraded, it flips back to healthy and emits.
- New subscriptions created while any existing sub is already degraded inherit the degraded state immediately — avoids the 60 s blind spot when the user switches symbols mid-incident.

### Synthesis (`services/kline-synthesis.ts`)

- Owns its own WS client subscribed to `@trade` (which typically stays alive during aggregated-stream outages).
- Enabled from the stream service on `healthy → degraded` transitions.
- Aligns each trade to the interval's bucket boundary, accumulates OHLCV (open=first, high/low=minmax, close=last, volume=sum), emits progressive `kline:update` via the same `WebSocketService.emitKlineUpdate` path (≤ 1 per 200 ms), emits `isClosed: true` when a new bucket begins.
- On recovery (or unsubscribe), `disable(symbol, interval, marketType)` clears per-combo state so native frames take over seamlessly.

### Socket events emitted

| Event | Payload | Emitted when |
|---|---|---|
| `kline:update` | `{ symbol, interval, openTime, closeTime, open, high, low, close, volume, isClosed, timestamp }` | Every real frame from Binance + every synthesis emit (frontend doesn't distinguish; **backend is the single source of truth for health**) |
| `stream:health` | `{ symbol, interval, marketType, status, reason?, lastMessageAt }` | State transitions on a subscription (`healthy → degraded` or `degraded → healthy`) |
| `price:update` | `{ symbol, price, timestamp }` | Via `BinancePriceStreamService` — unrelated to kline health |

### Tuning

Constants in `services/binance-kline-stream.ts`:

- `STREAM_HEALTH_CHECK_INTERVAL_MS` (15 s)
- `STREAM_STALE_THRESHOLD_MS` (60 s) — how long a sub can be silent before being marked degraded
- `STREAM_FORCED_RECONNECT_COOLDOWN_MS` (120 s) — minimum gap between forced reconnect attempts

## Next Steps

- [ ] Rate limiting
- [ ] Request validation middleware
- [ ] Production deployment guide

## License

Private - MarketMind Project
