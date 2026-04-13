import {
  boolean,
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { wallets } from './wallets';
import { orders } from './orders';
import { tradeExecutions } from './trading';

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
  orderId: varchar('order_id', { length: 40 }).references(() => orders.orderId),
  status: varchar({ length: 20 }).default('pending'),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const setupDetections = pgTable('setup_detections', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  setupType: varchar('setup_type', { length: 100 }).notNull(),
  direction: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  confidence: integer().notNull(),
  riskReward: numeric('risk_reward', { precision: 10, scale: 2 }),
  metadata: text(),
  detectedAt: timestamp('detected_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  viewed: boolean().default(false),
  notified: boolean().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('setup_detections_user_id_idx').on(table.userId),
  symbolIntervalIdx: index('setup_detections_symbol_interval_idx').on(table.symbol, table.interval),
  setupTypeIdx: index('setup_detections_setup_type_idx').on(table.setupType),
  detectedAtIdx: index('setup_detections_detected_at_idx').on(table.detectedAt),
  expiresAtIdx: index('setup_detections_expires_at_idx').on(table.expiresAt),
}));

export const signalSuggestions = pgTable('signal_suggestions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  watcherId: varchar('watcher_id', { length: 255 }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  side: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  setupType: varchar('setup_type', { length: 100 }).notNull(),
  strategyId: varchar('strategy_id', { length: 100 }),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  riskRewardRatio: numeric('risk_reward_ratio', { precision: 6, scale: 2 }),
  confidence: integer(),
  fibonacciProjection: text('fibonacci_projection'),
  triggerKlineOpenTime: bigint('trigger_kline_open_time', { mode: 'number' }),
  status: varchar({ length: 20 }).$type<'pending' | 'accepted' | 'rejected' | 'expired'>().default('pending').notNull(),
  positionSizePercent: numeric('position_size_percent', { precision: 5, scale: 2 }),
  tradeExecutionId: varchar('trade_execution_id', { length: 255 })
    .references(() => tradeExecutions.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('signal_suggestions_user_id_idx').on(table.userId),
  walletIdIdx: index('signal_suggestions_wallet_id_idx').on(table.walletId),
  statusIdx: index('signal_suggestions_status_idx').on(table.status),
}));

export type TradingSetup = typeof tradingSetups.$inferSelect;
export type NewTradingSetup = typeof tradingSetups.$inferInsert;

export type SetupDetection = typeof setupDetections.$inferSelect;
export type NewSetupDetection = typeof setupDetections.$inferInsert;

export type SignalSuggestionRow = typeof signalSuggestions.$inferSelect;
export type NewSignalSuggestionRow = typeof signalSuggestions.$inferInsert;
