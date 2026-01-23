import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('Preferences Router', () => {
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
    it('should create a new preference', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.set({
        category: 'ui',
        key: 'theme',
        value: 'dark',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should update an existing preference', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({
        category: 'ui',
        key: 'theme',
        value: 'light',
      });

      await caller.preferences.set({
        category: 'ui',
        key: 'theme',
        value: 'dark',
      });

      const stored = await caller.preferences.get({ category: 'ui', key: 'theme' });
      expect(stored).toBe('dark');
    });

    it('should store complex JSON values', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const complexValue = {
        sidebar: { collapsed: true, width: 250 },
        panels: ['chart', 'orders', 'positions'],
        settings: { autoSave: true },
      };

      await caller.preferences.set({
        category: 'ui',
        key: 'layout',
        value: complexValue,
      });

      const stored = await caller.preferences.get({ category: 'ui', key: 'layout' });
      expect(stored).toEqual(complexValue);
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('get', () => {
    it('should return null for non-existing preference', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.get({ category: 'ui', key: 'nonexistent' });

      expect(result).toBeNull();
    });

    it('should return the stored value', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({
        category: 'trading',
        key: 'defaultQuantity',
        value: 100,
      });

      const result = await caller.preferences.get({ category: 'trading', key: 'defaultQuantity' });

      expect(result).toBe(100);
    });

    it('should not return preferences from another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.preferences.set({
        category: 'ui',
        key: 'theme',
        value: 'dark',
      });

      const result = await caller2.preferences.get({ category: 'ui', key: 'theme' });

      expect(result).toBeNull();
    });
  });

  describe('getByCategory', () => {
    it('should return empty object when no preferences exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.getByCategory({ category: 'ui' });

      expect(result).toEqual({});
    });

    it('should return all preferences for a category', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller.preferences.set({ category: 'ui', key: 'language', value: 'en' });
      await caller.preferences.set({ category: 'trading', key: 'quantity', value: 100 });

      const result = await caller.preferences.getByCategory({ category: 'ui' });

      expect(result).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });

    it('should only return preferences for the current user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller2.preferences.set({ category: 'ui', key: 'theme', value: 'light' });

      const result1 = await caller1.preferences.getByCategory({ category: 'ui' });
      const result2 = await caller2.preferences.getByCategory({ category: 'ui' });

      expect(result1.theme).toBe('dark');
      expect(result2.theme).toBe('light');
    });
  });

  describe('getAll', () => {
    it('should return empty object when no preferences exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.getAll();

      expect(result).toEqual({});
    });

    it('should return all preferences grouped by category', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller.preferences.set({ category: 'ui', key: 'language', value: 'en' });
      await caller.preferences.set({ category: 'trading', key: 'quantity', value: 100 });
      await caller.preferences.set({ category: 'chart', key: 'interval', value: '1h' });

      const result = await caller.preferences.getAll();

      expect(result).toEqual({
        ui: { theme: 'dark', language: 'en' },
        trading: { quantity: 100 },
        chart: { interval: '1h' },
      });
    });
  });

  describe('delete', () => {
    it('should delete an existing preference', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });

      const result = await caller.preferences.delete({ category: 'ui', key: 'theme' });

      expect(result.success).toBe(true);

      const stored = await caller.preferences.get({ category: 'ui', key: 'theme' });
      expect(stored).toBeNull();
    });

    it('should succeed even if preference does not exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.delete({ category: 'ui', key: 'nonexistent' });

      expect(result.success).toBe(true);
    });

    it('should not delete preferences from another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });

      await caller2.preferences.delete({ category: 'ui', key: 'theme' });

      const stored = await caller1.preferences.get({ category: 'ui', key: 'theme' });
      expect(stored).toBe('dark');
    });
  });

  describe('bulkSet', () => {
    it('should set multiple preferences at once', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.bulkSet({
        category: 'ui',
        preferences: {
          theme: 'dark',
          language: 'en',
          sidebar: { collapsed: false },
        },
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);

      const stored = await caller.preferences.getByCategory({ category: 'ui' });
      expect(stored).toEqual({
        theme: 'dark',
        language: 'en',
        sidebar: { collapsed: false },
      });
    });

    it('should update existing and create new preferences', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'light' });

      await caller.preferences.bulkSet({
        category: 'ui',
        preferences: {
          theme: 'dark',
          language: 'pt',
        },
      });

      const stored = await caller.preferences.getByCategory({ category: 'ui' });
      expect(stored.theme).toBe('dark');
      expect(stored.language).toBe('pt');
    });

    it('should return count 0 for empty preferences', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.preferences.bulkSet({
        category: 'ui',
        preferences: {},
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('deleteCategory', () => {
    it('should delete all preferences in a category', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller.preferences.set({ category: 'ui', key: 'language', value: 'en' });
      await caller.preferences.set({ category: 'trading', key: 'quantity', value: 100 });

      const result = await caller.preferences.deleteCategory({ category: 'ui' });

      expect(result.success).toBe(true);

      const uiPrefs = await caller.preferences.getByCategory({ category: 'ui' });
      const tradingPrefs = await caller.preferences.getByCategory({ category: 'trading' });

      expect(uiPrefs).toEqual({});
      expect(tradingPrefs).toEqual({ quantity: 100 });
    });

    it('should not delete other users preferences', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller2.preferences.set({ category: 'ui', key: 'theme', value: 'light' });

      await caller1.preferences.deleteCategory({ category: 'ui' });

      const result1 = await caller1.preferences.getByCategory({ category: 'ui' });
      const result2 = await caller2.preferences.getByCategory({ category: 'ui' });

      expect(result1).toEqual({});
      expect(result2).toEqual({ theme: 'light' });
    });
  });

  describe('clearAll', () => {
    it('should delete all preferences for the user', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller.preferences.set({ category: 'trading', key: 'quantity', value: 100 });
      await caller.preferences.set({ category: 'chart', key: 'interval', value: '1h' });

      const result = await caller.preferences.clearAll();

      expect(result.success).toBe(true);

      const allPrefs = await caller.preferences.getAll();
      expect(allPrefs).toEqual({});
    });

    it('should not delete other users preferences', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.preferences.set({ category: 'ui', key: 'theme', value: 'dark' });
      await caller2.preferences.set({ category: 'ui', key: 'theme', value: 'light' });

      await caller1.preferences.clearAll();

      const result1 = await caller1.preferences.getAll();
      const result2 = await caller2.preferences.getAll();

      expect(result1).toEqual({});
      expect(result2).toEqual({ ui: { theme: 'light' } });
    });
  });

  describe('category validation', () => {
    it('should reject invalid categories', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.preferences.set({
          category: 'invalid' as 'ui',
          key: 'test',
          value: 'value',
        })
      ).rejects.toThrow();
    });

    it('should accept all valid categories', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const categories = ['trading', 'ui', 'chart', 'notifications', 'recent'] as const;

      for (const category of categories) {
        const result = await caller.preferences.set({
          category,
          key: 'test',
          value: 'value',
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
