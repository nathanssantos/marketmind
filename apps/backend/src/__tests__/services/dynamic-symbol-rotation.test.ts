import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { db } from '../../db';
import {
    DynamicSymbolRotationService,
    getIntervalMs,
    type RotationConfig,
} from '../../services/dynamic-symbol-rotation';
import { logger } from '../../services/logger';

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../../services/opportunity-scoring', () => ({
  getOpportunityScoringService: vi.fn(() => ({
    getSymbolScores: vi.fn().mockResolvedValue([
      { symbol: 'BTCUSDT', compositeScore: 95 },
      { symbol: 'ETHUSDT', compositeScore: 90 },
      { symbol: 'SOLUSDT', compositeScore: 85 },
      { symbol: 'DOGEUSDT', compositeScore: 80 },
      { symbol: 'XRPUSDT', compositeScore: 75 },
      { symbol: 'ADAUSDT', compositeScore: 70 },
      { symbol: 'LINKUSDT', compositeScore: 65 },
      { symbol: 'DOTUSDT', compositeScore: 60 },
      { symbol: 'AVAXUSDT', compositeScore: 55 },
      { symbol: 'UNIUSDT', compositeScore: 50 },
      { symbol: 'LTCUSDT', compositeScore: 45 },
      { symbol: 'MATICUSDT', compositeScore: 40 },
      { symbol: 'AAVEUSDT', compositeScore: 38 },
      { symbol: 'ATOMUSDT', compositeScore: 36 },
      { symbol: 'NEARUSDT', compositeScore: 34 },
      { symbol: 'FTMUSDT', compositeScore: 32 },
      { symbol: 'SANDUSDT', compositeScore: 30 },
      { symbol: 'MANAUSDT', compositeScore: 28 },
      { symbol: 'GALAUSDT', compositeScore: 26 },
      { symbol: 'APEUSDT', compositeScore: 24 },
    ]),
  })),
}));

vi.mock('../../services/kline-prefetch', () => ({
  checkKlineAvailability: vi.fn().mockResolvedValue({ hasSufficient: true }),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../services/watcher-batch-logger', () => {
  return {
    outputRotationResults: vi.fn(),
    RotationLogBuffer: class {
      setContext = vi.fn();
      setResult = vi.fn();
      toResult = vi.fn().mockReturnValue({});
    },
  };
});

const mockSelectQuery = (activeWatcherSymbols: string[]) => {
  const mockDbSelect = db.select as unknown as MockedFunction<() => unknown>;

  mockDbSelect.mockImplementation(() => {
    const result = {
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          return Promise.resolve(
            activeWatcherSymbols.map(symbol => ({
              id: `watcher-${symbol}`,
              symbol,
              isManual: false,
              walletId: 'test-wallet',
            }))
          );
        }),
      })),
    };
    return result as unknown;
  });
};

describe('DynamicSymbolRotationService', () => {
  let rotationService: DynamicSymbolRotationService;

  const baseConfig: RotationConfig = {
    enabled: true,
    limit: 10,
    interval: '2h',
    excludedSymbols: [],
    marketType: 'FUTURES',
  };

  beforeEach(() => {
    rotationService = new DynamicSymbolRotationService();
    vi.clearAllMocks();
  });

  describe('executeRotation - count maintenance', () => {
    it('should add symbols up to config.limit when current count is below limit', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      expect(result.kept).toHaveLength(3);
      expect(result.removed).toHaveLength(0);
      expect(result.added).toHaveLength(7);
      expect(result.kept.length + result.added.length).toBe(10);
    });

    it('should fill to config.limit when a symbol is removed', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'RANDOMUSDT']);

      await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'RANDOMUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      expect(result.kept).toHaveLength(2);
      expect(result.removed).toContain('RANDOMUSDT');
      expect(result.kept.length + result.added.length).toBe(10);
    });

    it('should fill up to limit when there are NO current watchers (initial setup)', async () => {
      mockSelectQuery([]);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 5 }
      );

      expect(result.kept).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.added).toHaveLength(5);
    });

    it('should grow from 12 to limit 20 when limit allows more symbols', async () => {
      const symbols = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT',
        'LINKUSDT', 'DOTUSDT', 'AVAXUSDT', 'UNIUSDT', 'LTCUSDT', 'MATICUSDT',
      ];
      mockSelectQuery(symbols);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      expect(result.kept).toHaveLength(12);
      expect(result.removed).toHaveLength(0);
      expect(result.added).toHaveLength(8);
      expect(result.kept.length + result.added.length).toBe(20);
    });

    it('should grow from 18 to limit 20 when limit allows more symbols', async () => {
      const symbols = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT',
        'LINKUSDT', 'DOTUSDT', 'AVAXUSDT', 'UNIUSDT', 'LTCUSDT', 'MATICUSDT',
        'AAVEUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT',
      ];
      mockSelectQuery(symbols);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      const totalAfterRotation = result.kept.length + result.added.length;
      expect(totalAfterRotation).toBe(20);
    });

    it('should replace removed symbols and fill to config.limit', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'OLDCOIN1USDT', 'OLDCOIN2USDT', 'SOLUSDT']);

      await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'OLDCOIN1USDT', 'OLDCOIN2USDT', 'SOLUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      expect(result.removed).toContain('OLDCOIN1USDT');
      expect(result.removed).toContain('OLDCOIN2USDT');
      expect(result.kept.length + result.added.length).toBe(20);
    });

    it('should trim kept symbols to config.limit when hysteresis keeps too many', async () => {
      const symbols = Array.from({ length: 15 }, (_, i) => `SYMBOL${i}USDT`);
      mockSelectQuery(symbols);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      expect(result.kept.length + result.added.length).toBeLessThanOrEqual(10);
      expect(result.kept.length).toBeLessThanOrEqual(10);
    });

    it('should never exceed config.limit total after rotation', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 5 }
      );

      const total = result.kept.length + result.added.length;
      expect(total).toBeLessThanOrEqual(5);
    });

  });

  describe('cleanupWallet', () => {
    it('should clear rotation history and previous rankings for wallet', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT']);

      await rotationService.executeRotation('test-wallet', 'test-user', baseConfig);
      expect(rotationService.getRotationHistory('test-wallet')).toHaveLength(1);

      rotationService.cleanupWallet('test-wallet');

      expect(rotationService.getRotationHistory('test-wallet')).toHaveLength(0);
    });
  });

  describe('getIntervalMs', () => {
    it('should return correct milliseconds for valid intervals', () => {
      expect(getIntervalMs('1h')).toBe(60 * 60 * 1000);
      expect(getIntervalMs('4h')).toBe(4 * 60 * 60 * 1000);
      expect(getIntervalMs('1d')).toBe(24 * 60 * 60 * 1000);
    });

    it('should return 1h fallback and warn for invalid intervals', () => {
      const result = getIntervalMs('invalid');

      expect(result).toBe(60 * 60 * 1000);
      expect(logger.warn).toHaveBeenCalledWith(
        { interval: 'invalid' },
        '[DynamicRotation] Invalid interval, using 1h fallback'
      );
    });
  });
});
