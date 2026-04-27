import { hash, verify } from '@node-rs/argon2';
import { TIME_MS } from '@marketmind/types';
import { and, eq, lt, ne } from 'drizzle-orm';
import { db } from '../db/client';
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  twoFactorCodes,
  users,
} from '../db/schema';
import { generateEntityId, generateId, generateSessionId } from '../utils/id';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export const AUTH_EXPIRY = {
  SESSION_SHORT: TIME_MS.DAY,
  SESSION_LONG: 30 * TIME_MS.DAY,
  PASSWORD_RESET_TOKEN: TIME_MS.HOUR,
  EMAIL_VERIFICATION_TOKEN: TIME_MS.DAY,
  TWO_FACTOR_CODE: 10 * TIME_MS.MINUTE,
} as const;

export const createUser = async (email: string, password: string) => {
  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const userId = generateEntityId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
  });

  return userId;
};

export const verifyPassword = async (userId: string, password: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;
  return await verify(user.passwordHash, password);
};

export interface SessionMetadata {
  userAgent?: string | null;
  ip?: string | null;
}

export const createSession = async (
  userId: string,
  rememberMe = true,
  metadata: SessionMetadata = {}
) => {
  const sessionId = generateSessionId();
  const duration = rememberMe ? AUTH_EXPIRY.SESSION_LONG : AUTH_EXPIRY.SESSION_SHORT;
  const expiresAt = new Date(Date.now() + duration);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    userAgent: metadata.userAgent ?? null,
    ip: metadata.ip ?? null,
  });

  return { sessionId, expiresAt };
};

export const listUserSessions = async (userId: string) => {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const invalidateOtherUserSessions = async (userId: string, keepSessionId: string) => {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
};

export const validateSession = async (sessionId: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) return null;

  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;

  return { session, user };
};

export const invalidateSession = async (sessionId: string) => {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
};

export const invalidateAllUserSessions = async (userId: string) => {
  await db.delete(sessions).where(eq(sessions.userId, userId));
};

export const createPasswordResetToken = async (userId: string) => {
  const token = generateId(64);
  const expiresAt = new Date(Date.now() + AUTH_EXPIRY.PASSWORD_RESET_TOKEN);

  await db.insert(passwordResetTokens).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
};

export const validatePasswordResetToken = async (token: string) => {
  const [entry] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.id, token))
    .limit(1);

  if (!entry || entry.used || Date.now() >= entry.expiresAt.getTime()) return null;

  return { userId: entry.userId };
};

export const consumePasswordResetToken = async (token: string) => {
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.id, token));
};

export const updateUserPassword = async (userId: string, newPassword: string) => {
  const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const createEmailVerificationToken = async (userId: string) => {
  const token = generateId(64);
  const expiresAt = new Date(Date.now() + AUTH_EXPIRY.EMAIL_VERIFICATION_TOKEN);

  await db.insert(emailVerificationTokens).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
};

export const verifyEmailToken = async (token: string) => {
  const [entry] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, token))
    .limit(1);

  if (!entry || entry.used || Date.now() >= entry.expiresAt.getTime()) return null;

  await db
    .update(emailVerificationTokens)
    .set({ used: true })
    .where(eq(emailVerificationTokens.id, token));

  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, entry.userId));

  return { userId: entry.userId };
};

export const createTwoFactorCode = async (userId: string) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = generateEntityId();
  const expiresAt = new Date(Date.now() + AUTH_EXPIRY.TWO_FACTOR_CODE);

  await db.insert(twoFactorCodes).values({
    id,
    userId,
    code,
    expiresAt,
  });

  return code;
};

export const validateTwoFactorCode = async (userId: string, code: string) => {
  const [entry] = await db
    .select()
    .from(twoFactorCodes)
    .where(
      and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.code, code),
        eq(twoFactorCodes.used, false),
      )
    )
    .limit(1);

  if (!entry || Date.now() >= entry.expiresAt.getTime()) return false;

  await db
    .update(twoFactorCodes)
    .set({ used: true })
    .where(eq(twoFactorCodes.id, entry.id));

  return true;
};

export const toggleTwoFactor = async (userId: string, enabled: boolean) => {
  await db
    .update(users)
    .set({ twoFactorEnabled: enabled, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const AVATAR_LIMITS = {
  MAX_DATA_BYTES: 700_000,
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
} as const;

export const setUserAvatar = async (
  userId: string,
  data: string,
  mimeType: string
) => {
  await db
    .update(users)
    .set({ avatarData: data, avatarMimeType: mimeType, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const clearUserAvatar = async (userId: string) => {
  await db
    .update(users)
    .set({ avatarData: null, avatarMimeType: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const getUserAvatar = async (userId: string) => {
  const [row] = await db
    .select({ data: users.avatarData, mimeType: users.avatarMimeType })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.data || !row?.mimeType) return null;
  return { data: row.data, mimeType: row.mimeType };
};

export const setUserAvatarColor = async (userId: string, color: string | null) => {
  await db
    .update(users)
    .set({ avatarColor: color, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const cleanupExpiredTokensAndSessions = async () => {
  const now = new Date();

  await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
    db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now)),
    db.delete(emailVerificationTokens).where(lt(emailVerificationTokens.expiresAt, now)),
    db.delete(twoFactorCodes).where(lt(twoFactorCodes.expiresAt, now)),
  ]);
};
