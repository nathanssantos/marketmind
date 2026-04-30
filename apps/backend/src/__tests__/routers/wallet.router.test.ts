import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('Wallet Router', () => {
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
    it('should return empty array when user has no wallets', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.wallet.list();

      expect(result).toEqual([]);
    });

    it('should return only wallets belonging to the user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      await caller1.wallet.createPaper({ name: 'User1 Wallet', initialBalance: '5000' });
      await caller2.wallet.createPaper({ name: 'User2 Wallet', initialBalance: '10000' });

      const result1 = await caller1.wallet.list();
      const result2 = await caller2.wallet.list();

      expect(result1).toHaveLength(1);
      expect(result1[0]?.name).toBe('User1 Wallet');

      expect(result2).toHaveLength(1);
      expect(result2[0]?.name).toBe('User2 Wallet');
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.wallet.list()).rejects.toThrow(TRPCError);
    });
  });

  describe('getById', () => {
    it('should return wallet when it belongs to user', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.wallet.createPaper({ name: 'Test Wallet' });
      const result = await caller.wallet.getById({ id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Test Wallet');
    });

    it('should throw NOT_FOUND when wallet belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.wallet.getById({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.wallet.getById({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('createPaper', () => {
    it('should create a paper wallet with default values', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.wallet.createPaper({ name: 'Test Wallet' });

      expect(result.name).toBe('Test Wallet');
      expect(result.initialBalance).toBe('10000');
      expect(result.currentBalance).toBe('10000');
      expect(result.currency).toBe('USDT');
    });

    it('should create a paper wallet with custom values', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.wallet.createPaper({
        name: 'Custom Wallet',
        initialBalance: '50000',
        currency: 'USDC',
      });

      expect(result.name).toBe('Custom Wallet');
      expect(result.initialBalance).toBe('50000');
      expect(result.currentBalance).toBe('50000');
      expect(result.currency).toBe('USDC');
    });

    it('should generate unique wallet IDs', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet1 = await caller.wallet.createPaper({ name: 'Wallet 1' });
      const wallet2 = await caller.wallet.createPaper({ name: 'Wallet 2' });

      expect(wallet1.id).not.toBe(wallet2.id);
    });
  });

  describe('update', () => {
    it('should update wallet name', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Original Name' });
      await caller.wallet.update({ id: wallet.id, name: 'Updated Name' });

      const result = await caller.wallet.getById({ id: wallet.id });
      expect(result.name).toBe('Updated Name');
    });

    it('should update wallet active status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Test Wallet' });
      await caller.wallet.update({ id: wallet.id, isActive: false });

      const result = await caller.wallet.getById({ id: wallet.id });
      expect(result.isActive).toBe(false);
    });

    it('should throw NOT_FOUND for wallet belonging to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(
        caller2.wallet.update({ id: wallet.id, name: 'Hacked' })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('agentTradingEnabled defaults to false on a new paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const wallet = await caller.wallet.createPaper({ name: 'Default Off' });
      const list = await caller.wallet.list();
      const found = list.find((w) => w.id === wallet.id);
      expect(found?.agentTradingEnabled).toBe(false);
    });

    it('toggles agentTradingEnabled on/off via update', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const wallet = await caller.wallet.createPaper({ name: 'Toggle Test' });

      await caller.wallet.update({ id: wallet.id, agentTradingEnabled: true });
      const enabled = await caller.wallet.list();
      expect(enabled.find((w) => w.id === wallet.id)?.agentTradingEnabled).toBe(true);

      await caller.wallet.update({ id: wallet.id, agentTradingEnabled: false });
      const disabled = await caller.wallet.list();
      expect(disabled.find((w) => w.id === wallet.id)?.agentTradingEnabled).toBe(false);
    });

    it('does not change agentTradingEnabled when omitted from update payload', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const wallet = await caller.wallet.createPaper({ name: 'Preserve Test' });

      await caller.wallet.update({ id: wallet.id, agentTradingEnabled: true });
      await caller.wallet.update({ id: wallet.id, name: 'Renamed' });

      const list = await caller.wallet.list();
      const found = list.find((w) => w.id === wallet.id);
      expect(found?.name).toBe('Renamed');
      expect(found?.agentTradingEnabled).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'To Delete' });
      const result = await caller.wallet.delete({ id: wallet.id });

      expect(result.success).toBe(true);

      await expect(caller.wallet.getById({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND when wallet belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.wallet.delete({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.wallet.delete({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('syncBalance (paper wallet)', () => {
    it('should return current balance for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({
        name: 'Paper Wallet',
        initialBalance: '25000',
      });

      const result = await caller.wallet.syncBalance({ id: wallet.id });

      expect(parseFloat(result.currentBalance)).toBe(25000);
      expect(result.currency).toBe('USDT');
      expect(result.walletType).toBe('paper');
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.wallet.syncBalance({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('testConnection (paper wallet)', () => {
    it('should return connected for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Paper Wallet' });
      const result = await caller.wallet.testConnection({ id: wallet.id });

      expect(result.connected).toBe(true);
      expect(result.walletType).toBe('paper');
      expect(result.message).toBe('Paper wallet - no API connection needed');
    });
  });

  describe('getPortfolio (paper wallet)', () => {
    it('should return portfolio for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({
        name: 'Paper Wallet',
        initialBalance: '10000',
      });

      const result = await caller.wallet.getPortfolio({ id: wallet.id });

      expect(parseFloat(result.totalValueUSDT)).toBe(10000);
      expect(result.walletType).toBe('paper');
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]?.asset).toBe('USDT');
      expect(parseFloat(result.assets[0]?.free ?? '0')).toBe(10000);
      expect(result.assets[0]?.locked).toBe('0');
      expect(parseFloat(result.assets[0]?.valueUSDT ?? '0')).toBe(10000);
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.wallet.getPortfolio({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('createPaper (FUTURES)', () => {
    it('should create a paper wallet with FUTURES market type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.wallet.createPaper({
        name: 'Futures Paper Wallet',
        marketType: 'FUTURES',
      });

      expect(result.name).toBe('Futures Paper Wallet');
      expect(result.marketType).toBe('FUTURES');
      expect(result.walletType).toBe('paper');
    });

    it('should create FUTURES wallet with custom initial balance', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.wallet.createPaper({
        name: 'High Balance Futures',
        marketType: 'FUTURES',
        initialBalance: '100000',
      });

      expect(result.initialBalance).toBe('100000');
      expect(result.currentBalance).toBe('100000');
      expect(result.marketType).toBe('FUTURES');
    });
  });

  describe('multiple wallets', () => {
    it('should list multiple wallets', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.wallet.createPaper({ name: 'Wallet 1' });
      await caller.wallet.createPaper({ name: 'Wallet 2', marketType: 'FUTURES' });
      await caller.wallet.createPaper({ name: 'Wallet 3', currency: 'USDC' });

      const result = await caller.wallet.list();

      expect(result).toHaveLength(3);
      const names = result.map(w => w.name);
      expect(names).toContain('Wallet 1');
      expect(names).toContain('Wallet 2');
      expect(names).toContain('Wallet 3');
    });

    it('should track active and inactive wallets correctly', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet1 = await caller.wallet.createPaper({ name: 'Active Wallet' });
      const wallet2 = await caller.wallet.createPaper({ name: 'Inactive Wallet' });
      await caller.wallet.update({ id: wallet2.id, isActive: false });

      const result = await caller.wallet.list();

      expect(result).toHaveLength(2);
      const activeWallet = result.find(w => w.id === wallet1.id);
      const inactiveWallet = result.find(w => w.id === wallet2.id);
      expect(activeWallet?.isActive).toBe(true);
      expect(inactiveWallet?.isActive).toBe(false);
    });
  });

  describe('wallet isolation', () => {
    it('should not allow syncing another users wallet', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.wallet.syncBalance({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should not allow testing connection on another users wallet', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.wallet.testConnection({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should not allow getting portfolio on another users wallet', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.wallet.getPortfolio({ id: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('update edge cases', () => {
    it('should update only name when provided', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Original' });
      await caller.wallet.update({ id: wallet.id, name: 'Updated' });

      const result = await caller.wallet.getById({ id: wallet.id });
      expect(result.name).toBe('Updated');
      expect(result.isActive).toBe(true);
    });

    it('should update only isActive when provided', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'My Wallet' });
      await caller.wallet.update({ id: wallet.id, isActive: false });

      const result = await caller.wallet.getById({ id: wallet.id });
      expect(result.name).toBe('My Wallet');
      expect(result.isActive).toBe(false);
    });

    it('should update both name and isActive together', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Original' });
      await caller.wallet.update({ id: wallet.id, name: 'Updated', isActive: false });

      const result = await caller.wallet.getById({ id: wallet.id });
      expect(result.name).toBe('Updated');
      expect(result.isActive).toBe(false);
    });
  });

  describe('testConnection (paper wallet) edge cases', () => {
    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.wallet.testConnection({ id: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });
});
