# 🚀 Backend Implementation Plan - MarketMind

**Created:** November 30, 2025  
**Status:** Planning Phase  
**Target Completion:** 10 weeks (February 2026)

---

## 📋 Executive Summary

Implementation of a high-performance backend infrastructure to support autonomous trading bots/algorithms in the MarketMind Electron application. The backend will enable 24/7 trading operations, multi-device sync, secure credential storage, and real-time notifications, while maintaining the current frontend functionality during gradual migration.

---

## 🎯 Core Objectives

1. **End-to-End Type Safety** - tRPC for automatic type synchronization between frontend and backend
2. **Maximum Performance** - Fastify framework, TimescaleDB for time-series data, Redis caching
3. **Autonomous Trading** - Backend bots running 24/7 without frontend dependency
4. **Secure Authentication** - Lucia session management, encrypted API keys (AES-256)
5. **Gradual Migration** - Feature flags for seamless transition without breaking existing functionality
6. **Real-Time Updates** - WebSocket subscriptions for order updates, setup notifications
7. **Offline Support** - IndexedDB cache with sync queue for offline operations

---

## 🛠️ Technology Stack

### Backend Framework (Latest Versions - Nov 2025)
- **Fastify 5.6.2** - 2-3x faster than Express, TypeScript native, built-in validation
- **tRPC 11.7.2** - End-to-end type safety without code generation
- **Drizzle ORM 0.44.7** - Lightweight, TypeScript-first, SQL-like API with modern type inference
- **PostgreSQL 16+ / TimescaleDB** - ACID compliance, time-series optimization
- **Argon2 (@node-rs/argon2 2.0.0)** - Password hashing with native Rust bindings (faster, more secure)
- **Socket.io 4.8.1** - Real-time WebSocket communication
- **Binance SDK 3.1.5** - Official `binance` npm package for API integration

### Justification
```
┌─────────────────────────────────────────┐
│ Frontend (Electron Renderer)            │
│ - React 19 + TypeScript                 │
│ - tRPC Client (React Query)             │
│ - Zustand (local UI state)              │
└──────────────┬──────────────────────────┘
               │ tRPC over HTTP/WebSocket
┌──────────────▼──────────────────────────┐
│ Backend API (Fastify 5.6.2)             │
│ - tRPC 11.7.2 Router                    │
│ - Session-based Auth (Argon2)           │
│ - Socket.io 4.8.1 (real-time)           │
│ - Zod 3.24.1 Validation                 │
└──────────────┬──────────────────────────┘
               │ Drizzle ORM 0.44.7
┌──────────────▼──────────────────────────┐
│ Database (PostgreSQL 16 + TimescaleDB)  │
│ - Users, Sessions, Wallets              │
│ - Orders, Positions, Trading Setups     │
│ - Klines (hypertable, time-series)      │
│ - AI Conversations, Trades              │
└─────────────────────────────────────────┘
               │ Binance SDK
┌──────────────▼──────────────────────────┐
│ Binance API                             │
│ - REST API (orders, account)            │
│ - WebSocket (klines, user data stream)  │
└─────────────────────────────────────────┘
```

---

## 📁 Project Structure

### Monorepo Architecture

