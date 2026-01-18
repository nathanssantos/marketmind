import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

vi.mock('../../services/binance-kline-stream', () => ({
  binanceKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
  binanceFuturesKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../services/kline-prefetch', () => ({
  checkKlineAvailability: vi.fn().mockResolvedValue({
    hasSufficient: true,
    totalAvailable: 5000,
    required: 4500,
    apiExhausted: false,
  }),
  prefetchKlines: vi.fn().mockResolvedValue({
    success: true,
    downloaded: 0,
    totalInDb: 5000,
    gaps: 0,
    alreadyComplete: true,
  }),
  prefetchKlinesAsync: vi.fn(),
}));

describe('Trading Profiles Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('list', () => {
    it('should return empty array when user has no profiles', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.tradingProfiles.list();

      expect(result).toEqual([]);
    });

    it('should return only profiles belonging to the user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.tradingProfiles.create({
        name: 'User1 Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });
      await caller2.tradingProfiles.create({
        name: 'User2 Profile',
        enabledSetupTypes: ['larry-williams-9-2'],
      });

      const result1 = await caller1.tradingProfiles.list();
      const result2 = await caller2.tradingProfiles.list();

      expect(result1).toHaveLength(1);
      expect(result1[0]?.name).toBe('User1 Profile');

      expect(result2).toHaveLength(1);
      expect(result2[0]?.name).toBe('User2 Profile');
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.tradingProfiles.list()).rejects.toThrow(TRPCError);
    });
  });

  describe('get', () => {
    it('should return profile when it belongs to user', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const result = await caller.tradingProfiles.get({ id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Test Profile');
      expect(result.enabledSetupTypes).toEqual(['larry-williams-9-1']);
    });

    it('should throw NOT_FOUND when profile belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const profile = await caller1.tradingProfiles.create({
        name: 'User1 Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await expect(caller2.tradingProfiles.get({ id: profile.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND for non-existent profile', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.tradingProfiles.get({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('create', () => {
    it('should create a profile with required fields', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1', 'larry-williams-9-2'],
      });

      expect(result.name).toBe('Test Profile');
      expect(result.enabledSetupTypes).toEqual(['larry-williams-9-1', 'larry-williams-9-2']);
      expect(result.isDefault).toBe(false);
      expect(result.maxPositionSize).toBeNull();
      expect(result.maxConcurrentPositions).toBeNull();
    });

    it('should create a profile with all optional fields', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.tradingProfiles.create({
        name: 'Full Profile',
        description: 'A complete profile',
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: 15,
        maxConcurrentPositions: 5,
        isDefault: true,
      });

      expect(result.name).toBe('Full Profile');
      expect(result.description).toBe('A complete profile');
      expect(result.enabledSetupTypes).toEqual(['larry-williams-9-1']);
      expect(result.maxPositionSize).toBe(15);
      expect(result.maxConcurrentPositions).toBe(5);
      expect(result.isDefault).toBe(true);
    });

    it('should unset previous default when creating new default profile', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const first = await caller.tradingProfiles.create({
        name: 'First Default',
        enabledSetupTypes: ['larry-williams-9-1'],
        isDefault: true,
      });

      expect(first.isDefault).toBe(true);

      const second = await caller.tradingProfiles.create({
        name: 'Second Default',
        enabledSetupTypes: ['larry-williams-9-2'],
        isDefault: true,
      });

      expect(second.isDefault).toBe(true);

      const firstUpdated = await caller.tradingProfiles.get({ id: first.id });
      expect(firstUpdated.isDefault).toBe(false);
    });

    it('should generate unique profile IDs', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const profile1 = await caller.tradingProfiles.create({
        name: 'Profile 1',
        enabledSetupTypes: ['larry-williams-9-1'],
      });
      const profile2 = await caller.tradingProfiles.create({
        name: 'Profile 2',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      expect(profile1.id).not.toBe(profile2.id);
    });
  });

  describe('update', () => {
    it('should update profile name', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const profile = await caller.tradingProfiles.create({
        name: 'Original Name',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const updated = await caller.tradingProfiles.update({
        id: profile.id,
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update enabledSetupTypes', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const profile = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const updated = await caller.tradingProfiles.update({
        id: profile.id,
        enabledSetupTypes: ['larry-williams-9-2', 'larry-williams-9-3'],
      });

      expect(updated.enabledSetupTypes).toEqual(['larry-williams-9-2', 'larry-williams-9-3']);
    });

    it('should update maxPositionSize and maxConcurrentPositions', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const profile = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const updated = await caller.tradingProfiles.update({
        id: profile.id,
        maxPositionSize: 20,
        maxConcurrentPositions: 3,
      });

      expect(updated.maxPositionSize).toBe(20);
      expect(updated.maxConcurrentPositions).toBe(3);
    });

    it('should throw NOT_FOUND for profile belonging to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const profile = await caller1.tradingProfiles.create({
        name: 'User1 Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await expect(
        caller2.tradingProfiles.update({ id: profile.id, name: 'Hacked' })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    });
  });

  describe('delete', () => {
    it('should delete profile', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const profile = await caller.tradingProfiles.create({
        name: 'To Delete',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const result = await caller.tradingProfiles.delete({ id: profile.id });

      expect(result.success).toBe(true);

      await expect(caller.tradingProfiles.get({ id: profile.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND when profile belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const profile = await caller1.tradingProfiles.create({
        name: 'User1 Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await expect(caller2.tradingProfiles.delete({ id: profile.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND for non-existent profile', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.tradingProfiles.delete({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate profile with new name', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const original = await caller.tradingProfiles.create({
        name: 'Original',
        description: 'Original description',
        enabledSetupTypes: ['larry-williams-9-1', 'larry-williams-9-2'],
        maxPositionSize: 15,
        maxConcurrentPositions: 5,
      });

      const duplicate = await caller.tradingProfiles.duplicate({
        id: original.id,
        newName: 'Duplicated Profile',
      });

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.name).toBe('Duplicated Profile');
      expect(duplicate.description).toBe('Original description');
      expect(duplicate.enabledSetupTypes).toEqual(['larry-williams-9-1', 'larry-williams-9-2']);
      expect(duplicate.maxPositionSize).toBe(15);
      expect(duplicate.maxConcurrentPositions).toBe(5);
      expect(duplicate.isDefault).toBe(false);
    });

    it('should throw NOT_FOUND when duplicating profile from another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const profile = await caller1.tradingProfiles.create({
        name: 'User1 Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await expect(
        caller2.tradingProfiles.duplicate({ id: profile.id, newName: 'Stolen Copy' })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    });
  });

  describe('assignToWatcher', () => {
    it('should assign profile to watcher', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const wallet = await createTestWallet({ userId: user.id });

      const profile = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      await caller.autoTrading.startWatcher({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      const status = await caller.autoTrading.getWatcherStatus({ walletId: wallet.id });
      const watcherId = status.activeWatchers[0]?.watcherId;

      if (watcherId) {
        const result = await caller.tradingProfiles.assignToWatcher({
          watcherId,
          profileId: profile.id,
        });

        expect(result.success).toBe(true);
      }
    });

    it('should unassign profile from watcher (set to null)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const wallet = await createTestWallet({ userId: user.id });

      const profile = await caller.tradingProfiles.create({
        name: 'Test Profile',
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      await caller.autoTrading.startWatcher({
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        interval: '4h',
      });

      const status = await caller.autoTrading.getWatcherStatus({ walletId: wallet.id });
      const watcherId = status.activeWatchers[0]?.watcherId;

      if (watcherId) {
        await caller.tradingProfiles.assignToWatcher({
          watcherId,
          profileId: profile.id,
        });

        const result = await caller.tradingProfiles.assignToWatcher({
          watcherId,
          profileId: null,
        });

        expect(result.success).toBe(true);
      }
    });
  });
});
