import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

export const createUser = async (email: string, password: string) => {
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  const userId = generateId(21);

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

export const createSession = async (userId: string) => {
  const sessionId = generateId(40);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return { sessionId, expiresAt };
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