```
marketmind/
├── apps/
│   ├── electron/                    # Existing frontend (unchanged)
│   │   ├── src/
│   │   │   ├── main/
│   │   │   ├── renderer/
│   │   │   └── shared/             # TO BE MOVED →
│   │   └── package.json
│   │
│   └── backend/                     # NEW - Backend API
│       ├── src/
│       │   ├── index.ts            # Fastify server entry
│       │   ├── env.ts              # Environment validation (Zod)
│       │   │
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle schema (see Database Schema)
│       │   │   ├── migrations/     # SQL migrations
│       │   │   └── client.ts       # PostgreSQL connection
│       │   │
│       │   ├── trpc/
│       │   │   ├── context.ts      # tRPC context (user, db, io)
│       │   │   ├── middleware.ts   # Auth, logging, error handling
│       │   │   └── router.ts       # Root router
│       │   │
│       │   ├── routers/
│       │   │   ├── auth.ts         # Login, register, logout
│       │   │   ├── trading.ts      # Orders, positions, cancel
│       │   │   ├── wallet.ts       # Wallet CRUD, credentials
│       │   │   ├── setup.ts        # Setup detection queries
│       │   │   ├── ai.ts           # AI conversations, trades
│       │   │   └── market.ts       # Klines, symbols, exchange info
│       │   │
│       │   ├── services/
│       │   │   ├── binance.ts      # Binance API client wrapper
│       │   │   ├── setupDetection.ts  # Setup detection engine
│       │   │   ├── aiTrading.ts    # AI trading bot (autonomous)
│       │   │   ├── backtesting.ts  # Backtesting engine
│       │   │   ├── notifications.ts # WebSocket notifications
│       │   │   └── encryption.ts   # API key encryption (AES-256)
│       │   │
│       │   ├── jobs/
│       │   │   ├── klineSync.ts    # Sync klines from Binance (cron)
│       │   │   ├── setupScanner.ts # Scan for setups 24/7 (cron)
│       │   │   └── performanceTracker.ts # Track setup PnL
│       │   │
│       │   └── utils/
│       │       ├── crypto.ts       # Encryption helpers
│       │       └── validation.ts   # Zod schemas
│       │
│       ├── drizzle.config.ts
│       ├── package.json
│       └── tsconfig.json
│
└── packages/                        # Shared code
    ├── types/                       # MOVED FROM apps/electron/src/shared/types
    │   ├── kline.ts
    │   ├── trading.ts
    │   ├── setup.ts
    │   ├── ai.ts
    │   ├── wallet.ts
    │   └── index.ts                # Barrel export
    │
    ├── indicators/                  # MOVED FROM apps/electron/src/renderer/utils
    │   ├── ema.ts                  # EMA/SMA calculation
    │   ├── rsi.ts                  # RSI with divergence
    │   ├── supportResistance.ts    # Pivot points, S/R
    │   └── index.ts
    │
    └── utils/                       # Shared utilities
        ├── formatters.ts
        └── validators.ts
```

---

## 🗄️ Database Schema (Drizzle)

### Core Tables

