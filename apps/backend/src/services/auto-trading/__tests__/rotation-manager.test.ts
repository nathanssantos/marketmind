import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MarketType } from '@marketmind/types';

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    TRADING_DEFAULTS: { REQUIRED_KLINES: 500 },
    AUTO_TRADING_CONFIG: { MAX_WATCHERS_PER_WALLET: 20 },
  };
});

vi.mock('../../../constants', () => ({
  AUTO_TRADING_ROTATION: {
    MIN_PREPARATION_TIME_MS: 30_000,
    MIN_ANTICIPATION_MS: 5000,
    MAX_ANTICIPATION_MS: 60_000,
  },
  AUTO_TRADING_TIMING: {
    ANTICIPATION_CHECK_INTERVAL_MS: 15_000,
    CANDLE_CLOSE_SAFETY_BUFFER_MS: 3000,
  },
  INTERVAL_MS: { '1h': 3_600_000, '4h': 14_400_000 },
  TIME_MS: { MINUTE: 60_000, HOUR: 3_600_000 },
}));

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  },
}));

vi.mock('../../../db/schema', () => ({
  activeWatchers: {},
  autoTradingConfig: { walletId: 'walletId' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  inArray: vi.fn(),
}));

vi.mock('../../../utils/kline-calculator', () => ({
  calculateRequiredKlines: vi.fn(() => 500),
}));

vi.mock('../../../utils/profile-transformers', () => ({
  parseDynamicSymbolExcluded: vi.fn(() => []),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../../dynamic-symbol-rotation', () => ({
  getDynamicSymbolRotationService: vi.fn(() => ({
    getTopSymbols: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../kline-maintenance', () => ({
  getKlineMaintenance: vi.fn(() => ({
    forceCheckSymbol: vi.fn(),
  })),
}));

vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
  getCandleCloseTime: vi.fn((interval: string, ts: number) => {
    const map: Record<string, number> = { '1h': 3_600_000, '4h': 14_400_000 };
    const ms = map[interval] ?? 3_600_000;
    return Math.ceil(ts / ms) * ms;
  }),
  getNextCandleCloseTime: vi.fn((interval: string, ts: number) => {
    const map: Record<string, number> = { '1h': 3_600_000, '4h': 14_400_000 };
    const ms = map[interval] ?? 3_600_000;
    return Math.ceil(ts / ms) * ms + ms;
  }),
  getRotationAnticipationMs: vi.fn(() => 30_000),
}));

import { RotationManager } from '../rotation-manager';
import type { RotationManagerDeps } from '../types';

const createDeps = (): RotationManagerDeps => ({
  startWatcher: vi.fn(),
  stopWatcher: vi.fn(),
  addToProcessingQueue: vi.fn(),
  getActiveWatchers: vi.fn(() => new Map()),
});

describe('RotationManager', () => {
  let manager: RotationManager;
  let deps: RotationManagerDeps;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    deps = createDeps();
    manager = new RotationManager(deps);
  });

  afterEach(() => {
    manager.stopAnticipationTimer();
    vi.useRealTimers();
  });

  describe('getRotationPendingWatcher', () => {
    it('should return undefined for non-existent watcher', () => {
      expect(manager.getRotationPendingWatcher('nonexistent')).toBeUndefined();
    });

    it('should return pending watcher when set', () => {
      const pending = { symbol: 'ETHUSDT', interval: '1h', targetCandleClose: 1000 };
      (manager as any).rotationPendingWatchers.set('w1', pending);
      expect(manager.getRotationPendingWatcher('w1')).toEqual(pending);
    });
  });

  describe('deleteRotationPendingWatcher', () => {
    it('should remove pending watcher', () => {
      (manager as any).rotationPendingWatchers.set('w1', { symbol: 'TEST' });
      manager.deleteRotationPendingWatcher('w1');
      expect(manager.getRotationPendingWatcher('w1')).toBeUndefined();
    });

    it('should not throw for non-existent key', () => {
      expect(() => manager.deleteRotationPendingWatcher('nonexistent')).not.toThrow();
    });
  });

  describe('isWatcherRecentlyRotated', () => {
    it('should return false for non-existent watcher', () => {
      expect(manager.isWatcherRecentlyRotated('w1')).toBe(false);
    });

    it('should return true for recently rotated watcher', () => {
      (manager as any).recentlyRotatedWatchers.set('w1', Date.now());
      expect(manager.isWatcherRecentlyRotated('w1')).toBe(true);
    });

    it('should return false and clean up expired entries', () => {
      (manager as any).recentlyRotatedWatchers.set('w1', Date.now());
      vi.advanceTimersByTime(2 * 3_600_000 + 1);
      expect(manager.isWatcherRecentlyRotated('w1')).toBe(false);
      expect((manager as any).recentlyRotatedWatchers.has('w1')).toBe(false);
    });
  });

  describe('startAnticipationTimer', () => {
    it('should start the anticipation timer', () => {
      manager.startAnticipationTimer();
      expect((manager as any).anticipationCheckIntervalId).not.toBeNull();
    });

    it('should not start duplicate timer', () => {
      manager.startAnticipationTimer();
      const firstId = (manager as any).anticipationCheckIntervalId;
      manager.startAnticipationTimer();
      expect((manager as any).anticipationCheckIntervalId).toBe(firstId);
    });
  });

  describe('stopAnticipationTimer', () => {
    it('should stop the anticipation timer', () => {
      manager.startAnticipationTimer();
      manager.stopAnticipationTimer();
      expect((manager as any).anticipationCheckIntervalId).toBeNull();
    });

    it('should be safe to call when no timer is running', () => {
      expect(() => manager.stopAnticipationTimer()).not.toThrow();
    });
  });

  describe('checkAnticipatedRotations', () => {
    it('should return early when no rotation states', async () => {
      await manager.checkAnticipatedRotations();
      expect(deps.startWatcher).not.toHaveBeenCalled();
    });
  });

  describe('rotation state management', () => {
    it('should initialize with empty rotation states', () => {
      expect((manager as any).rotationStates.size).toBe(0);
    });

    it('should initialize with empty checking set', () => {
      expect((manager as any).isCheckingRotation.size).toBe(0);
    });

    it('should initialize with empty pending watchers', () => {
      expect((manager as any).rotationPendingWatchers.size).toBe(0);
    });
  });
});
