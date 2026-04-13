import {
  boolean,
  pgTable,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar({ length: 255 }).primaryKey(),
  email: varchar({ length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar({ length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  used: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  used: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const twoFactorCodes = pgTable('two_factor_codes', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: varchar({ length: 6 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  used: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type TwoFactorCode = typeof twoFactorCodes.$inferSelect;
