import type { MarketType } from '@marketmind/types';
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core';

export const klines = pgTable(
  'klines',
  {
    symbol: varchar({ length: 20 }).notNull(),
    interval: varchar({ length: 5 }).notNull(),
    marketType: varchar('market_type', { length: 10 }).$type<MarketType>().default('FUTURES').notNull(),
    openTime: timestamp('open_time', { mode: 'date' }).notNull(),
    closeTime: timestamp('close_time', { mode: 'date' }).notNull(),
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
    pk: primaryKey({ columns: [table.symbol, table.interval, table.marketType, table.openTime] }),
    klinesLookupIdx: index('klines_lookup_idx').on(
      table.symbol, table.interval, table.marketType, table.openTime
    ),
  })
);

export const pairMaintenanceLog = pgTable('pair_maintenance_log', {
  id: serial().primaryKey(),
  symbol: text().notNull(),
  interval: text().notNull(),
  marketType: text('market_type').notNull(),
  lastGapCheck: timestamp('last_gap_check', { mode: 'date' }),
  lastCorruptionCheck: timestamp('last_corruption_check', { mode: 'date' }),
  gapsFound: integer('gaps_found').default(0),
  corruptedFixed: integer('corrupted_fixed').default(0),
  earliestKlineDate: timestamp('earliest_kline_date', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniquePair: unique().on(table.symbol, table.interval, table.marketType),
  lookupIdx: index('idx_pair_maintenance_lookup').on(table.symbol, table.interval, table.marketType),
  gapCheckIdx: index('idx_last_gap_check').on(table.lastGapCheck),
  corruptionCheckIdx: index('idx_last_corruption_check').on(table.lastCorruptionCheck),
}));

export const aggTrades = pgTable('agg_trades', {
  symbol: varchar({ length: 20 }).notNull(),
  tradeId: bigint('trade_id', { mode: 'number' }).notNull(),
  price: numeric({ precision: 20, scale: 8 }).notNull(),
  quantity: numeric({ precision: 20, scale: 8 }).notNull(),
  quoteQuantity: numeric('quote_quantity', { precision: 20, scale: 8 }).notNull(),
  isBuyerMaker: boolean('is_buyer_maker').notNull(),
  marketType: varchar('market_type', { length: 10 }).notNull().default('FUTURES').$type<'FUTURES' | 'SPOT'>(),
  timestamp: timestamp({ mode: 'date' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.symbol, table.tradeId, table.marketType, table.timestamp] }),
  lookupIdx: index('agg_trades_lookup_idx').on(table.symbol, table.marketType, table.timestamp),
}));

export const priceCache = pgTable('price_cache', {
  symbol: varchar({ length: 20 }).primaryKey(),
  price: numeric({ precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp({ mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index('price_cache_timestamp_idx').on(table.timestamp),
}));

export type Kline = typeof klines.$inferSelect;
export type NewKline = typeof klines.$inferInsert;

export type PairMaintenanceLog = typeof pairMaintenanceLog.$inferSelect;
export type NewPairMaintenanceLog = typeof pairMaintenanceLog.$inferInsert;

export type AggTradeRecord = typeof aggTrades.$inferSelect;
export type NewAggTradeRecord = typeof aggTrades.$inferInsert;

export type PriceCache = typeof priceCache.$inferSelect;
export type NewPriceCache = typeof priceCache.$inferInsert;
