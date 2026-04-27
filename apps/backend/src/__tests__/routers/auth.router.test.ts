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

  describe('updateProfile', () => {
    it('updates display name', async () => {
      const { user } = await createTestUser({ email: 'name@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.auth.updateProfile({ name: 'New Name' });

      const db = getTestDatabase();
      const [updated] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
      expect(updated?.name).toBe('New Name');
    });

    it('updates avatar color when valid hex', async () => {
      const { user } = await createTestUser({ email: 'color@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.auth.updateProfile({ avatarColor: '#10B981' });

      const db = getTestDatabase();
      const [updated] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
      expect(updated?.avatarColor).toBe('#10B981');
    });

    it('rejects invalid avatar color (not 6-digit hex)', async () => {
      const { user } = await createTestUser({ email: 'invalidcolor@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.auth.updateProfile({ avatarColor: 'red' })).rejects.toThrow();
    });

    it('clears avatar color when null', async () => {
      const { user } = await createTestUser({ email: 'clearcolor@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.auth.updateProfile({ avatarColor: '#3B82F6' });
      await caller.auth.updateProfile({ avatarColor: null });

      const db = getTestDatabase();
      const [updated] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
      expect(updated?.avatarColor).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('changes password when current is correct', async () => {
      const { user, password } = await createTestUser({ email: 'cp@example.com', password: 'OldPass123!@#' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.auth.changePassword({ currentPassword: password, newPassword: 'NewPass456!@#' });

      expect(result.success).toBe(true);

      const ctx2 = createTestContext();
      const caller2 = createTestCaller(ctx2);
      const login = await caller2.auth.login({ email: 'cp@example.com', password: 'NewPass456!@#' });
      expect(login.userId).toBe(user.id);
    });

    it('rejects when current password is wrong', async () => {
      const { user } = await createTestUser({ email: 'wrongpwd@example.com', password: 'CorrectPass123!@#' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.auth.changePassword({ currentPassword: 'WrongPass', newPassword: 'NewPass456!@#' })
      ).rejects.toThrow(TRPCError);
    });

    it('rejects when new password is too short', async () => {
      const { user, password } = await createTestUser({ email: 'shortpwd@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.auth.changePassword({ currentPassword: password, newPassword: 'short' })
      ).rejects.toThrow();
    });

    it('invalidates other sessions but keeps current', async () => {
      const { user, password } = await createTestUser({ email: 'sess@example.com' });
      const currentSession = await createTestSession({ userId: user.id });
      const otherSession = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, currentSession);
      await caller.auth.changePassword({ currentPassword: password, newPassword: 'NewPass456!@#' });

      const db = getTestDatabase();
      const [stillCurrent] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, currentSession.id)).limit(1);
      const [stillOther] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, otherSession.id)).limit(1);

      expect(stillCurrent).toBeDefined();
      expect(stillOther).toBeUndefined();
    });
  });

  describe('uploadAvatar / getAvatar / deleteAvatar', () => {
    const validBase64 = Buffer.from('fake-image-bytes').toString('base64');

    it('uploads, retrieves, and deletes an avatar', async () => {
      const { user } = await createTestUser({ email: 'avatar@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.auth.uploadAvatar({ data: validBase64, mimeType: 'image/png' });

      const me = await caller.auth.me();
      expect(me?.hasAvatar).toBe(true);

      const avatar = await caller.auth.getAvatar();
      expect(avatar?.data).toBe(validBase64);
      expect(avatar?.mimeType).toBe('image/png');

      await caller.auth.deleteAvatar();
      const meAfter = await caller.auth.me();
      expect(meAfter?.hasAvatar).toBe(false);
    });

    it('rejects unsupported mime types', async () => {
      const { user } = await createTestUser({ email: 'badmime@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.auth.uploadAvatar({ data: validBase64, mimeType: 'image/svg+xml' })
      ).rejects.toThrow(TRPCError);
    });

    it('rejects payloads exceeding the size cap', async () => {
      const { user } = await createTestUser({ email: 'toolarge@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const oversized = 'a'.repeat(700_001);
      await expect(
        caller.auth.uploadAvatar({ data: oversized, mimeType: 'image/png' })
      ).rejects.toThrow(TRPCError);
    });

    it('returns null from getAvatar when no avatar set', async () => {
      const { user } = await createTestUser({ email: 'noavatar@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.auth.getAvatar();
      expect(result).toBeNull();
    });
  });

  describe('listSessions / revokeSession / revokeAllOtherSessions', () => {
    it('lists user sessions including a current marker', async () => {
      const { user } = await createTestUser({ email: 'list@example.com' });
      const current = await createTestSession({ userId: user.id });
      const other = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, current);
      const sessions = await caller.auth.listSessions();

      expect(sessions).toHaveLength(2);
      const c = sessions.find((s) => s.id === current.id);
      const o = sessions.find((s) => s.id === other.id);
      expect(c?.isCurrent).toBe(true);
      expect(o?.isCurrent).toBe(false);
    });

    it('revokes a non-current session belonging to the user', async () => {
      const { user } = await createTestUser({ email: 'rev@example.com' });
      const current = await createTestSession({ userId: user.id });
      const other = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, current);
      const result = await caller.auth.revokeSession({ sessionId: other.id });
      expect(result.success).toBe(true);

      const db = getTestDatabase();
      const [stillThere] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, other.id)).limit(1);
      expect(stillThere).toBeUndefined();
    });

    it('refuses to revoke the current session via revokeSession', async () => {
      const { user } = await createTestUser({ email: 'refuse@example.com' });
      const current = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, current);
      await expect(caller.auth.revokeSession({ sessionId: current.id })).rejects.toThrow(TRPCError);
    });

    it('does not revoke sessions belonging to other users', async () => {
      const { user: userA } = await createTestUser({ email: 'a@example.com' });
      const { user: userB } = await createTestUser({ email: 'b@example.com' });
      const sessionA = await createTestSession({ userId: userA.id });
      const sessionB = await createTestSession({ userId: userB.id });

      const callerA = createAuthenticatedCaller(userA, sessionA);
      const result = await callerA.auth.revokeSession({ sessionId: sessionB.id });
      expect(result.success).toBe(true);

      const db = getTestDatabase();
      const [bSession] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionB.id)).limit(1);
      expect(bSession).toBeDefined();
    });

    it('revokes every session except the current one', async () => {
      const { user } = await createTestUser({ email: 'all@example.com' });
      const current = await createTestSession({ userId: user.id });
      const other1 = await createTestSession({ userId: user.id });
      const other2 = await createTestSession({ userId: user.id });

      const caller = createAuthenticatedCaller(user, current);
      const result = await caller.auth.revokeAllOtherSessions();
      expect(result.success).toBe(true);

      const remaining = await caller.auth.listSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(current.id);

      const db = getTestDatabase();
      const [r1] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, other1.id)).limit(1);
      const [r2] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, other2.id)).limit(1);
      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
    });
  });

  describe('me with avatar/color', () => {
    it('returns hasAvatar=true and avatarColor in the me payload', async () => {
      const { user } = await createTestUser({ email: 'mefull@example.com' });
      const session = await createTestSession({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.auth.updateProfile({ avatarColor: '#10B981' });
      await caller.auth.uploadAvatar({ data: 'AAAA', mimeType: 'image/png' });

      const me = await caller.auth.me();
      expect(me?.avatarColor).toBe('#10B981');
      expect(me?.hasAvatar).toBe(true);
    });
  });
});
