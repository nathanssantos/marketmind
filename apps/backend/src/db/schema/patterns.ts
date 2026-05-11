import { boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Per-user library of candle-pattern definitions. Built-ins are seeded on
 * first sign-in via `seedDefaultUserPatterns`; user-created patterns are
 * marked `is_custom: true` (only those can be deleted; built-ins can be
 * edited or hidden via UI toggle but not removed).
 *
 * `definition` stores the full PatternDefinition JSON (id/label/category/
 * sentiment/bars/params/constraints/description) so user-customized params
 * survive without a separate params column. Mirrors the user_indicators
 * pattern minus the catalog_type column — pattern semantics are
 * self-contained in `definition`.
 */
export const userPatterns = pgTable(
  'user_patterns',
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Stable id from PatternDefinition.id (e.g. 'hammer'). */
    patternId: varchar('pattern_id', { length: 64 }).notNull(),
    label: varchar({ length: 120 }).notNull(),
    /** JSON-encoded PatternDefinition. */
    definition: text().notNull(),
    isCustom: boolean('is_custom').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_patterns_user_id_idx').on(t.userId),
  }),
);

export type UserPattern = typeof userPatterns.$inferSelect;
export type NewUserPattern = typeof userPatterns.$inferInsert;