```typescript
// apps/backend/src/db/schema.ts
import { pgTable, varchar, timestamp, bigint, numeric, integer, boolean, text, primaryKey } from 'drizzle-orm/pg-core';

// ============================================
// Authentication
// ============================================

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(), // UUID
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
});

// ============================================
// Trading Infrastructure
// ============================================

export const wallets = pgTable('wallets', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  
  // Encrypted Binance API credentials (AES-256-CBC)
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiSecretEncrypted: text('api_secret_encrypted').notNull(),
  
  // Wallet metadata
  initialBalance: numeric('initial_balance', { precision: 20, scale: 8 }),
  currentBalance: numeric('current_balance', { precision: 20, scale: 8 }),
  currency: varchar('currency', { length: 10 }).default('USDT'),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  // Binance fields (from API response)
  orderId: bigint('order_id', { mode: 'number' }).primaryKey(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  side: varchar('side', { length: 10 }).$type<'BUY' | 'SELL'>().notNull(),
  type: varchar('type', { length: 30 }).notNull(), // LIMIT, MARKET, STOP_LOSS, etc.
  price: varchar('price', { length: 50 }),
  origQty: varchar('orig_qty', { length: 50 }),
  executedQty: varchar('executed_qty', { length: 50 }),
  status: varchar('status', { length: 30 }).notNull(), // NEW, FILLED, CANCELED, etc.
  timeInForce: varchar('time_in_force', { length: 10 }),
  time: bigint('time', { mode: 'number' }),
  updateTime: bigint('update_time', { mode: 'number' }),
  
  // MarketMind metadata (not sent to Binance)
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 }).notNull().references(() => wallets.id),
  setupId: varchar('setup_id', { length: 255 }), // Link to trading_setups
  setupType: varchar('setup_type', { length: 100 }), // 'SETUP_9_1', 'PATTERN_123', etc.
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const positions = pgTable('positions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 }).notNull().references(() => wallets.id),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  side: varchar('side', { length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  entryQty: numeric('entry_qty', { precision: 20, scale: 8 }).notNull(),
  currentPrice: numeric('current_price', { precision: 20, scale: 8 }),
  
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  
  pnl: numeric('pnl', { precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  
  status: varchar('status', { length: 20 }).default('open'), // 'open', 'closed'
  closedAt: timestamp('closed_at'),
  
  setupId: varchar('setup_id', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Market Data (Time-Series)
// ============================================

export const klines = pgTable('klines', {
  symbol: varchar('symbol', { length: 20 }).notNull(),
  interval: varchar('interval', { length: 5 }).notNull(), // '1m', '5m', '1h', etc.
  openTime: timestamp('open_time').notNull(),
  
  open: numeric('open', { precision: 20, scale: 8 }).notNull(),
  high: numeric('high', { precision: 20, scale: 8 }).notNull(),
  low: numeric('low', { precision: 20, scale: 8 }).notNull(),
  close: numeric('close', { precision: 20, scale: 8 }).notNull(),
  
  volume: numeric('volume', { precision: 20, scale: 8 }).notNull(),
  quoteVolume: numeric('quote_volume', { precision: 20, scale: 8 }),
  trades: integer('trades'),
  
  takerBuyBaseVolume: numeric('taker_buy_base_volume', { precision: 20, scale: 8 }),
  takerBuyQuoteVolume: numeric('taker_buy_quote_volume', { precision: 20, scale: 8 }),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.symbol, table.interval, table.openTime] }),
}));

// TimescaleDB: Convert to hypertable (run after table creation)
// SELECT create_hypertable('klines', 'open_time');

// ============================================
// Trading Setups & Detection
// ============================================

export const tradingSetups = pgTable('trading_setups', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id),
  
  // Setup identification
  type: varchar('type', { length: 100 }).notNull(), // 'SETUP_9_1', 'PATTERN_123', etc.
  symbol: varchar('symbol', { length: 20 }).notNull(),
  interval: varchar('interval', { length: 5 }).notNull(),
  direction: varchar('direction', { length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  
  // Price levels
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }).notNull(),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }).notNull(),
  
  // Setup quality
  confidence: integer('confidence').notNull(), // 0-100
  detectedAt: timestamp('detected_at').defaultNow(),
  
  // Execution tracking
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'executed', 'canceled'
  
  // Performance tracking
  pnl: numeric('pnl', { precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  closedAt: timestamp('closed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// AI Integration
// ============================================

export const aiConversations = pgTable('ai_conversations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id),
  
  provider: varchar('provider', { length: 50 }).notNull(), // 'openai', 'anthropic', 'gemini'
  model: varchar('model', { length: 100 }).notNull(),
  
  messages: text('messages').notNull(), // JSON array of messages
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiTrades = pgTable('ai_trades', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 }).notNull().references(() => wallets.id),
  
  symbol: varchar('symbol', { length: 20 }).notNull(),
  action: varchar('action', { length: 10 }).$type<'BUY' | 'SELL' | 'HOLD'>().notNull(),
  
  reasoning: text('reasoning').notNull(),
  confidence: integer('confidence').notNull(),
  
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  
  status: varchar('status', { length: 20 }).default('pending'),
  
  pnl: numeric('pnl', { precision: 20, scale: 8 }),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Type Inference (for tRPC)
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Position = typeof positions.$inferSelect;
export type TradingSetup = typeof tradingSetups.$inferSelect;
export type AIConversation = typeof aiConversations.$inferSelect;
export type AITrade = typeof aiTrades.$inferSelect;
```

### Entity Relationships

