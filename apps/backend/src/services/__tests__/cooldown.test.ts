import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { tradeCooldowns } from '../../db/schema';
import { CooldownService } from '../cooldown';

vi.mock('../../db', () => ({
  db: {
    query: {
      tradeCooldowns: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CooldownService', () => {
  let service: CooldownService;

  beforeEach(() => {
    service = new CooldownService();
    vi.clearAllMocks();
  });

  describe('setCooldown', () => {
    it('should create a cooldown successfully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            strategyId: 'larry-williams-9-1',
            symbol: 'BTCUSDT',
            interval: '1h',
            walletId: 'wallet-123',
            cooldownUntil: new Date(Date.now() + 15 * 60 * 1000),
          }]),
        }),
      });
      vi.mocked(db.insert).mockReturnValue(mockInsert() as any);

      const result = await service.setCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '1h',
        'wallet-123',
        'exec-123',
        15,
        'Trade executed'
      );

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('strategyId', 'larry-williams-9-1');
      expect(db.insert).toHaveBeenCalledWith(tradeCooldowns);
    });

    it('should handle database errors gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });
      vi.mocked(db.insert).mockReturnValue(mockInsert() as any);

      await expect(
        service.setCooldown(
          'larry-williams-9-1',
          'BTCUSDT',
          '1h',
          'wallet-123',
          'exec-123',
          15
        )
      ).rejects.toThrow();
    });
  });

  describe('checkCooldown', () => {
    it('should return false if no cooldown exists', async () => {
      vi.mocked(db.query.tradeCooldowns.findFirst).mockResolvedValue(null);

      const result = await service.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '1h',
        'wallet-123'
      );

      expect(result.inCooldown).toBe(false);
    });

    it('should return true if active cooldown exists', async () => {
      const futureCooldown = {
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        walletId: 'wallet-123',
        cooldownUntil: new Date(Date.now() + 5 * 60 * 1000),
        reason: 'Trade executed',
        createdAt: new Date(),
      };

      vi.mocked(db.query.tradeCooldowns.findFirst).mockResolvedValue(futureCooldown as any);

      const result = await service.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '1h',
        'wallet-123'
      );

      expect(result.inCooldown).toBe(true);
    });

    it('should return false if cooldown has expired', async () => {
      const pastCooldown = {
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        walletId: 'wallet-123',
        cooldownUntil: new Date(Date.now() - 5 * 60 * 1000),
        reason: 'Trade executed',
        createdAt: new Date(),
      };

      vi.mocked(db.query.tradeCooldowns.findFirst).mockResolvedValue(pastCooldown as any);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.delete).mockReturnValue(mockDelete() as any);

      const result = await service.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '1h',
        'wallet-123'
      );

      expect(result.inCooldown).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.query.tradeCooldowns.findFirst).mockRejectedValue(new Error('DB error'));

      const result = await service.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '1h',
        'wallet-123'
      );

      expect(result.inCooldown).toBe(false);
    });
  });



  describe('cleanupExpired', () => {
    it('should delete expired cooldowns', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 5 }),
      });
      vi.mocked(db.delete).mockReturnValue(mockDelete() as any);

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(db.delete).toHaveBeenCalledWith(tradeCooldowns);
    });

    it('should return 0 if no expired cooldowns', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      });
      vi.mocked(db.delete).mockReturnValue(mockDelete() as any);

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should handle null rowCount', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: null }),
      });
      vi.mocked(db.delete).mockReturnValue(mockDelete() as any);

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB error')),
      });
      vi.mocked(db.delete).mockReturnValue(mockDelete() as any);

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });
  });

  describe('startCleanupScheduler', () => {
    it('should start cleanup scheduler with default interval', () => {
      const intervalId = service.startCleanupScheduler();

      expect(intervalId).toBeDefined();
      clearInterval(intervalId);
    });

    it('should start cleanup scheduler with custom interval', () => {
      const intervalId = service.startCleanupScheduler(30);

      expect(intervalId).toBeDefined();
      clearInterval(intervalId);
    });
  });
});
