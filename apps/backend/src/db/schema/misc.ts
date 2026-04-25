import type { MarketType } from '@marketmind/types';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const apiKeys = pgTable('api_keys', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar({ length: 50 }).notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userProviderUnique: unique().on(table.userId, table.provider),
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: varchar({ length: 50 }).notNull(),
  key: varchar({ length: 100 }).notNull(),
  value: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserCategoryKey: unique().on(table.userId, table.category, table.key),
  userIdCategoryIdx: index('user_preferences_user_id_category_idx').on(table.userId, table.category),
}));

export const indicatorHistory = pgTable('indicator_history', {
  id: serial('id').primaryKey(),
  indicatorType: varchar('indicator_type', { length: 50 }).notNull(),
  value: numeric({ precision: 20, scale: 8 }).notNull(),
  metadata: text(),
  recordedAt: timestamp('recorded_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  typeTimeIdx: index('indicator_history_type_time_idx').on(table.indicatorType, table.recordedAt),
  recordedAtIdx: index('indicator_history_recorded_at_idx').on(table.recordedAt),
}));

export const customSymbols = pgTable('custom_symbols', {
  id: serial('id').primaryKey(),
  symbol: varchar({ length: 30 }).unique().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  category: varchar({ length: 50 }).$type<'politics' | 'defi' | 'gaming' | 'ai' | 'other'>().notNull(),
  baseValue: numeric('base_value', { precision: 20, scale: 8 }).notNull().default('100'),
  weightingMethod: varchar('weighting_method', { length: 30 })
    .$type<'EQUAL' | 'MARKET_CAP' | 'CAPPED_MARKET_CAP' | 'SQRT_MARKET_CAP' | 'MANUAL'>()
    .notNull().default('CAPPED_MARKET_CAP'),
  capPercent: numeric('cap_percent', { precision: 5, scale: 2 }).default('40'),
  rebalanceIntervalDays: integer('rebalance_interval_days').default(30),
  lastRebalancedAt: timestamp('last_rebalanced_at', { mode: 'date' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const customSymbolComponents = pgTable('custom_symbol_components', {
  id: serial('id').primaryKey(),
  customSymbolId: integer('custom_symbol_id')
    .notNull()
    .references(() => customSymbols.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 20 }).notNull(),
  marketType: varchar('market_type', { length: 10 })
    .$type<MarketType>().default('SPOT').notNull(),
  coingeckoId: varchar('coingecko_id', { length: 100 }),
  weight: numeric({ precision: 10, scale: 8 }).notNull(),
  basePrice: numeric('base_price', { precision: 20, scale: 8 }),
  isActive: boolean('is_active').default(true).notNull(),
  addedAt: timestamp('added_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueComponent: unique().on(table.customSymbolId, table.symbol, table.marketType),
  customSymbolIdx: index('custom_symbol_components_idx').on(table.customSymbolId),
  activeIdx: index('custom_symbol_components_active_idx').on(table.customSymbolId, table.isActive),
}));

export const chartDrawings = pgTable('chart_drawings', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 50 }).notNull(),
  interval: varchar({ length: 10 }).default('1h').notNull(),
  type: varchar({ length: 20 }).notNull(),
  data: text().notNull(),
  visible: boolean().default(true).notNull(),
  locked: boolean().default(false).notNull(),
  zIndex: integer('z_index').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userSymbolIntervalIdx: index('chart_drawings_user_symbol_interval_idx').on(table.userId, table.symbol, table.interval),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

export type IndicatorHistory = typeof indicatorHistory.$inferSelect;
export type NewIndicatorHistory = typeof indicatorHistory.$inferInsert;

export type CustomSymbol = typeof customSymbols.$inferSelect;
export type NewCustomSymbol = typeof customSymbols.$inferInsert;
export type CustomSymbolComponent = typeof customSymbolComponents.$inferSelect;
export type NewCustomSymbolComponent = typeof customSymbolComponents.$inferInsert;

export type ChartDrawing = typeof chartDrawings.$inferSelect;
export type NewChartDrawing = typeof chartDrawings.$inferInsert;