```
users (1) ──────┬─────> (N) sessions
                ├─────> (N) wallets
                ├─────> (N) orders
                ├─────> (N) positions
                ├─────> (N) tradingSetups
                ├─────> (N) aiConversations
                └─────> (N) aiTrades

wallets (1) ────┬─────> (N) orders
                ├─────> (N) positions
                └─────> (N) aiTrades

tradingSetups (1) ────> (1) orders (optional)

orders (1) <──── (1) positions (optional)
orders (1) <──── (1) aiTrades (optional)
```

### TimescaleDB Optimizations

```sql
-- Convert klines to hypertable (time-series optimization)
SELECT create_hypertable('klines', 'open_time');

-- Create continuous aggregate for 5m klines (from 1m data)
CREATE MATERIALIZED VIEW klines_5m
WITH (timescaledb.continuous) AS
SELECT 
  symbol,
  interval,
  time_bucket('5 minutes', open_time) AS open_time,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume,
  sum(quote_volume) AS quote_volume,
  sum(trades) AS trades
FROM klines
WHERE interval = '1m'
GROUP BY symbol, interval, time_bucket('5 minutes', open_time);

-- Auto-refresh policy (every 1 minute)
SELECT add_continuous_aggregate_policy('klines_5m',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

-- Compression policy (compress data older than 7 days)
SELECT add_compression_policy('klines', INTERVAL '7 days');

-- Retention policy (delete data older than 1 year)
SELECT add_retention_policy('klines', INTERVAL '1 year');
```

---

## 🔐 Security Implementation

### API Key Encryption (AES-256-CBC)

```typescript
// apps/backend/src/services/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes (from env)
const IV_LENGTH = 16;

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### Authentication Flow (Modern Argon2 + Sessions)

```typescript
// apps/backend/src/services/auth.ts
import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { db } from '../db/client';
import { users, sessions } from '../db/schema';
import { eq } from 'drizzle-orm';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

export const createUser = async (email: string, password: string) => {
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  const userId = generateId(21);

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
  });

  return userId;
};

export const createSession = async (userId: string) => {
  const sessionId = generateId(40);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return { sessionId, expiresAt };
};

