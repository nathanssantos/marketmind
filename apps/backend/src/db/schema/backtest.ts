import { index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Persisted backtest runs. The `routers/backtest/shared.ts` in-memory
 * cache holds RUNNING + recent COMPLETED/FAILED entries; this table
 * holds the long-term history so RecentRunsPanel survives a server
 * restart. Retention enforced on insert (90 days, V1_5 E.8).
 *
 * `id` is the same `generateEntityId()` value used in the cache so
 * `getResult` can fall through cache → DB without translation.
 */
export const backtestRuns = pgTable(
  'backtest_runs',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    config: text('config').notNull(),
    metrics: text('metrics'),
    equityCurve: text('equity_curve'),
    tradesJson: text('trades_json'),
    error: text('error'),
    startTime: timestamp('start_time', { mode: 'date' }).notNull(),
    endTime: timestamp('end_time', { mode: 'date' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index('backtest_runs_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export type BacktestRunRow = typeof backtestRuns.$inferSelect;
export type NewBacktestRunRow = typeof backtestRuns.$inferInsert;
