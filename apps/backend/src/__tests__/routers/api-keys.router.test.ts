import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('API Keys Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('set', () => {
    it('should create a new API key', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.apiKey.set({
        provider: 'openai',
        key: 'sk-test-key-12345',
      });

      expect(result.success).toBe(true);

      const stored = await caller.apiKey.get({ provider: 'openai' });
      expect(stored.key).toBe('sk-test-key-12345');
    });

    it('should update an existing API key', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({
        provider: 'anthropic',
        key: 'sk-ant-old-key',
      });

      await caller.apiKey.set({
        provider: 'anthropic',
        key: 'sk-ant-new-key',
      });

      const stored = await caller.apiKey.get({ provider: 'anthropic' });
      expect(stored.key).toBe('sk-ant-new-key');
    });

    it('should store keys for different providers independently', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({ provider: 'openai', key: 'openai-key' });
      await caller.apiKey.set({ provider: 'anthropic', key: 'anthropic-key' });
      await caller.apiKey.set({ provider: 'gemini', key: 'gemini-key' });

      expect((await caller.apiKey.get({ provider: 'openai' })).key).toBe('openai-key');
      expect((await caller.apiKey.get({ provider: 'anthropic' })).key).toBe('anthropic-key');
      expect((await caller.apiKey.get({ provider: 'gemini' })).key).toBe('gemini-key');
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.apiKey.set({ provider: 'openai', key: 'test-key' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('get', () => {
    it('should return null for non-existing key', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.apiKey.get({ provider: 'openai' });

      expect(result.key).toBeNull();
    });

    it('should return decrypted key', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({ provider: 'gemini', key: 'gemini-secret-key' });

      const result = await caller.apiKey.get({ provider: 'gemini' });

      expect(result.key).toBe('gemini-secret-key');
    });

    it('should not return keys from another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.apiKey.set({ provider: 'openai', key: 'user1-secret-key' });

      const result = await caller2.apiKey.get({ provider: 'openai' });

      expect(result.key).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing key', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({ provider: 'openai', key: 'to-be-deleted' });

      const result = await caller.apiKey.delete({ provider: 'openai' });

      expect(result.success).toBe(true);

      const stored = await caller.apiKey.get({ provider: 'openai' });
      expect(stored.key).toBeNull();
    });

    it('should succeed even if key does not exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.apiKey.delete({ provider: 'anthropic' });

      expect(result.success).toBe(true);
    });

    it('should not delete keys from another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.apiKey.set({ provider: 'openai', key: 'user1-key' });

      await caller2.apiKey.delete({ provider: 'openai' });

      const stored = await caller1.apiKey.get({ provider: 'openai' });
      expect(stored.key).toBe('user1-key');
    });
  });

  describe('list', () => {
    it('should return all providers as false when no keys configured', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.apiKey.list();

      expect(result.openai).toBe(false);
      expect(result.anthropic).toBe(false);
      expect(result.gemini).toBe(false);
    });

    it('should return true for configured providers', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({ provider: 'openai', key: 'key1' });
      await caller.apiKey.set({ provider: 'gemini', key: 'key2' });

      const result = await caller.apiKey.list();

      expect(result.openai).toBe(true);
      expect(result.anthropic).toBe(false);
      expect(result.gemini).toBe(true);
    });

    it('should only list keys belonging to the user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.apiKey.set({ provider: 'openai', key: 'user1-key' });
      await caller2.apiKey.set({ provider: 'anthropic', key: 'user2-key' });

      const result1 = await caller1.apiKey.list();
      const result2 = await caller2.apiKey.list();

      expect(result1.openai).toBe(true);
      expect(result1.anthropic).toBe(false);

      expect(result2.openai).toBe(false);
      expect(result2.anthropic).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should delete all keys for the user', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.apiKey.set({ provider: 'openai', key: 'key1' });
      await caller.apiKey.set({ provider: 'anthropic', key: 'key2' });
      await caller.apiKey.set({ provider: 'gemini', key: 'key3' });

      const result = await caller.apiKey.clearAll();

      expect(result.success).toBe(true);

      const list = await caller.apiKey.list();
      expect(list.openai).toBe(false);
      expect(list.anthropic).toBe(false);
      expect(list.gemini).toBe(false);
    });

    it('should not delete keys from other users', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.apiKey.set({ provider: 'openai', key: 'user1-key' });
      await caller2.apiKey.set({ provider: 'openai', key: 'user2-key' });

      await caller1.apiKey.clearAll();

      const list1 = await caller1.apiKey.list();
      const list2 = await caller2.apiKey.list();

      expect(list1.openai).toBe(false);
      expect(list2.openai).toBe(true);
    });
  });
});
