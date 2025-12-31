import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('Fees Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('defaults', () => {
    it('should return default Binance fees without authentication', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.fees.defaults();

      expect(result.spot).toBeDefined();
      expect(result.spot.maker).toBeGreaterThanOrEqual(0);
      expect(result.spot.taker).toBeGreaterThanOrEqual(0);
      expect(result.spot.makerPercent).toBe(result.spot.maker * 100);
      expect(result.spot.takerPercent).toBe(result.spot.taker * 100);

      expect(result.futures).toBeDefined();
      expect(result.futures.maker).toBeGreaterThanOrEqual(0);
      expect(result.futures.taker).toBeGreaterThanOrEqual(0);

      expect(result.bnbDiscount).toBeGreaterThan(0);
    });

    it('should return consistent values on multiple calls', async () => {
      const caller = createUnauthenticatedCaller();

      const result1 = await caller.fees.defaults();
      const result2 = await caller.fees.defaults();

      expect(result1).toEqual(result2);
    });
  });

  describe('forWallet', () => {
    it('should return fees for a paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Test Wallet' });

      const result = await caller.fees.forWallet({ walletId: wallet.id });

      expect(result.spot).toBeDefined();
      expect(result.spot.maker).toBeGreaterThanOrEqual(0);
      expect(result.spot.taker).toBeGreaterThanOrEqual(0);

      expect(result.futures).toBeDefined();
      expect(result.futures.maker).toBeGreaterThanOrEqual(0);
      expect(result.futures.taker).toBeGreaterThanOrEqual(0);

      expect(result.vipLevel).toBeDefined();
      expect(typeof result.hasBnbDiscount).toBe('boolean');
      expect(result.lastUpdated).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.fees.forWallet({ walletId: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND when wallet belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.fees.forWallet({ walletId: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.fees.forWallet({ walletId: 'any' })).rejects.toThrow(TRPCError);
    });
  });

  describe('refreshForWallet', () => {
    it('should refresh fees for a paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const wallet = await caller.wallet.createPaper({ name: 'Test Wallet' });

      const result = await caller.fees.refreshForWallet({ walletId: wallet.id });

      expect(result.spot).toBeDefined();
      expect(result.futures).toBeDefined();
      expect(result.vipLevel).toBeDefined();
      expect(typeof result.hasBnbDiscount).toBe('boolean');
      expect(result.lastUpdated).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(caller.fees.refreshForWallet({ walletId: 'non-existent' })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should throw NOT_FOUND when wallet belongs to another user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const caller1 = createAuthenticatedCaller(user1, session1);
      const caller2 = createAuthenticatedCaller(user2, session2);

      const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

      await expect(caller2.fees.refreshForWallet({ walletId: wallet.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('forBacktest', () => {
    it('should return SPOT fees without BNB discount', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.fees.forBacktest({
        marketType: 'SPOT',
        useBnbDiscount: false,
      });

      expect(result.maker).toBeGreaterThanOrEqual(0);
      expect(result.taker).toBeGreaterThanOrEqual(0);
      expect(result.makerPercent).toBe(result.maker * 100);
      expect(result.takerPercent).toBe(result.taker * 100);
      expect(result.marketType).toBe('SPOT');
      expect(result.useBnbDiscount).toBe(false);
    });

    it('should return SPOT fees with BNB discount', async () => {
      const caller = createUnauthenticatedCaller();

      const withoutDiscount = await caller.fees.forBacktest({
        marketType: 'SPOT',
        useBnbDiscount: false,
      });

      const withDiscount = await caller.fees.forBacktest({
        marketType: 'SPOT',
        useBnbDiscount: true,
      });

      expect(withDiscount.useBnbDiscount).toBe(true);
      expect(withDiscount.taker).toBeLessThan(withoutDiscount.taker);
    });

    it('should return FUTURES fees', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.fees.forBacktest({
        marketType: 'FUTURES',
        useBnbDiscount: false,
      });

      expect(result.maker).toBeGreaterThanOrEqual(0);
      expect(result.taker).toBeGreaterThanOrEqual(0);
      expect(result.marketType).toBe('FUTURES');
    });

    it('should return different fees for SPOT vs FUTURES', async () => {
      const caller = createUnauthenticatedCaller();

      const spotFees = await caller.fees.forBacktest({
        marketType: 'SPOT',
        useBnbDiscount: false,
      });

      const futuresFees = await caller.fees.forBacktest({
        marketType: 'FUTURES',
        useBnbDiscount: false,
      });

      expect(spotFees.marketType).toBe('SPOT');
      expect(futuresFees.marketType).toBe('FUTURES');
    });
  });
});