export const validateSession = async (sessionId: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || Date.now() >= session.expiresAt.getTime()) {
    if (session) await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;

  return { session, user };
};
```

### tRPC Context with Session Validation

```typescript
// apps/backend/src/trpc/context.ts
import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { db } from '../db/client';
import { validateSession } from '../services/auth';

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const sessionId = req.cookies.session_id;
  
  if (!sessionId) {
    return { db, user: null, session: null };
  }
  
  const result = await validateSession(sessionId);
  
  return {
    db,
    user: result?.user || null,
    session: result?.session || null,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
```

### Protected Procedure Middleware

```typescript
// apps/backend/src/trpc/index.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
```

### Rate Limiting (Fastify 5.6.2)

```typescript
// apps/backend/src/index.ts
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'],
  keyGenerator: (req) => req.headers['x-forwarded-for'] as string || req.ip,
});
```

---

## 🔄 tRPC Implementation

### Backend Router Example (tRPC 11.7.2 + Binance 3.1.5)

```typescript
// apps/backend/src/routers/trading.ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { MainClient } from 'binance';
import { TRPCError } from '@trpc/server';
import { encryptApiKey, decryptApiKey } from '../services/encryption';
import { orders, wallets } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const tradingRouter = router({
  createOrder: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      symbol: z.string(),
      side: z.enum(['BUY', 'SELL']),
      type: z.enum(['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT']),
      quantity: z.string(),
      price: z.string().optional(),
      stopPrice: z.string().optional(),
      setupId: z.string().optional(),
      setupType: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(
          eq(wallets.id, input.walletId),
          eq(wallets.userId, ctx.user.id)
        ))
        .limit(1);
      
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }
      
      const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
      const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);
      
      const binance = new MainClient({
        api_key: apiKey,
        api_secret: apiSecret,
      });
      
      const binanceOrder = await binance.submitNewOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        stopPrice: input.stopPrice,
        timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
      });
      
      // 5. Store in database with metadata
      await ctx.db.insert(orders).values({
        orderId: binanceOrder.orderId,
        userId: ctx.user.id,
        walletId: input.walletId,
        symbol: binanceOrder.symbol,
        side: binanceOrder.side,
        type: binanceOrder.type,
        price: binanceOrder.price,
        origQty: binanceOrder.origQty,
        executedQty: binanceOrder.executedQty || '0',
        status: binanceOrder.status,
        timeInForce: binanceOrder.timeInForce,
        time: binanceOrder.transactTime,
        updateTime: binanceOrder.transactTime,
        setupId: input.setupId,
        setupType: input.setupType,
      });
      
      // 6. Broadcast to user via WebSocket
      ctx.io.to(ctx.user.id).emit('order:created', binanceOrder);
      
      return binanceOrder;
    }),
    
  // Get orders
  getOrders: protectedProcedure
    .input(z.object({
      walletId: z.string().optional(),
      symbol: z.string().optional(),
      status: z.enum(['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.orders.findMany({
        where: (orders, { eq, and }) => {
          const conditions = [eq(orders.userId, ctx.user.id)];
          if (input.walletId) conditions.push(eq(orders.walletId, input.walletId));
          if (input.symbol) conditions.push(eq(orders.symbol, input.symbol));
          if (input.status) conditions.push(eq(orders.status, input.status));
          return and(...conditions);
        },
        orderBy: (orders, { desc }) => [desc(orders.time)],
        limit: input.limit,
      });
    }),
    
  // Cancel order
  cancelOrder: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      orderId: z.number(),
      symbol: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Get wallet
      const wallet = await ctx.db.query.wallets.findFirst({
        where: (wallets, { eq, and }) => 
          and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id))
      });
      
      if (!wallet) throw new Error('Wallet not found');
      
      // 2. Create Binance client
      const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
      const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);
      const binance = new MainClient({ api_key: apiKey, api_secret: apiSecret });
      
      // 3. Cancel on Binance
      const result = await binance.cancelOrder({
        symbol: input.symbol,
        orderId: input.orderId,
      });
      
      // 4. Update database
      await ctx.db.update(orders)
        .set({ status: 'CANCELED', updateTime: Date.now() })
        .where(eq(orders.orderId, input.orderId));
      
      // 5. Notify via WebSocket
      ctx.io.to(ctx.user.id).emit('order:canceled', result);
      
      return result;
    }),
    
  // Real-time order updates (WebSocket subscription)
  onOrderUpdate: protectedProcedure
    .subscription(async function* ({ ctx }) {
      // Subscribe to user-specific order updates
      const channel = `user:${ctx.user.id}:orders`;
      
      // In production, use Redis pub/sub or similar
      for await (const message of subscribeToChannel(channel)) {
        yield message;
      }
    }),
});
```

### Frontend Integration

```typescript
// apps/electron/src/renderer/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../backend/src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

// apps/electron/src/renderer/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './lib/trpc';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      credentials: 'include', // Send cookies
    }),
  ],
});

export function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* Your app */}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Usage in component
function TradingPanel() {
  const { data: orders, isLoading } = trpc.trading.getOrders.useQuery({
    walletId: 'wallet_123',
  });
  
  const { mutate: createOrder } = trpc.trading.createOrder.useMutation({
    onSuccess: (order) => {
      toast.success(`Order ${order.orderId} created`);
    },
  });
  
  // Real-time subscription
  trpc.trading.onOrderUpdate.useSubscription(undefined, {
    onData: (order) => {
      toast.info(`Order ${order.orderId} updated: ${order.status}`);
    },
  });
  
  return (
    <Button onClick={() => createOrder({
      walletId: 'wallet_123',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '50000',
    })}>
      Place Order
    </Button>
  );
}
```

---

## 🤖 Autonomous Trading Bot

### Setup Detection Service (24/7)

```typescript
// apps/backend/src/services/setupDetection.ts
import { db } from '../db/client';
import { klines, tradingSetups } from '../db/schema';
import { detectSetup91 } from '@marketmind/indicators/setup9_1'; // Migrated from frontend
import { detectSetup92 } from '@marketmind/indicators/setup9_2';
// ... import all 13 detectors

