import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MarketType } from '@marketmind/types';

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    TRADING_DEFAULTS: { REQUIRED_KLINES: 500, POSITION_SIZE_PERCENT: 5 },
    AUTO_TRADING_CONFIG: { TARGET_COUNT: { MIN: 1, MAX: 100, DEFAULT: 10 }, MAX_WATCHERS_PER_WALLET: 20 },
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
  INTERVAL_MS: { '1h': 3_600_000, '4h': 14_400_000, '15m': 900_000 },
  TIME_MS: { MINUTE: 60_000, HOUR: 3_600_000 },
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();

vi.mock('../../../db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock('../../../db/schema', () => ({
  activeWatchers: { walletId: 'walletId', symbol: 'symbol', isManual: 'isManual' },
  autoTradingConfig: { walletId: 'walletId' },
  wallets: { id: 'id', currentBalance: 'currentBalance' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ col, vals })),
}));

vi.mock('../../../utils/kline-calculator', () => ({
  calculateRequiredKlines: vi.fn(() => 500),
}));

vi.mock('../../../utils/profile-transformers', () => ({
  parseDynamicSymbolExcluded: vi.fn((val: string | null) => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  }),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockExecuteRotation = vi.fn();
vi.mock('../../dynamic-symbol-rotation', () => ({
  getDynamicSymbolRotationService: vi.fn(() => ({
    executeRotation: mockExecuteRotation,
    getTopSymbols: vi.fn().mockResolvedValue([]),
  })),
  getIntervalMs: vi.fn((interval: string) => {
    const map: Record<string, number> = { '1h': 3_600_000, '4h': 14_400_000, '15m': 900_000 };
    return map[interval] ?? 3_600_000;
  }),
}));

const mockForceCheckSymbol = vi.fn().mockResolvedValue({ gapsFilled: 0, corruptedFixed: 0 });
vi.mock('../../kline-maintenance', () => ({
  getKlineMaintenance: vi.fn(() => ({
    forceCheckSymbol: mockForceCheckSymbol,
  })),
}));

const mockPrefetchKlines = vi.fn().mockResolvedValue({
  success: true,
  downloaded: 500,
  totalInDb: 500,
  gaps: 0,
  alreadyComplete: false,
  error: null,
});
vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: (...args: unknown[]) => mockPrefetchKlines(...args),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
  getCandleCloseTime: vi.fn((interval: string, ts?: number) => {
    const now = ts ?? Date.now();
    const map: Record<string, number> = { '1h': 3_600_000, '4h': 14_400_000, '15m': 900_000 };
    const ms = map[interval] ?? 3_600_000;
    return Math.ceil(now / ms) * ms;
  }),
  getNextCandleCloseTime: vi.fn((interval: string, ts?: number) => {
    const now = ts ?? Date.now();
    const map: Record<string, number> = { '1h': 3_600_000, '4h': 14_400_000, '15m': 900_000 };
    const ms = map[interval] ?? 3_600_000;
    return Math.ceil(now / ms) * ms + ms;
  }),
  getRotationAnticipationMs: vi.fn(() => 30_000),
}));

import { RotationManager } from '../rotation/rotation-manager';
import type { RotationManagerDeps } from '../types';
import type { RotationResult } from '../../dynamic-symbol-rotation';

const createRotationResult = (overrides: Partial<RotationResult> = {}): RotationResult => ({
  added: [],
  removed: [],
  kept: [],
  targetLimit: 5,
  skippedInsufficientKlines: [],
  skippedInsufficientCapital: [],
  skippedTrend: [],
  timestamp: new Date(),
  ...overrides,
});

const createDeps = (): RotationManagerDeps => ({
  startWatcher: vi.fn(),
  stopWatcher: vi.fn(),
  addToProcessingQueue: vi.fn(),
  getActiveWatchers: vi.fn(() => new Map()),
});

