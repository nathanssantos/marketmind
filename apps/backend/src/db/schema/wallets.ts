import type { MarketType } from '@marketmind/types';
import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { DEFAULT_CURRENCY } from '@marketmind/types';
import { users } from './auth';

export const wallets = pgTable('wallets', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 255 }).notNull(),
  walletType: varchar('wallet_type', { length: 20 }).default('paper').$type<'live' | 'testnet' | 'paper'>(),
  marketType: varchar('market_type', { length: 10 }).$type<MarketType>().default('FUTURES'),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiSecretEncrypted: text('api_secret_encrypted').notNull(),
  initialBalance: numeric('initial_balance', { precision: 20, scale: 8 }),
  currentBalance: numeric('current_balance', { precision: 20, scale: 8 }),
  totalWalletBalance: numeric('total_wallet_balance', { precision: 20, scale: 8 }),
  totalDeposits: numeric('total_deposits', { precision: 20, scale: 8 }).default('0'),
  totalWithdrawals: numeric('total_withdrawals', { precision: 20, scale: 8 }).default('0'),
  lastTransferSyncAt: timestamp('last_transfer_sync_at', { mode: 'date' }),
  currency: varchar({ length: 10 }).default(DEFAULT_CURRENCY),
  exchange: varchar({ length: 20 }).default('BINANCE'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