export class SetupDetectionService {
  private isRunning = false;
  
  async start() {
    this.isRunning = true;
    console.log('Setup detection service started');
    
    while (this.isRunning) {
      await this.scanAllSymbols();
      await this.sleep(60_000); // Scan every 1 minute
    }
  }
  
  async scanAllSymbols() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']; // Get from config/DB
    const intervals = ['1m', '5m', '15m', '1h'];
    
    for (const symbol of symbols) {
      for (const interval of intervals) {
        await this.scanSymbolInterval(symbol, interval);
      }
    }
  }
  
  async scanSymbolInterval(symbol: string, interval: string) {
    // 1. Get recent klines from DB
    const recentKlines = await db.query.klines.findMany({
      where: (klines, { eq, and }) => 
        and(eq(klines.symbol, symbol), eq(klines.interval, interval)),
      orderBy: (klines, { desc }) => [desc(klines.openTime)],
      limit: 200, // Enough for indicators
    });
    
    if (recentKlines.length < 100) return; // Not enough data
    
    // 2. Run all detectors
    const detectors = [
      detectSetup91,
      detectSetup92,
      detectSetup93,
      detectSetup94,
      detectPattern123,
      detectBullTrap,
      detectBearTrap,
      detectBreakoutRetest,
      detectPinInsideBar,
      detectOrderBlockFVG,
      detectVWAPEMACross,
      detectDivergence,
      detectLiquiditySweep,
    ];
    
    for (const detector of detectors) {
      const setup = detector(recentKlines, { symbol, interval });
      
      if (setup) {
        await this.saveSetup(setup);
        await this.notifyUsers(setup);
      }
    }
  }
  
  async saveSetup(setup: DetectedSetup) {
    await db.insert(tradingSetups).values({
      id: crypto.randomUUID(),
      userId: setup.userId || 'system', // System-detected setups
      type: setup.type,
      symbol: setup.symbol,
      interval: setup.interval,
      direction: setup.direction,
      entryPrice: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      confidence: setup.confidence,
    });
  }
  
  async notifyUsers(setup: DetectedSetup) {
    // Notify all users subscribed to this symbol
    io.emit('setup:detected', setup);
  }
  
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### AI Trading Bot (Autonomous)

