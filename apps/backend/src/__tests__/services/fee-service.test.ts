import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Wallet } from '../../db/schema';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: vi.fn((e) => ({ message: e?.message })),
}));

vi.mock('../../services/encryption', () => ({
  decryptApiKey: vi.fn((key) => key),
}));

const mockGetTradeFee = vi.fn();
const mockGetAccountCommissionRate = vi.fn();

vi.mock('binance', () => ({
  MainClient: class MockMainClient {
    getTradeFee = mockGetTradeFee;
  },
  USDMClient: class MockUSDMClient {
    getAccountCommissionRate = mockGetAccountCommissionRate;
  },
}));

import {
  getDefaultFees,
  getCachedFees,
  setCachedFees,
  clearFeeCache,
  fetchSpotFees,
  fetchFuturesFees,
  fetchAllFees,
  getEffectiveFee,
  getBacktestFee,
  calculateTradeFees,
  type CachedFees,
} from '../../services/fee-service';

describe('FeeService', () => {
  const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: 'wallet-123',
    userId: 'user-1',
    name: 'Test Wallet',
    apiKeyEncrypted: 'encrypted-key',
    apiSecretEncrypted: 'encrypted-secret',
    walletType: 'live',
    marketType: 'SPOT',
    initialBalance: null,
    currentBalance: null,
    totalWalletBalance: null,
    totalDeposits: null,
    totalWithdrawals: null,
    lastTransferSyncAt: null,
    currency: 'USDT',
    exchange: 'BINANCE',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearFeeCache();
  });

  afterEach(() => {
    clearFeeCache();
  });

  describe('getDefaultFees', () => {
    it('should return default VIP_0 fees', () => {
      const fees = getDefaultFees();

      expect(fees.vipLevel).toBe(0);
      expect(fees.hasBnbDiscount).toBe(false);
      expect(fees.spot).toBeDefined();
      expect(fees.spot.maker).toBeDefined();
      expect(fees.spot.taker).toBeDefined();
      expect(fees.futures).toBeDefined();
      expect(fees.futures.maker).toBeDefined();
      expect(fees.futures.taker).toBeDefined();
      expect(fees.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('getCachedFees and setCachedFees', () => {
    it('should return null when no cached fees', () => {
      const result = getCachedFees('wallet-123');
      expect(result).toBeNull();
    });

    it('should cache and retrieve fees', () => {
      const fees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      setCachedFees('wallet-123', fees);
      const result = getCachedFees('wallet-123');

      expect(result).toEqual(fees);
    });

    it('should return null when cache is expired', () => {
      const fees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      setCachedFees('wallet-123', fees);

      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = getCachedFees('wallet-123');
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return cached fees before expiration', () => {
      const fees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      setCachedFees('wallet-123', fees);

      vi.useFakeTimers();
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      const result = getCachedFees('wallet-123');
      expect(result).toEqual(fees);

      vi.useRealTimers();
    });
  });

  describe('clearFeeCache', () => {
    it('should clear specific wallet cache', () => {
      const fees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      setCachedFees('wallet-123', fees);
      setCachedFees('wallet-456', fees);

      clearFeeCache('wallet-123');

      expect(getCachedFees('wallet-123')).toBeNull();
      expect(getCachedFees('wallet-456')).toEqual(fees);
    });

    it('should clear all caches when no walletId provided', () => {
      const fees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      setCachedFees('wallet-123', fees);
      setCachedFees('wallet-456', fees);

      clearFeeCache();

      expect(getCachedFees('wallet-123')).toBeNull();
      expect(getCachedFees('wallet-456')).toBeNull();
    });
  });

  describe('fetchSpotFees', () => {
    it('should return default fees for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'paper' });

      const result = await fetchSpotFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
      expect(mockGetTradeFee).not.toHaveBeenCalled();
    });

    it('should return default fees for paper-trading API key', async () => {
      const wallet = createMockWallet({ apiKeyEncrypted: 'paper-trading' });

      const result = await fetchSpotFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
      expect(mockGetTradeFee).not.toHaveBeenCalled();
    });

    it('should fetch fees from Binance API', async () => {
      const wallet = createMockWallet();
      mockGetTradeFee.mockResolvedValue([
        { makerCommission: '0.001', takerCommission: '0.001' },
      ]);

      const result = await fetchSpotFees(wallet);

      expect(result.maker).toBe(0.001);
      expect(result.taker).toBe(0.001);
      expect(mockGetTradeFee).toHaveBeenCalledWith({ symbol: 'BTCUSDT' });
    });

    it('should return default fees on API error', async () => {
      const wallet = createMockWallet();
      mockGetTradeFee.mockRejectedValue(new Error('API error'));

      const result = await fetchSpotFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
    });

    it('should return default fees when API returns empty data', async () => {
      const wallet = createMockWallet();
      mockGetTradeFee.mockResolvedValue([]);

      const result = await fetchSpotFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
    });
  });

  describe('fetchFuturesFees', () => {
    it('should return default fees for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'paper' });

      const result = await fetchFuturesFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
      expect(mockGetAccountCommissionRate).not.toHaveBeenCalled();
    });

    it('should return default fees for paper-trading API key', async () => {
      const wallet = createMockWallet({ apiKeyEncrypted: 'paper-trading' });

      const result = await fetchFuturesFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
      expect(mockGetAccountCommissionRate).not.toHaveBeenCalled();
    });

    it('should fetch fees from Binance Futures API', async () => {
      const wallet = createMockWallet();
      mockGetAccountCommissionRate.mockResolvedValue({
        makerCommissionRate: '0.0002',
        takerCommissionRate: '0.0004',
      });

      const result = await fetchFuturesFees(wallet);

      expect(result.maker).toBe(0.0002);
      expect(result.taker).toBe(0.0004);
      expect(mockGetAccountCommissionRate).toHaveBeenCalledWith({ symbol: 'BTCUSDT' });
    });

    it('should return default fees on API error', async () => {
      const wallet = createMockWallet();
      mockGetAccountCommissionRate.mockRejectedValue(new Error('API error'));

      const result = await fetchFuturesFees(wallet);

      expect(result.maker).toBeDefined();
      expect(result.taker).toBeDefined();
    });
  });

  describe('fetchAllFees', () => {
    it('should return cached fees if available', async () => {
      const wallet = createMockWallet();
      const cachedFees: CachedFees = {
        spot: { maker: 0.0005, taker: 0.0005 },
        futures: { maker: 0.0001, taker: 0.0002 },
        vipLevel: 1,
        hasBnbDiscount: true,
        lastUpdated: new Date(),
      };

      setCachedFees(wallet.id, cachedFees);

      const result = await fetchAllFees(wallet);

      expect(result).toEqual(cachedFees);
      expect(mockGetTradeFee).not.toHaveBeenCalled();
      expect(mockGetAccountCommissionRate).not.toHaveBeenCalled();
    });

    it('should fetch and cache fees when not cached', async () => {
      const wallet = createMockWallet();
      mockGetTradeFee.mockResolvedValue([
        { makerCommission: '0.001', takerCommission: '0.001' },
      ]);
      mockGetAccountCommissionRate.mockResolvedValue({
        makerCommissionRate: '0.0002',
        takerCommissionRate: '0.0004',
      });

      const result = await fetchAllFees(wallet);

      expect(result.spot.maker).toBe(0.001);
      expect(result.spot.taker).toBe(0.001);
      expect(result.futures.maker).toBe(0.0002);
      expect(result.futures.taker).toBe(0.0004);
      expect(result.vipLevel).toBe(0);
      expect(result.hasBnbDiscount).toBe(false);

      const cached = getCachedFees(wallet.id);
      expect(cached).toEqual(result);
    });

    it('should fetch both spot and futures fees in parallel', async () => {
      const wallet = createMockWallet();
      mockGetTradeFee.mockResolvedValue([
        { makerCommission: '0.001', takerCommission: '0.001' },
      ]);
      mockGetAccountCommissionRate.mockResolvedValue({
        makerCommissionRate: '0.0002',
        takerCommissionRate: '0.0004',
      });

      await fetchAllFees(wallet);

      expect(mockGetTradeFee).toHaveBeenCalled();
      expect(mockGetAccountCommissionRate).toHaveBeenCalled();
    });
  });

  describe('getEffectiveFee', () => {
    it('should return default fee when no cached fees', () => {
      const fee = getEffectiveFee('FUTURES', 'TAKER');
      expect(fee).toBeGreaterThan(0);
    });

    it('should return spot maker fee', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('SPOT', 'MAKER', cachedFees);
      expect(fee).toBe(0.001);
    });

    it('should return spot taker fee', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('SPOT', 'TAKER', cachedFees);
      expect(fee).toBe(0.002);
    });

    it('should return futures maker fee', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('FUTURES', 'MAKER', cachedFees);
      expect(fee).toBe(0.0002);
    });

    it('should return futures taker fee', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('FUTURES', 'TAKER', cachedFees);
      expect(fee).toBe(0.0004);
    });

    it('should apply BNB discount when enabled', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: true,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('SPOT', 'TAKER', cachedFees);
      expect(fee).toBeLessThan(0.001);
    });

    it('should default to TAKER when orderType not specified', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const fee = getEffectiveFee('SPOT', undefined, cachedFees);
      expect(fee).toBe(0.002);
    });
  });

  describe('getBacktestFee', () => {
    it('should return default taker fee', () => {
      const fee = getBacktestFee('FUTURES');
      expect(fee).toBeGreaterThan(0);
    });

    it('should return maker fee when specified', () => {
      const takerFee = getBacktestFee('FUTURES', 'TAKER');
      const makerFee = getBacktestFee('FUTURES', 'MAKER');

      expect(makerFee).toBeLessThanOrEqual(takerFee);
    });

    it('should apply BNB discount when enabled', () => {
      const regularFee = getBacktestFee('FUTURES', 'TAKER', false);
      const discountedFee = getBacktestFee('FUTURES', 'TAKER', true);

      expect(discountedFee).toBeLessThan(regularFee);
    });

    it('should return spot fees', () => {
      const fee = getBacktestFee('SPOT', 'TAKER');
      expect(fee).toBeGreaterThan(0);
    });
  });

  describe('calculateTradeFees', () => {
    it('should calculate fees for a position', () => {
      const result = calculateTradeFees(10000, 'FUTURES');

      expect(result.entryFee).toBeGreaterThan(0);
      expect(result.exitFee).toBeGreaterThan(0);
      expect(result.totalFees).toBe(result.entryFee + result.exitFee);
      expect(result.feePercent).toBeGreaterThan(0);
    });

    it('should calculate equal entry and exit fees', () => {
      const result = calculateTradeFees(10000, 'FUTURES', 'TAKER');

      expect(result.entryFee).toBe(result.exitFee);
    });

    it('should use cached fees when provided', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const result = calculateTradeFees(10000, 'FUTURES', 'TAKER', cachedFees);

      expect(result.entryFee).toBe(10000 * 0.0004);
      expect(result.exitFee).toBe(10000 * 0.0004);
      expect(result.totalFees).toBe(10000 * 0.0004 * 2);
      expect(result.feePercent).toBe(0.0004 * 2 * 100);
    });

    it('should calculate maker fees', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.001 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const result = calculateTradeFees(10000, 'FUTURES', 'MAKER', cachedFees);

      expect(result.entryFee).toBe(10000 * 0.0002);
      expect(result.exitFee).toBe(10000 * 0.0002);
    });

    it('should calculate spot fees', () => {
      const cachedFees: CachedFees = {
        spot: { maker: 0.001, taker: 0.002 },
        futures: { maker: 0.0002, taker: 0.0004 },
        vipLevel: 0,
        hasBnbDiscount: false,
        lastUpdated: new Date(),
      };

      const result = calculateTradeFees(10000, 'SPOT', 'TAKER', cachedFees);

      expect(result.entryFee).toBe(10000 * 0.002);
      expect(result.exitFee).toBe(10000 * 0.002);
    });
  });
});
