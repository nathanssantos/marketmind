import {
  boolean,
  index,
  pgTable,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { wallets } from './wallets';
import { tradingProfiles } from './trading';

export const activeWatchers = pgTable('active_watchers', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  profileId: varchar('profile_id', { length: 255 })
    .references(() => tradingProfiles.id, { onDelete: 'set null' }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('FUTURES').notNull(),
  exchange: varchar({ length: 20 }).default('BINANCE'),
  isManual: boolean('is_manual').default(true).notNull(),
  startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  walletIdIdx: index('active_watchers_wallet_id_idx').on(table.walletId),
  userIdIdx: index('active_watchers_user_id_idx').on(table.userId),
  profileIdIdx: index('active_watchers_profile_id_idx').on(table.profileId),
  marketTypeIdx: index('active_watchers_market_type_idx').on(table.marketType),
  isManualIdx: index('active_watchers_is_manual_idx').on(table.isManual),
}));

export type ActiveWatcherRow = typeof activeWatchers.$inferSelect;
export type NewActiveWatcherRow = typeof activeWatchers.$inferInsert;