```typescript
// apps/backend/src/services/aiTrading.ts
import OpenAI from 'openai';
import { db } from '../db/client';
import { aiTrades, positions, orders } from '../db/schema';

export class AITradingBot {
  private openai: OpenAI;
  private isRunning = false;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  async start() {
    this.isRunning = true;
    console.log('AI trading bot started');
    
    while (this.isRunning) {
      await this.monitorPositions();
      await this.analyzeNewSetups();
      await this.sleep(30_000); // Check every 30 seconds
    }
  }
  
  async monitorPositions() {
    // Get all open positions
    const openPositions = await db.query.positions.findMany({
      where: (positions, { eq }) => eq(positions.status, 'open'),
    });
    
    for (const position of openPositions) {
      await this.evaluatePosition(position);
    }
  }
  
  async evaluatePosition(position: Position) {
    // Get current price
    const currentPrice = await this.getCurrentPrice(position.symbol);
    
    // Calculate PnL
    const pnl = position.side === 'LONG'
      ? (currentPrice - position.entryPrice) * position.entryQty
      : (position.entryPrice - currentPrice) * position.entryQty;
    
    // AI decision: hold, take profit, or cut loss?
    const decision = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert cryptocurrency trader. Analyze the position and decide: HOLD, CLOSE, or ADJUST_SL.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            symbol: position.symbol,
            side: position.side,
            entryPrice: position.entryPrice,
            currentPrice,
            pnl,
            pnlPercent: (pnl / (position.entryPrice * position.entryQty)) * 100,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
          }),
        },
      ],
    });
    
    const action = decision.choices[0].message.content;
    
    if (action === 'CLOSE') {
      await this.closePosition(position);
    } else if (action.startsWith('ADJUST_SL')) {
      // Extract new stop loss from AI response
      const newSL = parseFloat(action.split(':')[1]);
      await this.updateStopLoss(position, newSL);
    }
  }
  
  async analyzeNewSetups() {
    // Get recently detected setups (last 5 minutes)
    const recentSetups = await db.query.tradingSetups.findMany({
      where: (setups, { eq, gte }) => 
        and(
          eq(setups.status, 'pending'),
          gte(setups.detectedAt, new Date(Date.now() - 5 * 60 * 1000))
        ),
    });
    
    for (const setup of recentSetups) {
      const shouldTrade = await this.evaluateSetup(setup);
      
      if (shouldTrade) {
        await this.executeSetup(setup);
      }
    }
  }
  
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 📊 Migration Strategy

### Phase-by-Phase Roadmap

| Phase | Duration | Tasks | Deliverables |
|-------|----------|-------|--------------|
| **Phase 1: Foundation** | Week 1-2 | Backend setup, database, auth | Working auth system, tRPC endpoints |
| **Phase 2: Trading Infra** | Week 3-4 | Wallet management, Binance integration | Order creation/cancellation working |
| **Phase 3: Data Migration** | Week 5-6 | Setup detection backend, kline sync | Autonomous setup scanning |
| **Phase 4: Bot Trading** | Week 7-8 | AI trading bot, position monitoring | 24/7 trading bot operational |
| **Phase 5: Frontend** | Week 9-10 | tRPC client, real-time subscriptions | Full frontend-backend integration |

### Gradual Migration Pattern

```typescript
// Feature flag approach
const USE_BACKEND_TRADING = localStorage.getItem('feature:backend-trading') === 'true';

// Hybrid service wrapper
export const tradingService = {
  async createOrder(params: CreateOrderParams) {
    if (USE_BACKEND_TRADING) {
      // Backend path
      return await trpc.trading.createOrder.mutate(params);
    } else {
      // Legacy path (simulator)
      return await simulatorService.createOrder(params);
    }
  },
};
```

### Data Migration Script

```typescript
// scripts/migrate-to-backend.ts
import { trpc } from './lib/trpc';

export async function migrateUserData() {
  console.log('Starting migration to backend...');
  
  // 1. Migrate wallets
  const localWallets = getFromElectronStore('tradingData.wallets');
  for (const wallet of localWallets) {
    await trpc.wallet.create.mutate({
      name: wallet.name,
      apiKey: wallet.credentials.apiKey,
      apiSecret: wallet.credentials.apiSecret,
      initialBalance: wallet.initialBalance,
    });
  }
  
  // 2. Migrate orders (historical)
  const localOrders = getFromElectronStore('tradingData.orders');
  for (const order of localOrders) {
    await trpc.trading.importOrder.mutate(order);
  }
  
  // 3. Migrate AI conversations
  const conversations = getFromElectronStore('aiData.conversations');
  for (const conv of conversations) {
    await trpc.ai.importConversation.mutate(conv);
  }
  
  // 4. Mark migration complete
  localStorage.setItem('migration-status', JSON.stringify({
    version: '1.0.0',
    completedAt: new Date().toISOString(),
    backend: true,
  }));
  
  // 5. Enable backend mode
  localStorage.setItem('feature:backend-trading', 'true');
  
  console.log('Migration complete!');
}
```

---

## 🚀 Deployment Strategy

### Development Environment

```bash
# Backend
cd apps/backend
pnpm install
pnpm db:push        # Apply schema to dev DB
pnpm dev            # Start Fastify on :3000