const setupChainedDbSelect = (results: unknown[] = []) => {
  const limitMock = vi.fn().mockResolvedValue(results);
  const whereResult = Object.assign(Promise.resolve(results), { limit: limitMock });
  const whereMock = vi.fn(() => whereResult);
  const fromMock = vi.fn(() => ({ where: whereMock }));
  mockDbSelect.mockReturnValue({ from: fromMock });
  return { fromMock, whereMock, limitMock };
};

describe('RotationManager', () => {
  let manager: RotationManager;
  let deps: RotationManagerDeps;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    deps = createDeps();
    manager = new RotationManager(deps);
    setupChainedDbSelect([]);
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
      const pending = { addedAt: 1000, targetCandleClose: 2000 };
      (manager as any).rotationPendingWatchers.set('w1', pending);
      expect(manager.getRotationPendingWatcher('w1')).toEqual(pending);
    });
  });

  describe('deleteRotationPendingWatcher', () => {
    it('should remove pending watcher', () => {
      (manager as any).rotationPendingWatchers.set('w1', { addedAt: 1000, targetCandleClose: 2000 });
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

    it('should return true when just under the expiry threshold', () => {
      (manager as any).recentlyRotatedWatchers.set('w1', Date.now());
      vi.advanceTimersByTime(2 * 3_600_000 - 1);
      expect(manager.isWatcherRecentlyRotated('w1')).toBe(true);
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

  describe('isRotationActive', () => {
    it('should return false when no rotation states exist', () => {
      expect(manager.isRotationActive('wallet-1')).toBe(false);
    });

    it('should return true when rotation state exists for wallet', () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      expect(manager.isRotationActive('wallet-1')).toBe(true);
    });

    it('should return false for a different wallet', () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      expect(manager.isRotationActive('wallet-2')).toBe(false);
    });
  });

  describe('getNextRotationTime', () => {
    it('should return null when no rotation states exist', () => {
      expect(manager.getNextRotationTime('wallet-1')).toBeNull();
    });

    it('should return next rotation time for active wallet', () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      const result = manager.getNextRotationTime('wallet-1');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return earliest time when multiple intervals exist', () => {
      (manager as any).rotationStates.set('wallet-1:4h', {
        config: { enabled: true, limit: 5, interval: '4h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      const result = manager.getNextRotationTime('wallet-1');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('getRotationConfig', () => {
    it('should return null when no rotation states exist', () => {
      expect(manager.getRotationConfig('wallet-1')).toBeNull();
    });

    it('should return config for active wallet', () => {
      const config = { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' as MarketType };
      (manager as any).rotationStates.set('wallet-1:1h', {
        config,
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      expect(manager.getRotationConfig('wallet-1')).toEqual(config);
    });
  });

  describe('getRotationCycles', () => {
    it('should return empty array when no rotation states exist', () => {
      expect(manager.getRotationCycles('wallet-1')).toEqual([]);
    });

    it('should return sorted cycles for wallet', () => {
      const config1h = { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' as MarketType };
      const config4h = { enabled: true, limit: 5, interval: '4h', excludedSymbols: [], marketType: 'FUTURES' as MarketType };

      (manager as any).rotationStates.set('wallet-1:4h', {
        config: config4h,
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: config1h,
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      const cycles = manager.getRotationCycles('wallet-1');
      expect(cycles).toHaveLength(2);
      expect(cycles[0]!.nextRotation.getTime()).toBeLessThanOrEqual(cycles[1]!.nextRotation.getTime());
    });

    it('should not include cycles from other wallets', () => {
      (manager as any).rotationStates.set('wallet-2:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-2',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      expect(manager.getRotationCycles('wallet-1')).toEqual([]);
    });
  });

  describe('checkAnticipatedRotations', () => {
    it('should return early when no rotation states', async () => {
      await manager.checkAnticipatedRotations();
      expect(deps.startWatcher).not.toHaveBeenCalled();
    });

    it('should skip states that are already being checked', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).isCheckingRotation.add('wallet-1:1h');
      await manager.checkAnticipatedRotations();
      expect(mockExecuteRotation).not.toHaveBeenCalled();
    });
  });

  describe('checkAllRotationsOnce', () => {
    it('should return empty array when no rotation states exist', async () => {
      const result = await manager.checkAllRotationsOnce();
      expect(result).toEqual([]);
    });

    it('should return empty array when states are being checked', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).isCheckingRotation.add('wallet-1:1h');
      const result = await manager.checkAllRotationsOnce();
      expect(result).toEqual([]);
    });

    it('should execute rotation when new candle is detected', async () => {
      const intervalMs = 3_600_000;
      const currentCandleClose = Math.ceil(Date.now() / intervalMs) * intervalMs;
      const previousCandleClose = currentCandleClose - intervalMs;

      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: previousCandleClose - intervalMs,
        lastRotationCandleClose: previousCandleClose - intervalMs,
      });

      mockExecuteRotation.mockResolvedValue(createRotationResult({ added: ['ETHUSDT'] }));

      const result = await manager.checkAllRotationsOnce();
      expect(mockExecuteRotation).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should not execute when candle close has not changed', async () => {
      const intervalMs = 3_600_000;
      const currentCandleClose = Math.ceil(Date.now() / intervalMs) * intervalMs;
      const previousCandleClose = currentCandleClose - intervalMs;

      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: currentCandleClose,
        lastRotationCandleClose: previousCandleClose,
      });

      const result = await manager.checkAllRotationsOnce();
      expect(mockExecuteRotation).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle rotation execution errors gracefully', async () => {
      const intervalMs = 3_600_000;
      const currentCandleClose = Math.ceil(Date.now() / intervalMs) * intervalMs;
      const previousCandleClose = currentCandleClose - intervalMs;

      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: previousCandleClose - intervalMs,
        lastRotationCandleClose: previousCandleClose - intervalMs,
      });

      mockExecuteRotation.mockRejectedValue(new Error('Rotation service failed'));

      const result = await manager.checkAllRotationsOnce();
      expect(result).toEqual([]);
      expect((manager as any).isCheckingRotation.has('wallet-1:1h')).toBe(false);
    });

    it('should fetch wallet balance when capitalRequirement is set', async () => {
      const intervalMs = 3_600_000;
      const currentCandleClose = Math.ceil(Date.now() / intervalMs) * intervalMs;
      const previousCandleClose = currentCandleClose - intervalMs;

      (manager as any).rotationStates.set('wallet-1:1h', {
        config: {
          enabled: true,
          limit: 5,
          interval: '1h',
          excludedSymbols: [],
          marketType: 'FUTURES',
          capitalRequirement: { walletBalance: 0, leverage: 5, targetWatchersCount: 5, positionSizePercent: 5 },
        },
        userId: 'user-1',
        lastCandleCloseTime: previousCandleClose - intervalMs,
        lastRotationCandleClose: previousCandleClose - intervalMs,
      });

      setupChainedDbSelect([{ currentBalance: '10000' }]);
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.checkAllRotationsOnce();
      expect(mockDbSelect).toHaveBeenCalled();
    });
  });

  describe('applyRotationWithQueue', () => {
    it('should stop watchers for removed symbols', async () => {
      const result = createRotationResult({ removed: ['BTCUSDT', 'ETHUSDT'] });
      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(deps.stopWatcher).toHaveBeenCalledTimes(2);
      expect(deps.stopWatcher).toHaveBeenCalledWith('wallet-1', 'BTCUSDT', '1h', 'FUTURES');
      expect(deps.stopWatcher).toHaveBeenCalledWith('wallet-1', 'ETHUSDT', '1h', 'FUTURES');
    });

    it('should start watchers for added symbols that do not exist', async () => {
      const result = createRotationResult({ added: ['SOLUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(deps.startWatcher).toHaveBeenCalledTimes(1);
      expect(deps.addToProcessingQueue).toHaveBeenCalledWith(['wallet-1-SOLUSDT-1h-FUTURES']);
    });

    it('should skip adding symbols with existing active watchers', async () => {
      const activeWatchers = new Map();
      activeWatchers.set('wallet-1-ETHUSDT-1h-FUTURES', { symbol: 'ETHUSDT' });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(activeWatchers);

      const result = createRotationResult({ added: ['ETHUSDT'] });
      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(deps.startWatcher).not.toHaveBeenCalled();
      expect(mockPrefetchKlines).not.toHaveBeenCalled();
    });

    it('should prefetch klines for new symbols', async () => {
      const result = createRotationResult({ added: ['SOLUSDT', 'AVAXUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(mockPrefetchKlines).toHaveBeenCalledTimes(2);
      expect(mockForceCheckSymbol).toHaveBeenCalledTimes(2);
    });

    it('should set pending watcher with targetCandleClose', async () => {
      const result = createRotationResult({ added: ['SOLUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      const targetCandleClose = Date.now() + 60_000;
      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES', targetCandleClose);

      const pending = manager.getRotationPendingWatcher('wallet-1-SOLUSDT-1h-FUTURES');
      expect(pending).toBeDefined();
      expect(pending!.targetCandleClose).toBe(targetCandleClose);
    });

    it('should not set pending watcher when no targetCandleClose', async () => {
      const result = createRotationResult({ added: ['SOLUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      const pending = manager.getRotationPendingWatcher('wallet-1-SOLUSDT-1h-FUTURES');
      expect(pending).toBeUndefined();
    });

    it('should mark added watchers as recently rotated', async () => {
      const result = createRotationResult({ added: ['SOLUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(manager.isWatcherRecentlyRotated('wallet-1-SOLUSDT-1h-FUTURES')).toBe(true);
    });

    it('should return added watcher IDs', async () => {
      const result = createRotationResult({ added: ['SOLUSDT', 'AVAXUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      const addedIds = await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(addedIds).toEqual(['wallet-1-SOLUSDT-1h-FUTURES', 'wallet-1-AVAXUSDT-1h-FUTURES']);
    });

    it('should use default marketType FUTURES when not specified', async () => {
      const result = createRotationResult({ added: ['SOLUSDT'] });
      (deps.getActiveWatchers as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      const addedIds = await manager.applyRotationWithQueue('wallet-1', 'user-1', result, '1h', 'profile-1');

      expect(addedIds).toEqual(['wallet-1-SOLUSDT-1h-FUTURES']);
    });
  });

  describe('applyRotation', () => {
    it('should remove only non-manual watchers', async () => {
      setupChainedDbSelect([{ walletId: 'wallet-1', symbol: 'BTCUSDT', isManual: false }]);
      const result = createRotationResult({ removed: ['BTCUSDT'] });

      await manager.applyRotation('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');
      expect(deps.stopWatcher).toHaveBeenCalledWith('wallet-1', 'BTCUSDT', '1h', 'FUTURES');
    });

    it('should not stop watcher if no matching db record found', async () => {
      setupChainedDbSelect([]);
      const result = createRotationResult({ removed: ['BTCUSDT'] });

      await manager.applyRotation('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');
      expect(deps.stopWatcher).not.toHaveBeenCalled();
    });

    it('should add watchers for symbols not already in DB', async () => {
      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        const results: unknown[] = [];
        const limitMock = vi.fn().mockResolvedValue(results);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      const result = createRotationResult({ added: ['SOLUSDT'] });
      const addedIds = await manager.applyRotation('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(deps.startWatcher).toHaveBeenCalledTimes(1);
      expect(addedIds).toEqual(['wallet-1-SOLUSDT-1h-FUTURES']);
    });

    it('should skip adding symbols that already have watchers in DB', async () => {
      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([{ walletId: 'wallet-1', symbol: 'SOLUSDT' }]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      const result = createRotationResult({ added: ['SOLUSDT'] });
      const addedIds = await manager.applyRotation('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(deps.startWatcher).not.toHaveBeenCalled();
      expect(addedIds).toEqual([]);
    });

    it('should prefetch klines and validate for new symbols', async () => {
      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      mockForceCheckSymbol.mockResolvedValue({ gapsFilled: 2, corruptedFixed: 1 });

      const result = createRotationResult({ added: ['SOLUSDT'] });
      await manager.applyRotation('wallet-1', 'user-1', result, '1h', 'profile-1', 'FUTURES');

      expect(mockPrefetchKlines).toHaveBeenCalled();
      expect(mockForceCheckSymbol).toHaveBeenCalled();
    });
  });

  describe('startDynamicRotation', () => {
    it('should return early when dynamic symbol selection is disabled', async () => {
      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: false,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(mockExecuteRotation).not.toHaveBeenCalled();
    });

    it('should execute initial rotation and set up state', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult({ added: ['ETHUSDT'] }));
      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(mockExecuteRotation).toHaveBeenCalled();
      expect(manager.isRotationActive('wallet-1')).toBe(true);
    });

    it('should start anticipation timer when auto rotation is enabled', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
        enableAutoRotation: true,
      });

      expect((manager as any).anticipationCheckIntervalId).not.toBeNull();
    });

    it('should not start anticipation timer when auto rotation is disabled', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
        enableAutoRotation: false,
      });

      expect((manager as any).anticipationCheckIntervalId).toBeNull();
      expect(manager.isRotationActive('wallet-1')).toBe(false);
    });

    it('should pass capital requirement when wallet balance is provided', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
        walletBalance: 10000,
        leverage: 5,
      });

      expect(mockExecuteRotation).toHaveBeenCalledWith(
        'wallet-1',
        'user-1',
        expect.objectContaining({
          capitalRequirement: expect.objectContaining({
            walletBalance: 10000,
            leverage: 5,
          }),
        })
      );
    });

    it('should not include capitalRequirement when walletBalance is undefined', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(mockExecuteRotation).toHaveBeenCalledWith(
        'wallet-1',
        'user-1',
        expect.objectContaining({
          capitalRequirement: undefined,
        })
      );
    });

    it('should add new watcher IDs to processing queue', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult({ added: ['SOLUSDT'] }));
      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      await manager.startDynamicRotation('wallet-1', 'user-1', {
        useDynamicSymbolSelection: true,
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(deps.addToProcessingQueue).toHaveBeenCalled();
    });
  });

  describe('stopDynamicRotation', () => {
    it('should return early when no rotation state exists for wallet', async () => {
      await manager.stopDynamicRotation('wallet-1');
      expect(deps.stopWatcher).not.toHaveBeenCalled();
    });

    it('should remove rotation states for wallet', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      setupChainedDbSelect([]);

      await manager.stopDynamicRotation('wallet-1');
      expect(manager.isRotationActive('wallet-1')).toBe(false);
    });

    it('should stop anticipation timer when last rotation state is removed', async () => {
      manager.startAnticipationTimer();
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      setupChainedDbSelect([]);

      await manager.stopDynamicRotation('wallet-1');
      expect((manager as any).anticipationCheckIntervalId).toBeNull();
    });

    it('should not stop anticipation timer when other wallets still have rotations', async () => {
      manager.startAnticipationTimer();
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).rotationStates.set('wallet-2:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-2',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      setupChainedDbSelect([]);

      await manager.stopDynamicRotation('wallet-1');
      expect((manager as any).anticipationCheckIntervalId).not.toBeNull();
    });

    it('should stop dynamic watchers when stopDynamicWatchers is true', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      const dynamicWatchers = [
        { walletId: 'wallet-1', symbol: 'ETHUSDT', interval: '1h', marketType: 'FUTURES' },
        { walletId: 'wallet-1', symbol: 'SOLUSDT', interval: '1h', marketType: 'FUTURES' },
      ];

      const whereMock = vi.fn().mockResolvedValue(dynamicWatchers);
      const fromMock = vi.fn(() => ({ where: whereMock }));
      mockDbSelect.mockReturnValue({ from: fromMock });

      await manager.stopDynamicRotation('wallet-1', true);
      expect(deps.stopWatcher).toHaveBeenCalledTimes(2);
    });

    it('should not stop watchers when stopDynamicWatchers is false', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });

      await manager.stopDynamicRotation('wallet-1', false);
      expect(deps.stopWatcher).not.toHaveBeenCalled();
    });

    it('should clean up isCheckingRotation set for wallet', async () => {
      (manager as any).rotationStates.set('wallet-1:1h', {
        config: { enabled: true, limit: 5, interval: '1h', excludedSymbols: [], marketType: 'FUTURES' },
        userId: 'user-1',
        lastCandleCloseTime: 0,
        lastRotationCandleClose: 0,
      });
      (manager as any).isCheckingRotation.add('wallet-1:1h');

      setupChainedDbSelect([]);

      await manager.stopDynamicRotation('wallet-1');
      expect((manager as any).isCheckingRotation.has('wallet-1:1h')).toBe(false);
    });
  });

  describe('triggerManualRotation', () => {
    it('should execute rotation and return result', async () => {
      const rotationResult = createRotationResult({ added: ['SOLUSDT'], removed: ['BTCUSDT'] });
      mockExecuteRotation.mockResolvedValue(rotationResult);

      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      const result = await manager.triggerManualRotation('wallet-1', 'user-1', {
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(result).toEqual(rotationResult);
      expect(mockExecuteRotation).toHaveBeenCalled();
    });

    it('should add new watcher IDs to processing queue', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult({ added: ['SOLUSDT'] }));
      mockDbSelect.mockImplementation(() => {
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      await manager.triggerManualRotation('wallet-1', 'user-1', {
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
      });

      expect(deps.addToProcessingQueue).toHaveBeenCalled();
    });

    it('should include capital requirement when wallet balance is provided', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.triggerManualRotation('wallet-1', 'user-1', {
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
        walletBalance: 5000,
        leverage: 10,
      });

      expect(mockExecuteRotation).toHaveBeenCalledWith(
        'wallet-1',
        'user-1',
        expect.objectContaining({
          capitalRequirement: expect.objectContaining({
            walletBalance: 5000,
            leverage: 10,
          }),
        })
      );
    });

    it('should pass btcCorrelationFilter when set', async () => {
      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.triggerManualRotation('wallet-1', 'user-1', {
        targetWatcherCount: 5,
        dynamicSymbolExcluded: null,
        marketType: 'FUTURES',
        interval: '1h',
        useBtcCorrelationFilter: true,
      });

      expect(mockExecuteRotation).toHaveBeenCalledWith(
        'wallet-1',
        'user-1',
        expect.objectContaining({
          useBtcCorrelationFilter: true,
        })
      );
    });
  });

  describe('restoreRotationStates', () => {
    it('should return early when no dynamic watchers exist', async () => {
      await manager.restoreRotationStates([], () => 0);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('should skip manual watchers', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: true, profileId: null },
      ];
      await manager.restoreRotationStates(watchers, () => 0);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('should restore rotation for dynamic watchers with valid config', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: 'p1' },
      ];

      const configs = [{
        walletId: 'w1',
        useDynamicSymbolSelection: true,
        dynamicSymbolExcluded: null,
        enableAutoRotation: true,
        leverage: 5,
        useBtcCorrelationFilter: true,
      }];
      const walletsData = [{ id: 'w1', currentBalance: '10000' }];

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 2) {
          const whereMock = vi.fn().mockResolvedValue(selectCallCount === 1 ? configs : walletsData);
          const fromMock = vi.fn(() => ({ where: whereMock }));
          return { from: fromMock };
        }
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.restoreRotationStates(watchers, () => 5);

      expect(mockExecuteRotation).toHaveBeenCalled();
    });

    it('should skip wallets without dynamic symbol selection enabled', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: null },
      ];

      const configs = [{ walletId: 'w1', useDynamicSymbolSelection: false }];
      const walletsData = [{ id: 'w1', currentBalance: '10000' }];

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        const results = selectCallCount === 1 ? configs : walletsData;
        const whereMock = vi.fn().mockResolvedValue(results);
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      await manager.restoreRotationStates(watchers, () => 0);
      expect(mockExecuteRotation).not.toHaveBeenCalled();
    });

    it('should use per-interval persisted watcher count as target', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: null },
      ];

      const configs = [{
        walletId: 'w1',
        useDynamicSymbolSelection: true,
        dynamicSymbolExcluded: null,
        enableAutoRotation: true,
        leverage: 1,
        useBtcCorrelationFilter: false,
      }];
      const walletsData = [{ id: 'w1', currentBalance: '5000' }];

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 2) {
          const results = selectCallCount === 1 ? configs : walletsData;
          const whereMock = vi.fn().mockResolvedValue(results);
          const fromMock = vi.fn(() => ({ where: whereMock }));
          return { from: fromMock };
        }
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.restoreRotationStates(watchers, () => 0);

      expect(mockExecuteRotation).toHaveBeenCalledWith(
        'w1',
        'u1',
        expect.objectContaining({
          limit: 1,
        })
      );
    });

    it('should handle errors during restoration gracefully', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: null },
      ];

      const configs = [{
        walletId: 'w1',
        useDynamicSymbolSelection: true,
        dynamicSymbolExcluded: null,
        enableAutoRotation: true,
        leverage: 1,
        useBtcCorrelationFilter: false,
      }];
      const walletsData = [{ id: 'w1', currentBalance: '5000' }];

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 2) {
          const results = selectCallCount === 1 ? configs : walletsData;
          const whereMock = vi.fn().mockResolvedValue(results);
          const fromMock = vi.fn(() => ({ where: whereMock }));
          return { from: fromMock };
        }
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      mockExecuteRotation.mockRejectedValue(new Error('Service unavailable'));

      await expect(manager.restoreRotationStates(watchers, () => 3)).resolves.not.toThrow();
    });

    it('should deduplicate watchers by wallet-interval key', async () => {
      const watchers = [
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: null },
        { walletId: 'w1', userId: 'u1', interval: '1h', marketType: 'FUTURES', isManual: false, profileId: null },
      ];

      const configs = [{
        walletId: 'w1',
        useDynamicSymbolSelection: true,
        dynamicSymbolExcluded: null,
        enableAutoRotation: false,
        leverage: 1,
        useBtcCorrelationFilter: false,
      }];
      const walletsData = [{ id: 'w1', currentBalance: '5000' }];

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 2) {
          const results = selectCallCount === 1 ? configs : walletsData;
          const whereMock = vi.fn().mockResolvedValue(results);
          const fromMock = vi.fn(() => ({ where: whereMock }));
          return { from: fromMock };
        }
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn(() => ({ limit: limitMock }));
        const fromMock = vi.fn(() => ({ where: whereMock }));
        return { from: fromMock };
      });

      mockExecuteRotation.mockResolvedValue(createRotationResult());

      await manager.restoreRotationStates(watchers, () => 5);

      expect(mockExecuteRotation).toHaveBeenCalledTimes(1);
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

    it('should initialize with empty recently rotated watchers', () => {
      expect((manager as any).recentlyRotatedWatchers.size).toBe(0);
    });
  });
});
