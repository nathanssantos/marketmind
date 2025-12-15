import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyPerformanceService } from '../strategy-performance';

vi.mock('../../db', () => ({
  db: {
    query: {
      tradeExecutions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      strategyPerformance: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('StrategyPerformanceService', () => {
  let service: StrategyPerformanceService;

  beforeEach(() => {
    service = new StrategyPerformanceService();
    vi.clearAllMocks();
  });

  describe('getPerformance', () => {
    it('should return performance record if exists', async () => {
      const { db } = await import('../../db');
      const perfRecord = {
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 10,
        winRate: '75.00',
      };

      vi.mocked(db.query.strategyPerformance.findFirst).mockResolvedValue(perfRecord as any);

      const result = await service.getPerformance('larry-williams-9-1', 'BTCUSDT', '1h');

      expect(result).toEqual(perfRecord);
    });

    it('should return null if no performance record exists', async () => {
      const { db } = await import('../../db');
      vi.mocked(db.query.strategyPerformance.findFirst).mockResolvedValue(null);

      const result = await service.getPerformance('unknown-strategy', 'BTCUSDT', '1h');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { db } = await import('../../db');
      vi.mocked(db.query.strategyPerformance.findFirst).mockRejectedValue(new Error('DB error'));

      const result = await service.getPerformance('larry-williams-9-1', 'BTCUSDT', '1h');

      expect(result).toBeNull();
    });
  });
});