# Frontend (unchanged)
cd apps/electron
pnpm dev            # Start Electron
```

### Production Options

| Platform | Pros | Cons | Cost |
|----------|------|------|------|
| **Railway** | Easy setup, Postgres+Redis included, auto-deploy | Limited free tier | $5-20/mo |
| **Render** | Free tier, auto-scaling | Cold starts on free tier | Free - $7/mo |
| **DigitalOcean** | Full control, VPS | Manual setup, maintenance | $6-12/mo |
| **AWS Lightsail** | Cheap VPS, managed DB | AWS complexity | $5-10/mo |

**Recommendation:** Start with Railway (dev), migrate to DigitalOcean VPS (production).

### Environment Variables

```bash
# .env (apps/backend)
DATABASE_URL=postgresql://user:pass@localhost:5432/marketmind
ENCRYPTION_KEY=<32-byte-hex-key>
SESSION_SECRET=<random-secret>

REDIS_URL=redis://localhost:6379

NODE_ENV=production
PORT=3000

# Optional: AI keys for backend bot
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## ✅ Success Metrics

### Performance Targets

- [ ] **API Response Time:** < 100ms (p95)
- [ ] **WebSocket Latency:** < 50ms (order updates)
- [ ] **Database Queries:** < 50ms (p95)
- [ ] **Setup Detection:** Scan 100 symbols/minute
- [ ] **Bot Uptime:** 99.9% (24/7 operation)

### Type Safety

- [ ] **Zero `any` Types:** 100% typed backend
- [ ] **tRPC Coverage:** All endpoints type-safe
- [ ] **Shared Types:** Frontend/backend use same types

### Security

- [ ] **API Keys:** AES-256 encryption
- [ ] **Sessions:** Lucia with secure cookies
- [ ] **Rate Limiting:** 100 req/min per IP
- [ ] **SQL Injection:** Drizzle parameterized queries

---

## 📚 Next Steps

### Immediate Actions (Week 1)

1. **Setup Monorepo**
   ```bash
   mkdir -p apps/backend packages/types packages/indicators
   pnpm init -w
   ```

2. **Install Dependencies**
   ```bash
   # Backend
   cd apps/backend
   pnpm add fastify @trpc/server drizzle-orm postgres lucia binance socket.io zod
   pnpm add -D @types/node tsx drizzle-kit
   
   # Frontend
   cd apps/electron
   pnpm add @trpc/client @trpc/react-query @tanstack/react-query
   ```

3. **Move Shared Code**
   ```bash
   mv apps/electron/src/shared/types packages/types
   mv apps/electron/src/renderer/utils/indicators packages/indicators
   ```

4. **Create Database Schema**
   - Implement `apps/backend/src/db/schema.ts` (see Database Schema section)
   - Run `pnpm drizzle-kit push:pg` to create tables

5. **Implement Auth Router**
   - Create `apps/backend/src/routers/auth.ts`
   - Test registration/login flow
   - Integrate with frontend

### Weekly Milestones

- **Week 1:** Auth working, tRPC endpoints tested
- **Week 2:** Wallet CRUD, Binance integration
- **Week 3:** Order creation/cancellation functional
- **Week 4:** Real-time order updates via WebSocket
- **Week 5:** Setup detection migrated to backend
- **Week 6:** Kline sync service operational
- **Week 7:** AI trading bot framework
- **Week 8:** 24/7 bot monitoring positions
- **Week 9:** Frontend using tRPC for all data
- **Week 10:** Migration script, production deployment

---

## 🔗 References

### Documentation Links

- **tRPC:** https://trpc.io/docs
- **Fastify:** https://fastify.dev/docs
- **Drizzle ORM:** https://orm.drizzle.team/docs
- **Lucia Auth:** https://lucia-auth.com
- **TimescaleDB:** https://docs.timescale.com
- **Binance API:** https://binance-docs.github.io/apidocs
- **Binance SDK:** https://github.com/tiagosiebler/binance

### Internal Docs

- `/docs/IMPLEMENTATION_PLAN.md` - Frontend implementation history
- `/docs/STORAGE_GUIDE.md` - Current storage architecture
- `/docs/BINANCE_TYPE_ALIGNMENT.md` - Type system alignment
- `/src/shared/types/` - Current type definitions (to be moved)

---

**Document Version:** 1.0  
**Last Updated:** November 30, 2025  
**Status:** Ready for Implementation  
**Estimated Completion:** February 2026
