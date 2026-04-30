import { index, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const userLayouts = pgTable('user_layouts', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  data: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const userLayoutsHistory = pgTable(
  'user_layouts_history',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: text().notNull(),
    snapshotAt: timestamp('snapshot_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userSnapshotIdx: index('user_layouts_history_user_snapshot_idx').on(t.userId, t.snapshotAt),
  }),
);

export type UserLayout = typeof userLayouts.$inferSelect;
export type NewUserLayout = typeof userLayouts.$inferInsert;
export type UserLayoutHistory = typeof userLayoutsHistory.$inferSelect;
export type NewUserLayoutHistory = typeof userLayoutsHistory.$inferInsert;
