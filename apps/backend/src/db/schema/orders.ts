import type { PositionSide, MarketType } from '@marketmind/types';
import {
  bigint,
  boolean,
  integer,
  numeric,
  pgTable,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { wallets } from './wallets';

export const orders = pgTable('orders', {
  orderId: varchar('order_id', { length: 40 }).primaryKey(),
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
  marketType: varchar('market_type', { length: 10 }).$type<MarketType>().default('FUTURES'),
  reduceOnly: boolean('reduce_only').default(false),
  stopLossIntent: numeric('stop_loss_intent', { precision: 20, scale: 8 }),
  takeProfitIntent: numeric('take_profit_intent', { precision: 20, scale: 8 }),
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
  side: varchar({ length: 10 }).$type<PositionSide>().notNull(),
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
  marketType: varchar('market_type', { length: 10 }).$type<MarketType>().default('FUTURES'),
  leverage: integer().default(1),
  marginType: varchar('margin_type', { length: 10 }).$type<'ISOLATED' | 'CROSSED'>(),
  liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
  accumulatedFunding: numeric('accumulated_funding', { precision: 20, scale: 8 }).default('0'),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
