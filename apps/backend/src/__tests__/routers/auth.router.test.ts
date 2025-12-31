import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestCaller, createAuthenticatedCaller } from '../helpers/test-caller';
import { createTestUser, createTestSession } from '../helpers/test-fixtures';
import { createTestContext } from '../helpers/test-context';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';

describe('Auth Router Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      const result = await caller.auth.register({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.userId).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.expiresAt).toBeDefined();

      expect(ctx.res.setCookie).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
    });

    it('should reject registration with duplicate email', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await caller.auth.register({
        email: 'duplicate@example.com',
        password: 'Test123!@#',
      });

      await expect(
        caller.auth.register({
          email: 'duplicate@example.com',
          password: 'AnotherPass123!@#',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject registration with short password', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.auth.register({
          email: 'test@example.com',
          password: 'short',
        })
      ).rejects.toThrow();
    });

    it('should reject registration with invalid email', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.auth.register({
          email: 'invalid-email',
          password: 'Test123!@#',
        })
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      const { user, password } = await createTestUser({
        email: 'login@example.com',
        password: 'Test123!@#',
      });

      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      const result = await caller.auth.login({
        email: 'login@example.com',
        password,
      });

      expect(result.userId).toBe(user.id);
      expect(result.sessionId).toBeDefined();
      expect(result.expiresAt).toBeDefined();

      expect(ctx.res.setCookie).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
    });

    it('should reject login with wrong password', async () => {
      await createTestUser({
        email: 'wrongpass@example.com',
        password: 'CorrectPass123!@#',
      });

      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.auth.login({
          email: 'wrongpass@example.com',
          password: 'WrongPass123!@#',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject login for non-existent user', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.auth.login({
          email: 'nonexistent@example.com',
          password: 'AnyPass123!@#',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('me', () => {
    it('should return user data when authenticated', async () => {
      const { user } = await createTestUser({
        email: 'me@example.com',
      });
      const session = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
      expect(result?.email).toBe(user.email);
    });

    it('should return null when not authenticated', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should logout authenticated user', async () => {
      const { user } = await createTestUser();
      const session = await createTestSession({ userId: user.id });

      const ctx = createTestContext({
        user,
        session,
        sessionId: session.id,
      });
      const caller = createTestCaller(ctx);

      const result = await caller.auth.logout();

      expect(result.success).toBe(true);
      expect(ctx.res.clearCookie).toHaveBeenCalledWith('session', { path: '/' });

      const db = getTestDatabase();
      const [deletedSession] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, session.id))
        .limit(1);

      expect(deletedSession).toBeUndefined();
    });

    it('should throw error when not authenticated', async () => {
      const ctx = createTestContext();
      const caller = createTestCaller(ctx);

      await expect(caller.auth.logout()).rejects.toThrow(TRPCError);
    });
  });

  describe('session validation', () => {
    it('should invalidate expired sessions', async () => {
      const { user } = await createTestUser();
      const expiredSession = await createTestSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const ctx = createTestContext({
        sessionId: expiredSession.id,
      });
      const caller = createTestCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });
});
