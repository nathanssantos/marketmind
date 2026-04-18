import { boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const userIndicators = pgTable(
  'user_indicators',
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    catalogType: varchar('catalog_type', { length: 64 }).notNull(),
    label: varchar({ length: 120 }).notNull(),
    params: text().notNull(),
    isCustom: boolean('is_custom').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_indicators_user_id_idx').on(t.userId),
  }),
);

export type UserIndicator = typeof userIndicators.$inferSelect;
export type NewUserIndicator = typeof userIndicators.$inferInsert;
