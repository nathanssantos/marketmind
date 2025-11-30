# 🎯 Backend - Quick Reference

**Version:** 0.31.0  
**Status:** ✅ MVP Operational  
**Server:** http://localhost:3001

---

## 🚀 Quick Start

```bash
# Start PostgreSQL
brew services start postgresql@17

# Start backend server
cd /Users/nathan/Documents/dev/marketmind
pnpm dev:backend

# Access endpoints
# Health: http://localhost:3001/health
# tRPC: http://localhost:3001/trpc
```

---

## 📡 Available Endpoints

### Health
- `GET /health` - Server health check
- `GET /trpc/health.ping` - tRPC ping
- `GET /trpc/health.check` - Database health

### Authentication
- `POST /trpc/auth.register` - Create account
- `POST /trpc/auth.login` - Login
- `POST /trpc/auth.logout` - Logout
- `GET /trpc/auth.me` - Get current user (protected)

### Wallets
- `GET /trpc/wallet.list` - List wallets (protected)
- `GET /trpc/wallet.getById` - Get wallet (protected)
- `POST /trpc/wallet.create` - Create wallet (protected)
- `PUT /trpc/wallet.update` - Update wallet (protected)
- `DELETE /trpc/wallet.delete` - Delete wallet (protected)
- `POST /trpc/wallet.syncBalance` - Sync balances (protected)
- `POST /trpc/wallet.testConnection` - Test Binance API (protected)

### Trading
- `POST /trpc/trading.createOrder` - Place order (protected)
- `DELETE /trpc/trading.cancelOrder` - Cancel order (protected)
- `GET /trpc/trading.getOrders` - List orders (protected)
- `GET /trpc/trading.getOrderById` - Get order (protected)
- `POST /trpc/trading.syncOrders` - Sync orders (protected)
- `GET /trpc/trading.getPositions` - List positions (protected)
- `POST /trpc/trading.createPosition` - Open position (protected)
- `PUT /trpc/trading.closePosition` - Close position (protected)

---

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Type checking
pnpm --filter @marketmind/backend type-check

# Linting
pnpm --filter @marketmind/backend lint

# Database migrations
pnpm --filter @marketmind/backend db:generate
pnpm --filter @marketmind/backend db:migrate

# Database studio (Drizzle GUI)
pnpm --filter @marketmind/backend db:studio

# View database
psql marketmind
\dt  # list tables
\d users  # describe users table
```

---

## 🗄️ Database Info

**Connection:**
- Host: localhost
- Port: 5432
- Database: marketmind
- User: marketmind
- Password: marketmind123

**URL:**
```
postgresql://marketmind:marketmind123@localhost:5432/marketmind
```

**Tables:**
1. users
2. sessions
3. wallets
4. orders
5. positions
6. klines (hypertable)
7. trading_setups
8. ai_conversations
9. ai_trades

---

## 🔐 Environment Variables

Located in: `/Users/nathan/Documents/dev/marketmind/apps/backend/.env`

```env
DATABASE_URL=postgresql://marketmind:marketmind123@localhost:5432/marketmind
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SESSION_SECRET=your-session-secret-change-in-production-min-32-chars
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**⚠️ Change in production!**

---

## 📊 Server Status Check

```bash
# Check if server is running
lsof -i :3001

# View server logs (if running in background)
tail -f /Users/nathan/Documents/dev/marketmind/apps/backend/server.log

# Kill server
lsof -ti:3001 | xargs kill -9
```

---

## 🧪 Testing Endpoints

### Using curl

```bash
# Health check
curl http://localhost:3001/health

# Register user
curl -X POST http://localhost:3001/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/trpc/auth.login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Get current user (with session)
curl http://localhost:3001/trpc/auth.me \
  -b cookies.txt
```

### Using Browser

Open VS Code Simple Browser:
- Health: http://localhost:3001/health
- tRPC Panel: http://localhost:3001/trpc-playground (if added)

---

## 📝 Important Files

```
apps/backend/
├── src/
│   ├── index.ts           # Main server
│   ├── env.ts             # Environment validation
│   ├── db/
│   │   ├── client.ts      # Database connection
│   │   └── schema.ts      # Drizzle schema
│   ├── services/
│   │   ├── auth.ts        # Authentication service
│   │   └── encryption.ts  # Encryption service
│   ├── routers/
│   │   ├── health.ts      # Health router
│   │   ├── auth.ts        # Auth router
│   │   ├── wallet.ts      # Wallet router
│   │   └── trading.ts     # Trading router
│   └── trpc/
│       ├── index.ts       # tRPC initialization
│       ├── context.ts     # Request context
│       └── router.ts      # Root router
├── .env                   # Environment variables (gitignored)
├── package.json
├── tsconfig.json
└── drizzle.config.ts      # Drizzle ORM config
```

---

## 🔄 Next Steps

### Priority 1: Socket.io Integration
- [ ] Install Socket.io
- [ ] Create WebSocket service
- [ ] Add real-time price feeds
- [ ] Implement order notifications

### Priority 2: Frontend Integration
- [ ] Install tRPC client in Electron
- [ ] Create API hooks
- [ ] Migrate components to backend
- [ ] Update state management

### Priority 3: Kline Sync
- [ ] Create background worker
- [ ] Binance WebSocket integration
- [ ] Historical data backfill
- [ ] Automated cleanup

---

## 📚 Documentation

- [Backend Implementation Plan](./BACKEND_IMPLEMENTATION_PLAN.md)
- [Backend Status (Detailed)](./BACKEND_STATUS.md)
- [Backend Progress](./BACKEND_PROGRESS.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [Monorepo Setup](../MONOREPO.md)

---

**Last Updated:** November 30, 2025  
**Server PID:** Check with `lsof -i :3001`  
**Logs:** Terminal output from `pnpm dev:backend`
