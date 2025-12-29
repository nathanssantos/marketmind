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
        winningTrades: 7,
        losingTrades: 3,
        breakevenTrades: 0,
        totalPnl: '100.00',
        maxConsecutiveLosses: 2,
        currentConsecutiveLosses: 0,
        lastTradeAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        totalPnlPercent: '10.00',
        avgWin: '20.00',
        avgLoss: '-10.00',
        avgRr: '2.00',
        profitFactor: '2.00',
        maxDrawdown: '5.00',
        avgSlippagePercent: '0.10',
        avgExecutionTimeMs: 150,
      };

      vi.mocked(db.query.strategyPerformance.findFirst).mockResolvedValue(perfRecord);

      const result = await service.getPerformance('larry-williams-9-1', 'BTCUSDT', '1h');

      expect(result).toEqual(perfRecord);
    });

    it('should return null if no performance record exists', async () => {
      const { db } = await import('../../db');
      vi.mocked(db.query.strategyPerformance.findFirst).mockResolvedValue(undefined);

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
