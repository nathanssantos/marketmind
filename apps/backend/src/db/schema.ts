import {
    bigint,
    boolean,
    integer,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar({ length: 255 }).primaryKey(),
  email: varchar({ length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const wallets = pgTable('wallets', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 255 }).notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiSecretEncrypted: text('api_secret_encrypted').notNull(),
  initialBalance: numeric('initial_balance', { precision: 20, scale: 8 }),
  currentBalance: numeric('current_balance', { precision: 20, scale: 8 }),
  currency: varchar({ length: 10 }).default('USDT'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  orderId: bigint('order_id', { mode: 'number' }).primaryKey(),
  symbol: varchar({ length: 20 }).notNull(),
  side: varchar({ length: 10 }).$type<'BUY' | 'SELL'>().notNull(),
  type: varchar({ length: 30 }).notNull(),
  price: varchar({ length: 50 }),
  origQty: varchar('orig_qty', { length: 50 }),
  executedQty: varchar('executed_qty', { length: 50 }),
  status: varchar({ length: 30 }).notNull(),
  timeInForce: varchar('time_in_force', { length: 10 }),
  time: bigint({ mode: 'number' }),
  updateTime: bigint('update_time', { mode: 'number' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  setupId: varchar('setup_id', { length: 255 }),
  setupType: varchar('setup_type', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const positions = pgTable('positions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  symbol: varchar({ length: 20 }).notNull(),
  side: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  entryQty: numeric('entry_qty', { precision: 20, scale: 8 }).notNull(),
  currentPrice: numeric('current_price', { precision: 20, scale: 8 }),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  status: varchar({ length: 20 }).default('open'),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  setupId: varchar('setup_id', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const klines = pgTable(
  'klines',
  {
    symbol: varchar({ length: 20 }).notNull(),
    interval: varchar({ length: 5 }).notNull(),
    openTime: timestamp('open_time', { mode: 'date' }).notNull(),
    open: numeric({ precision: 20, scale: 8 }).notNull(),
    high: numeric({ precision: 20, scale: 8 }).notNull(),
    low: numeric({ precision: 20, scale: 8 }).notNull(),
    close: numeric({ precision: 20, scale: 8 }).notNull(),
    volume: numeric({ precision: 20, scale: 8 }).notNull(),
    quoteVolume: numeric('quote_volume', { precision: 20, scale: 8 }),
    trades: integer(),
    takerBuyBaseVolume: numeric('taker_buy_base_volume', { precision: 20, scale: 8 }),
    takerBuyQuoteVolume: numeric('taker_buy_quote_volume', { precision: 20, scale: 8 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.symbol, table.interval, table.openTime] }),
  })
);

export const tradingSetups = pgTable('trading_setups', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  type: varchar({ length: 100 }).notNull(),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  direction: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }).notNull(),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }).notNull(),
  confidence: integer().notNull(),
  detectedAt: timestamp('detected_at', { mode: 'date' }).defaultNow().notNull(),
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  status: varchar({ length: 20 }).default('pending'),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const aiConversations = pgTable('ai_conversations', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  provider: varchar({ length: 50 }).notNull(),
  model: varchar({ length: 100 }).notNull(),
  messages: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const aiTrades = pgTable('ai_trades', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  symbol: varchar({ length: 20 }).notNull(),
  action: varchar({ length: 10 }).$type<'BUY' | 'SELL' | 'HOLD'>().notNull(),
  reasoning: text().notNull(),
  confidence: integer().notNull(),
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  status: varchar({ length: 20 }).default('pending'),
  pnl: numeric({ precision: 20, scale: 8 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;

export type Kline = typeof klines.$inferSelect;
export type NewKline = typeof klines.$inferInsert;

export type TradingSetup = typeof tradingSetups.$inferSelect;
export type NewTradingSetup = typeof tradingSetups.$inferInsert;

export type AIConversation = typeof aiConversations.$inferSelect;
export type NewAIConversation = typeof aiConversations.$inferInsert;

export type AITrade = typeof aiTrades.$inferSelect;
export type NewAITrade = typeof aiTrades.$inferInsert;
