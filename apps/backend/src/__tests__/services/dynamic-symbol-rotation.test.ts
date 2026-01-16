import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import {
  DynamicSymbolRotationService,
  type RotationConfig,
} from '../../services/dynamic-symbol-rotation';
import { db } from '../../db';

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
    debug: vi.fn(),
  },
}));

vi.mock('../../services/watcher-batch-logger', () => {
  return {
    outputRotationResults: vi.fn(),
    RotationLogBuffer: class {
      setResult = vi.fn();
      toResult = vi.fn().mockReturnValue({});
    },
  };
});

const mockSelectQuery = (activeWatcherSymbols: string[], openPositionSymbols: string[] = []) => {
  const mockDbSelect = db.select as unknown as MockedFunction<() => unknown>;

  let callCount = 0;
  mockDbSelect.mockImplementation(() => {
    const result = {
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(
              activeWatcherSymbols.map(symbol => ({
                id: `watcher-${symbol}`,
                symbol,
                isManual: false,
                walletId: 'test-wallet',
              }))
            );
          }
          return Promise.resolve(
            openPositionSymbols.map(symbol => ({ symbol }))
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
    interval: '4h',
    excludedSymbols: [],
    marketType: 'FUTURES',
    tradingInterval: '2h',
  };

  beforeEach(() => {
    rotationService = new DynamicSymbolRotationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    rotationService.stopAll();
  });

  describe('executeRotation - count maintenance', () => {
    it('should NOT add symbols when all current symbols are kept (count should stay the same)', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      expect(result.kept).toHaveLength(3);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should only add symbols to replace removed ones (count should stay the same)', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'RANDOMUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 10 }
      );

      expect(result.kept).toHaveLength(2);
      expect(result.removed).toContain('RANDOMUSDT');
      expect(result.added).toHaveLength(1);
      expect(result.kept.length + result.added.length).toBe(3);
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

    it('should maintain 12 symbols when starting with 12 (not grow to limit 20)', async () => {
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
      expect(result.added).toHaveLength(0);
      expect(result.kept.length + result.added.length).toBe(12);
    });

    it('should maintain 18 symbols when starting with 18 and limit is 20', async () => {
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
      expect(totalAfterRotation).toBe(18);
    });

    it('should replace removed symbols with new ones maintaining count', async () => {
      mockSelectQuery(['BTCUSDT', 'ETHUSDT', 'OLDCOIN1USDT', 'OLDCOIN2USDT', 'SOLUSDT']);

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      expect(result.removed).toContain('OLDCOIN1USDT');
      expect(result.removed).toContain('OLDCOIN2USDT');
      expect(result.added).toHaveLength(2);
      expect(result.kept.length + result.added.length).toBe(5);
    });

    it('should not remove symbols with open positions', async () => {
      mockSelectQuery(
        ['BTCUSDT', 'ETHUSDT', 'OLDCOIN1USDT'],
        ['OLDCOIN1USDT']
      );

      const result = await rotationService.executeRotation(
        'test-wallet',
        'test-user',
        { ...baseConfig, limit: 20 }
      );

      expect(result.removed).not.toContain('OLDCOIN1USDT');
      expect(result.skippedWithPositions).toContain('OLDCOIN1USDT');
      expect(result.kept).toContain('OLDCOIN1USDT');
    });
  });
});
