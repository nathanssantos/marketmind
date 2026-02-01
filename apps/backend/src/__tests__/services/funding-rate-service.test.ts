import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../../db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

vi.mock('../../db/schema', () => ({
  positions: { id: 'id', symbol: 'symbol', status: 'status', marketType: 'marketType', walletId: 'walletId' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ type: 'and', args })),
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));

const mockGetCurrentFundingRate = vi.fn();

vi.mock('../../services/binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getCurrentFundingRate: mockGetCurrentFundingRate,
  })),
}));

vi.mock('../../services/binance-futures-client', () => ({
  isPaperWallet: vi.fn((wallet: { walletType: string }) => wallet.walletType === 'paper'),
}));

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    FILTER_DEFAULTS: actual.FILTER_DEFAULTS,
    calculateFundingPayment: vi.fn((positionValue: number, fundingRatePercent: number, side: string) => {
      const payment = positionValue * (fundingRatePercent / 100);
      return side === 'LONG' ? -payment : payment;
    }),
  };
});

const { fundingRateService } = await import('../../services/funding-rate-service');

describe('FundingRateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fundingRateService.stop();
    fundingRateService['fundingCache'].clear();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  afterEach(() => {
    fundingRateService.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should start the funding rate check interval', () => {
      fundingRateService.start();

      expect(fundingRateService['isRunning']).toBe(true);
      expect(fundingRateService['checkInterval']).not.toBeNull();
    });

    it('should not reinitialize if already running', () => {
      fundingRateService.start();
      const firstInterval = fundingRateService['checkInterval'];

      fundingRateService.start();
      const secondInterval = fundingRateService['checkInterval'];

      expect(firstInterval).toBe(secondInterval);
    });

    it('should process funding rates periodically', async () => {
      fundingRateService.start();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockDbSelect).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the funding rate check interval', () => {
      fundingRateService.start();
      fundingRateService.stop();

      expect(fundingRateService['isRunning']).toBe(false);
      expect(fundingRateService['checkInterval']).toBeNull();
    });

    it('should handle stop when not started', () => {
      expect(() => fundingRateService.stop()).not.toThrow();
    });
  });

  describe('processFundingRates', () => {
    it('should skip when no open futures positions', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await fundingRateService.processFundingRates();

      expect(mockGetCurrentFundingRate).not.toHaveBeenCalled();
    });

    it('should process positions grouped by symbol', async () => {
      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '50000',
            entryQty: '0.1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      await fundingRateService.processFundingRates();

      expect(mockGetCurrentFundingRate).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should skip non-paper positions', async () => {
      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '50000',
            entryQty: '0.1',
          },
          wallet: { id: 'wallet-1', walletType: 'real' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      await fundingRateService.processFundingRates();

      expect(mockGetCurrentFundingRate).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      await expect(fundingRateService.processFundingRates()).resolves.not.toThrow();
    });
  });

  describe('getFundingRateForSymbol', () => {
    it('should return funding rate for symbol', async () => {
      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const result = await fundingRateService.getFundingRateForSymbol('BTCUSDT');

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.0001);
      expect(result?.nextFundingTime).toBeInstanceOf(Date);
    });

    it('should return null when no funding rate available', async () => {
      mockGetCurrentFundingRate.mockResolvedValue(null);

      const result = await fundingRateService.getFundingRateForSymbol('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetCurrentFundingRate.mockRejectedValue(new Error('API error'));

      const result = await fundingRateService.getFundingRateForSymbol('BTCUSDT');

      expect(result).toBeNull();
    });
  });

  describe('funding rate application', () => {
    it('should apply funding when funding time has passed', async () => {
      const now = Date.now();
      const lastFundingTime = now - 60000;
      const nextFundingTime = lastFundingTime + 8 * 60 * 60 * 1000;

      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '50000',
            entryQty: '0.1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime,
      });

      await fundingRateService.processFundingRates();

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should skip if already applied for current funding period', async () => {
      const now = Date.now();
      const lastFundingTime = now - 60000;
      const nextFundingTime = lastFundingTime + 8 * 60 * 60 * 1000;

      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'ETHUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '3000',
            entryQty: '1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime,
      });

      await fundingRateService.processFundingRates();
      mockDbUpdate.mockClear();

      await fundingRateService.processFundingRates();

      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('should handle missing funding rate', async () => {
      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'SOLUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '100',
            entryQty: '10',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue(null);

      await fundingRateService.processFundingRates();

      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  describe('multiple positions', () => {
    it('should process multiple symbols', async () => {
      const now = Date.now();
      const lastFundingTime = now - 60000;
      const nextFundingTime = lastFundingTime + 8 * 60 * 60 * 1000;

      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '50000',
            entryQty: '0.1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
        {
          position: {
            id: 'pos-2',
            symbol: 'ETHUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'SHORT',
            entryPrice: '3000',
            entryQty: '1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime,
      });

      await fundingRateService.processFundingRates();

      expect(mockGetCurrentFundingRate).toHaveBeenCalledWith('BTCUSDT');
      expect(mockGetCurrentFundingRate).toHaveBeenCalledWith('ETHUSDT');
    });

    it('should process multiple positions for same symbol', async () => {
      const now = Date.now();
      const lastFundingTime = now - 60000;
      const nextFundingTime = lastFundingTime + 8 * 60 * 60 * 1000;

      const positions = [
        {
          position: {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '50000',
            entryQty: '0.1',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-1', walletType: 'paper' },
        },
        {
          position: {
            id: 'pos-2',
            symbol: 'BTCUSDT',
            status: 'open',
            marketType: 'FUTURES',
            side: 'LONG',
            entryPrice: '51000',
            entryQty: '0.2',
            accumulatedFunding: '0',
          },
          wallet: { id: 'wallet-2', walletType: 'paper' },
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(positions),
          }),
        }),
      });

      mockGetCurrentFundingRate.mockResolvedValue({
        rate: 0.0001,
        nextFundingTime,
      });

      await fundingRateService.processFundingRates();

      expect(mockGetCurrentFundingRate).toHaveBeenCalledTimes(1);
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
