import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MarketType } from '@marketmind/types';

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  activeWatchers: {
    walletId: 'walletId',
    symbol: 'symbol',
    interval: 'interval',
    marketType: 'marketType',
    id: 'id',
  },
  autoTradingConfig: { walletId: 'walletId' },
  tradingProfiles: {
    id: 'id',
    name: 'name',
    enabledSetupTypes: 'enabledSetupTypes',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: string, val: unknown) => ({ col, val })),
  inArray: vi.fn(),
}));

vi.mock('../../../constants', () => ({
  INTERVAL_MS: { '1m': 60000, '1h': 3600000, '4h': 14400000 },
  TIME_MS: { MINUTE: 60000, HOUR: 3600000 },
}));

vi.mock('../../../utils/kline-calculator', () => ({
  calculateRequiredKlines: vi.fn(() => 500),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: vi.fn().mockResolvedValue({ success: true, totalInDb: 500 }),
}));

vi.mock('../../watcher-batch-logger', () => ({
  outputStartupResults: vi.fn(),
  StartupLogBuffer: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setPersistedCount = vi.fn();
    this.setPreloadedConfigs = vi.fn();
    this.addRestoredWatcher = vi.fn();
    this.getResults = vi.fn(() => ({
      watchers: [],
      persistedCount: 0,
      durationMs: 0,
      preloadedConfigs: 0,
      walletCount: 0,
    }));
  }),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
  getPollingIntervalForTimeframe: vi.fn(() => 3600000),
}));

vi.mock('../../exchange-stream-factory', () => ({
  getKlineStreamService: vi.fn().mockResolvedValue({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

import { WatcherManager } from '../watcher-manager';
import type { ActiveWatcher, WatcherManagerDeps } from '../types';
import { db } from '../../../db';

const createDeps = (overrides: Partial<WatcherManagerDeps> = {}): WatcherManagerDeps => ({
  getCachedConfig: vi.fn().mockResolvedValue({
    isEnabled: true,
    enabledSetupTypes: '["larry_williams_9_1"]',
  }),
  queueWatcherProcessing: vi.fn(),
  ensureBtcKlineStream: vi.fn().mockResolvedValue(undefined),
  cleanupBtcKlineStreamIfNeeded: vi.fn().mockResolvedValue(undefined),
  clearCaches: vi.fn(),
  ...overrides,
});

const insertWatcherDirectly = (
  manager: WatcherManager,
  watcherId: string,
  overrides: Partial<ActiveWatcher> = {}
): void => {
  const map = manager.getActiveWatchersMap();
  map.set(watcherId, {
    walletId: 'w1',
    userId: 'u1',
    symbol: 'BTCUSDT',
    interval: '1h',
    marketType: 'FUTURES' as MarketType,
    exchange: 'BINANCE',
    enabledStrategies: ['larry_williams_9_1'],
    intervalId: setTimeout(() => {}, 0) as unknown as ReturnType<typeof setInterval>,
    lastProcessedTime: Date.now(),
    isManual: true,
    ...overrides,
  });
};

describe('WatcherManager', () => {
  let manager: WatcherManager;
  let deps: WatcherManagerDeps;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    deps = createDeps();
    manager = new WatcherManager(deps);
  });

  afterEach(() => {
    for (const watcher of manager.getActiveWatchersMap().values()) {
      clearInterval(watcher.intervalId);
      clearTimeout(watcher.intervalId);
    }
    vi.useRealTimers();
  });

  describe('pauseWatchersForWallet', () => {
    it('should add wallet to paused set', () => {
      manager.pauseWatchersForWallet('w1', 'max drawdown');

      expect(manager.isWalletPaused('w1')).toBe(true);
    });

    it('should store pause reason and timestamp', () => {
      const before = new Date();
      manager.pauseWatchersForWallet('w1', 'margin call');

      const info = manager.getPausedWalletInfo('w1');
      expect(info).toBeDefined();
      expect(info!.reason).toBe('margin call');
      expect(info!.pausedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should be a no-op if wallet is already paused', () => {
      manager.pauseWatchersForWallet('w1', 'first reason');
      manager.pauseWatchersForWallet('w1', 'second reason');

      const info = manager.getPausedWalletInfo('w1');
      expect(info!.reason).toBe('first reason');
    });

    it('should allow pausing multiple wallets independently', () => {
      manager.pauseWatchersForWallet('w1', 'reason-a');
      manager.pauseWatchersForWallet('w2', 'reason-b');

      expect(manager.isWalletPaused('w1')).toBe(true);
      expect(manager.isWalletPaused('w2')).toBe(true);
      expect(manager.getPausedWallets().size).toBe(2);
    });
  });

  describe('resumeWatchersForWallet', () => {
    it('should remove wallet from paused set', () => {
      manager.pauseWatchersForWallet('w1', 'reason');
      manager.resumeWatchersForWallet('w1');

      expect(manager.isWalletPaused('w1')).toBe(false);
    });

    it('should be a no-op if wallet is not paused', () => {
      manager.resumeWatchersForWallet('w1');
      expect(manager.isWalletPaused('w1')).toBe(false);
    });

    it('should not affect other paused wallets', () => {
      manager.pauseWatchersForWallet('w1', 'reason-a');
      manager.pauseWatchersForWallet('w2', 'reason-b');

      manager.resumeWatchersForWallet('w1');

      expect(manager.isWalletPaused('w1')).toBe(false);
      expect(manager.isWalletPaused('w2')).toBe(true);
    });

    it('should allow re-pausing after resume', () => {
      manager.pauseWatchersForWallet('w1', 'first');
      manager.resumeWatchersForWallet('w1');
      manager.pauseWatchersForWallet('w1', 'second');

      const info = manager.getPausedWalletInfo('w1');
      expect(info!.reason).toBe('second');
    });
  });

  describe('isWalletPaused', () => {
    it('should return false for unknown wallet', () => {
      expect(manager.isWalletPaused('nonexistent')).toBe(false);
    });

    it('should return true for paused wallet', () => {
      manager.pauseWatchersForWallet('w1', 'reason');
      expect(manager.isWalletPaused('w1')).toBe(true);
    });

    it('should return false after resume', () => {
      manager.pauseWatchersForWallet('w1', 'reason');
      manager.resumeWatchersForWallet('w1');
      expect(manager.isWalletPaused('w1')).toBe(false);
    });
  });

  describe('getPausedWallets', () => {
    it('should return empty map when nothing is paused', () => {
      expect(manager.getPausedWallets().size).toBe(0);
    });

    it('should return a copy of the paused wallets map', () => {
      manager.pauseWatchersForWallet('w1', 'reason');

      const copy = manager.getPausedWallets();
      copy.delete('w1');

      expect(manager.isWalletPaused('w1')).toBe(true);
    });
  });

  describe('getActiveWatchersMap', () => {
    it('should return the internal map reference', () => {
      const map = manager.getActiveWatchersMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });

    it('should reflect watchers added through startWatcher', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      const map = manager.getActiveWatchersMap();
      expect(map.size).toBe(1);
      expect(map.has('w1-BTCUSDT-1h-FUTURES')).toBe(true);
    });
  });

  describe('getActiveWatchers', () => {
    it('should return empty array when no watchers exist', () => {
      expect(manager.getActiveWatchers()).toEqual([]);
    });

    it('should return watcher info for all active watchers', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', {
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        isManual: true,
        profileId: 'p1',
        profileName: 'Test Profile',
      });

      const watchers = manager.getActiveWatchers();
      expect(watchers).toHaveLength(1);
      expect(watchers[0]).toEqual({
        watcherId: 'w1-BTCUSDT-1h-FUTURES',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        profileId: 'p1',
        profileName: 'Test Profile',
        isManual: true,
      });
    });

    it('should return multiple watchers', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { symbol: 'BTCUSDT' });
      insertWatcherDirectly(manager, 'w1-ETHUSDT-4h-FUTURES', {
        symbol: 'ETHUSDT',
        interval: '4h',
        isManual: false,
      });

      expect(manager.getActiveWatchers()).toHaveLength(2);
    });
  });

  describe('getWatcherStatus', () => {
    it('should return inactive with zero watchers for unknown wallet', () => {
      const status = manager.getWatcherStatus('w1');
      expect(status).toEqual({ active: false, watchers: 0 });
    });

    it('should count only watchers for the specified wallet', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });
      insertWatcherDirectly(manager, 'w1-ETHUSDT-1h-FUTURES', { walletId: 'w1', symbol: 'ETHUSDT' });
      insertWatcherDirectly(manager, 'w2-BTCUSDT-1h-FUTURES', { walletId: 'w2' });

      const status = manager.getWatcherStatus('w1');
      expect(status).toEqual({ active: true, watchers: 2 });
    });

    it('should report active as true when at least one watcher exists', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });
      expect(manager.getWatcherStatus('w1').active).toBe(true);
    });
  });

  describe('getDynamicWatcherCount', () => {
    it('should return 0 when no watchers exist', () => {
      expect(manager.getDynamicWatcherCount('w1')).toBe(0);
    });

    it('should count only non-manual watchers for the wallet', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1', isManual: false });
      insertWatcherDirectly(manager, 'w1-ETHUSDT-1h-FUTURES', {
        walletId: 'w1',
        symbol: 'ETHUSDT',
        isManual: true,
      });
      insertWatcherDirectly(manager, 'w1-SOLUSDT-1h-FUTURES', {
        walletId: 'w1',
        symbol: 'SOLUSDT',
        isManual: false,
      });

      expect(manager.getDynamicWatcherCount('w1')).toBe(2);
    });

    it('should not count watchers from other wallets', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1', isManual: false });
      insertWatcherDirectly(manager, 'w2-BTCUSDT-1h-FUTURES', { walletId: 'w2', isManual: false });

      expect(manager.getDynamicWatcherCount('w1')).toBe(1);
    });
  });

  describe('getManualWatcherCount', () => {
    it('should return 0 when no watchers exist', () => {
      expect(manager.getManualWatcherCount('w1')).toBe(0);
    });

    it('should count only manual watchers for the wallet', () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1', isManual: true });
      insertWatcherDirectly(manager, 'w1-ETHUSDT-1h-FUTURES', {
        walletId: 'w1',
        symbol: 'ETHUSDT',
        isManual: false,
      });
      insertWatcherDirectly(manager, 'w1-SOLUSDT-1h-FUTURES', {
        walletId: 'w1',
        symbol: 'SOLUSDT',
        isManual: true,
      });

      expect(manager.getManualWatcherCount('w1')).toBe(2);
    });
  });

  describe('stopWatcher', () => {
    it('should be a no-op if watcher does not exist', async () => {
      await manager.stopWatcher('w1', 'BTCUSDT', '1h', 'FUTURES');

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should remove watcher from active map', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.stopWatcher('w1', 'BTCUSDT', '1h', 'FUTURES');

      expect(manager.getActiveWatchersMap().has('w1-BTCUSDT-1h-FUTURES')).toBe(false);
    });

    it('should delete watcher from database', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.stopWatcher('w1', 'BTCUSDT', '1h', 'FUTURES');

      expect(db.delete).toHaveBeenCalled();
    });

    it('should call cleanupBtcKlineStreamIfNeeded', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.stopWatcher('w1', 'BTCUSDT', '1h', 'FUTURES');

      expect(deps.cleanupBtcKlineStreamIfNeeded).toHaveBeenCalledWith('1h', 'FUTURES');
    });

    it('should unsubscribe from kline stream', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.stopWatcher('w1', 'BTCUSDT', '1h', 'FUTURES');

      const { getKlineStreamService } = await import('../../exchange-stream-factory');
      expect(getKlineStreamService).toHaveBeenCalled();
    });
  });

  describe('stopAllWatchersForWallet', () => {
    it('should remove all watchers for the specified wallet', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });
      insertWatcherDirectly(manager, 'w1-ETHUSDT-1h-FUTURES', {
        walletId: 'w1',
        symbol: 'ETHUSDT',
      });
      insertWatcherDirectly(manager, 'w2-BTCUSDT-1h-FUTURES', { walletId: 'w2' });

      await manager.stopAllWatchersForWallet('w1');

      expect(manager.getActiveWatchersMap().size).toBe(1);
      expect(manager.getActiveWatchersMap().has('w2-BTCUSDT-1h-FUTURES')).toBe(true);
    });

    it('should delete watchers from database', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });

      await manager.stopAllWatchersForWallet('w1');

      expect(db.delete).toHaveBeenCalled();
    });

    it('should call clearCaches when no watchers remain', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });

      await manager.stopAllWatchersForWallet('w1');

      expect(deps.clearCaches).toHaveBeenCalled();
    });

    it('should not call clearCaches when other watchers remain', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });
      insertWatcherDirectly(manager, 'w2-BTCUSDT-1h-FUTURES', { walletId: 'w2' });

      await manager.stopAllWatchersForWallet('w1');

      expect(deps.clearCaches).not.toHaveBeenCalled();
    });

    it('should handle wallet with no watchers', async () => {
      await manager.stopAllWatchersForWallet('w1');

      expect(db.delete).toHaveBeenCalled();
      expect(deps.clearCaches).toHaveBeenCalled();
    });
  });

  describe('startWatcher', () => {
    it('should skip if watcher already exists', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(deps.getCachedConfig).not.toHaveBeenCalled();
    });

    it('should skip and remove stale DB entry if config is disabled', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({ isEnabled: false }),
      });
      manager = new WatcherManager(deps);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().size).toBe(0);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should skip if config is null', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue(null),
      });
      manager = new WatcherManager(deps);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should skip if no strategies are enabled', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({
          isEnabled: true,
          enabledSetupTypes: '[]',
        }),
      });
      manager = new WatcherManager(deps);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should create a watcher in the active map', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().has('w1-BTCUSDT-1h-FUTURES')).toBe(true);
    });

    it('should persist watcher to database by default', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it('should skip DB persist when skipDbPersist is true', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should call ensureBtcKlineStream', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(deps.ensureBtcKlineStream).toHaveBeenCalledWith('w1', 'u1', '1h', 'FUTURES');
    });

    it('should subscribe to kline stream', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      const { getKlineStreamService } = await import('../../exchange-stream-factory');
      expect(getKlineStreamService).toHaveBeenCalledWith('BINANCE', 'FUTURES');
    });

    it('should queue processing after delay', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      vi.advanceTimersByTime(3600000);

      expect(deps.queueWatcherProcessing).toHaveBeenCalledWith('w1-BTCUSDT-1h-FUTURES');
    });

    it('should use provided market type', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, false, 'SPOT');

      expect(manager.getActiveWatchersMap().has('w1-BTCUSDT-1h-SPOT')).toBe(true);
    });

    it('should set isManual on the watcher', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true, 'FUTURES', false);

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher!.isManual).toBe(false);
    });

    it('should set the watcher exchange', async () => {
      await manager.startWatcher(
        'w1', 'u1', 'BTCUSDT', '1h',
        undefined, true, 'FUTURES', true, false, false, undefined, 'INTERACTIVE_BROKERS'
      );

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher!.exchange).toBe('INTERACTIVE_BROKERS');
    });
  });

  describe('getConfigCacheStats', () => {
    it('should return initial zeroed metrics', () => {
      const stats = manager.getConfigCacheStats();
      expect(stats).toEqual({
        size: 0,
        hits: 0,
        misses: 0,
        preloads: 0,
        hitRate: 0,
      });
    });

    it('should return hitRate as 0 when no accesses', () => {
      expect(manager.getConfigCacheStats().hitRate).toBe(0);
    });
  });

  describe('resetCacheMetrics', () => {
    it('should reset all cache metrics to zero', () => {
      manager.resetCacheMetrics();

      const stats = manager.getConfigCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.preloads).toBe(0);
    });
  });

  describe('startWatcher - additional branch coverage', () => {
    it('should suppress logs when silent=true and watcher already exists', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');
      const { log: mockLog } = await import('../utils');

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, false, 'FUTURES', true, false, true);

      expect(mockLog).not.toHaveBeenCalledWith('! Watcher already exists', expect.anything());
    });

    it('should suppress logs when silent=true and config is disabled', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({ isEnabled: false }),
      });
      manager = new WatcherManager(deps);
      const { log: mockLog } = await import('../utils');

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, false, 'FUTURES', true, false, true);

      expect(mockLog).not.toHaveBeenCalledWith('! Auto-trading not enabled for wallet', expect.anything());
      expect(mockLog).not.toHaveBeenCalledWith('✗ Removed stale watcher from database', expect.anything());
    });

    it('should suppress logs when silent=true and no strategies enabled', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({
          isEnabled: true,
          enabledSetupTypes: '[]',
        }),
      });
      manager = new WatcherManager(deps);
      const { log: mockLog } = await import('../utils');

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, false, 'FUTURES', true, false, true);

      expect(mockLog).not.toHaveBeenCalledWith('! No strategies enabled', expect.anything());
    });

    it('should use profile strategies when profileId is provided and profile exists', async () => {
      const profileRow = {
        id: 'p1',
        name: 'My Profile',
        enabledSetupTypes: '["setup_a","setup_b"]',
      };

      const mockLimit = vi.fn().mockResolvedValue([profileRow]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const mockExistingLimit = vi.fn().mockResolvedValue([]);
      const mockExistingWhere = vi.fn(() => ({ limit: mockExistingLimit }));
      const mockExistingFrom = vi.fn(() => ({ where: mockExistingWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockExistingFrom } as never);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'p1');

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher).toBeDefined();
      expect(watcher!.enabledStrategies).toEqual(['setup_a', 'setup_b']);
      expect(watcher!.profileName).toBe('My Profile');
      expect(watcher!.profileId).toBe('p1');
    });

    it('should fall back to global config when profileId is provided but profile not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const mockExistingLimit = vi.fn().mockResolvedValue([]);
      const mockExistingWhere = vi.fn(() => ({ limit: mockExistingLimit }));
      const mockExistingFrom = vi.fn(() => ({ where: mockExistingWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockExistingFrom } as never);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'nonexistent-profile');

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher).toBeDefined();
      expect(watcher!.enabledStrategies).toEqual(['larry_williams_9_1']);
      expect(watcher!.profileName).toBeUndefined();
    });

    it('should fall back to global config when profileId is provided but profile not found and silent', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const mockExistingLimit = vi.fn().mockResolvedValue([]);
      const mockExistingWhere = vi.fn(() => ({ limit: mockExistingLimit }));
      const mockExistingFrom = vi.fn(() => ({ where: mockExistingWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockExistingFrom } as never);

      const { log: mockLog } = await import('../utils');

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'nonexistent-profile', false, 'FUTURES', true, false, true);

      expect(mockLog).not.toHaveBeenCalledWith('! Profile not found, falling back to global config', expect.anything());
    });

    it('should use empty array fallback when enabledSetupTypes is undefined (no profileId)', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({
          isEnabled: true,
        }),
      });
      manager = new WatcherManager(deps);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should use empty array fallback when enabledSetupTypes is undefined (profileId not found)', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({
          isEnabled: true,
        }),
      });
      manager = new WatcherManager(deps);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'missing-profile');

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should update DB when existing watcher has different profileId', async () => {
      const profileRow = {
        id: 'new-profile',
        name: 'New Profile',
        enabledSetupTypes: '["setup_a"]',
      };
      const mockProfileLimit = vi.fn().mockResolvedValue([profileRow]);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      const existingRecord = { id: 'w1-BTCUSDT-1h-FUTURES', profileId: 'old-profile' };
      const mockExistingLimit = vi.fn().mockResolvedValue([existingRecord]);
      const mockExistingWhere = vi.fn(() => ({ limit: mockExistingLimit }));
      const mockExistingFrom = vi.fn(() => ({ where: mockExistingWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockExistingFrom } as never);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'new-profile', false, 'FUTURES', true, false, false, undefined, 'BINANCE');

      expect(db.update).toHaveBeenCalled();
    });

    it('should not update DB when existing watcher has the same profileId', async () => {
      const existingRecord = { id: 'w1-BTCUSDT-1h-FUTURES', profileId: 'p1' };

      const profileRow = {
        id: 'p1',
        name: 'Same Profile',
        enabledSetupTypes: '["setup_a"]',
      };
      const mockProfileLimit = vi.fn().mockResolvedValue([profileRow]);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      const mockExistingLimit = vi.fn().mockResolvedValue([existingRecord]);
      const mockExistingWhere = vi.fn(() => ({ limit: mockExistingLimit }));
      const mockExistingFrom = vi.fn(() => ({ where: mockExistingWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockExistingFrom } as never);

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', 'p1');

      expect(db.update).not.toHaveBeenCalled();
    });

    it('should use TIME_MS.HOUR fallback for unknown interval', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '2w', undefined, true);

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-2w-FUTURES');
      expect(watcher).toBeDefined();
    });

    it('should set lastProcessedCandleOpenTime 2 candles back when targetCandleClose is set', async () => {
      const targetClose = Date.now() + 3600000;
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true, 'FUTURES', true, false, false, targetClose);

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher).toBeDefined();
      expect(watcher!.lastProcessedCandleOpenTime).toBeDefined();
    });

    it('should log rotation info when targetCandleClose is set and not silent', async () => {
      const { log: mockLog } = await import('../utils');
      const targetClose = Date.now() + 3600000;

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true, 'FUTURES', true, false, false, targetClose);

      expect(mockLog).toHaveBeenCalledWith('> [Rotation] Watcher initialized for rotation', expect.objectContaining({
        watcherId: 'w1-BTCUSDT-1h-FUTURES',
      }));
    });

    it('should not log rotation info when targetCandleClose is set but silent', async () => {
      const { log: mockLog } = await import('../utils');
      const targetClose = Date.now() + 3600000;

      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true, 'FUTURES', true, false, true, targetClose);

      expect(mockLog).not.toHaveBeenCalledWith('> [Rotation] Watcher initialized for rotation', expect.anything());
    });

    it('should set intervalId on watcher inside setTimeout callback', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true);

      vi.advanceTimersByTime(3600000);

      const watcher = manager.getActiveWatchersMap().get('w1-BTCUSDT-1h-FUTURES');
      expect(watcher).toBeDefined();
      expect(watcher!.intervalId).toBeDefined();
    });

    it('should repeatedly queue processing via setInterval after initial setTimeout', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true);

      vi.advanceTimersByTime(3600000);
      expect(deps.queueWatcherProcessing).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(3600000);
      expect(deps.queueWatcherProcessing).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(3600000);
      expect(deps.queueWatcherProcessing).toHaveBeenCalledTimes(3);
    });

    it('should handle setTimeout callback when watcher was removed before firing', async () => {
      await manager.startWatcher('w1', 'u1', 'BTCUSDT', '1h', undefined, true);

      manager.getActiveWatchersMap().delete('w1-BTCUSDT-1h-FUTURES');

      vi.advanceTimersByTime(3600000);

      expect(deps.queueWatcherProcessing).toHaveBeenCalledWith('w1-BTCUSDT-1h-FUTURES');
    });
  });

  describe('getWatcherStatusFromDb', () => {
    it('should return inactive when no persisted watchers exist', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const result = await manager.getWatcherStatusFromDb('w1');

      expect(result).toEqual({
        active: false,
        watchers: 0,
        watcherDetails: [],
      });
    });

    it('should return watcher details with profile name when profileId exists', async () => {
      const persistedWatchers = [{
        walletId: 'w1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        profileId: 'p1',
        isManual: true,
      }];

      const mockWhere = vi.fn().mockResolvedValue(persistedWatchers);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const profileResult = [{ name: 'My Profile' }];
      const mockProfileLimit = vi.fn().mockResolvedValue(profileResult);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      const result = await manager.getWatcherStatusFromDb('w1');

      expect(result.active).toBe(true);
      expect(result.watchers).toBe(1);
      expect(result.watcherDetails[0]).toEqual({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        profileId: 'p1',
        profileName: 'My Profile',
        isManual: true,
      });
    });

    it('should set profileName to undefined when profile not found in DB', async () => {
      const persistedWatchers = [{
        walletId: 'w1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        profileId: 'p-missing',
        isManual: false,
      }];

      const mockWhere = vi.fn().mockResolvedValue(persistedWatchers);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const mockProfileLimit = vi.fn().mockResolvedValue([]);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      const result = await manager.getWatcherStatusFromDb('w1');

      expect(result.watcherDetails[0]!.profileName).toBeUndefined();
    });

    it('should skip profile lookup when profileId is null', async () => {
      const persistedWatchers = [{
        walletId: 'w1',
        symbol: 'ETHUSDT',
        interval: '4h',
        marketType: null,
        profileId: null,
        isManual: true,
      }];

      const mockWhere = vi.fn().mockResolvedValue(persistedWatchers);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const result = await manager.getWatcherStatusFromDb('w1');

      expect(result.watcherDetails[0]).toEqual({
        symbol: 'ETHUSDT',
        interval: '4h',
        marketType: 'FUTURES',
        profileId: undefined,
        profileName: undefined,
        isManual: true,
      });
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple persisted watchers with mixed profileIds', async () => {
      const persistedWatchers = [
        { walletId: 'w1', symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', profileId: 'p1', isManual: true },
        { walletId: 'w1', symbol: 'ETHUSDT', interval: '1h', marketType: 'SPOT', profileId: null, isManual: false },
      ];

      const mockWhere = vi.fn().mockResolvedValue(persistedWatchers);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as never);

      const mockProfileLimit = vi.fn().mockResolvedValue([{ name: 'Profile 1' }]);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      const result = await manager.getWatcherStatusFromDb('w1');

      expect(result.watchers).toBe(2);
      expect(result.watcherDetails[0]!.profileName).toBe('Profile 1');
      expect(result.watcherDetails[1]!.profileId).toBeUndefined();
      expect(result.watcherDetails[1]!.profileName).toBeUndefined();
    });
  });

  describe('restoreWatchersFromDb', () => {
    const mockDbSelectForRestore = (persistedWatchers: unknown[], configs: unknown[] = []) => {
      const mockWatchersFrom = vi.fn().mockResolvedValue(persistedWatchers);
      vi.mocked(db.select).mockReturnValueOnce({ from: mockWatchersFrom } as never);

      if (persistedWatchers.length > 0) {
        const mockConfigWhere = vi.fn().mockResolvedValue(configs);
        const mockConfigFrom = vi.fn(() => ({ where: mockConfigWhere }));
        vi.mocked(db.select).mockReturnValueOnce({ from: mockConfigFrom } as never);
      }
    };

    const defaultConfig = {
      walletId: 'w1',
      isEnabled: true,
      enabledSetupTypes: '["larry_williams_9_1"]',
    };

    const defaultPw = {
      walletId: 'w1',
      userId: 'u1',
      symbol: 'BTCUSDT',
      interval: '1h',
      marketType: 'FUTURES',
      exchange: 'BINANCE',
      profileId: null,
      isManual: true,
    };

    it('should return early when no persisted watchers exist', async () => {
      mockDbSelectForRestore([]);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should restore watchers successfully from database', async () => {
      mockDbSelectForRestore([defaultPw], [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(1);
    });

    it('should handle prefetch failure and continue with other watchers', async () => {
      const persistedWatchers = [
        { ...defaultPw, symbol: 'FAILSYMBOL' },
        { ...defaultPw, symbol: 'BTCUSDT', isManual: false },
      ];
      mockDbSelectForRestore(persistedWatchers, [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines)
        .mockResolvedValueOnce({ success: false, error: 'Network error' } as never)
        .mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(1);
    });

    it('should handle prefetch failure with no error message (fallback to "Prefetch failed")', async () => {
      mockDbSelectForRestore([{ ...defaultPw, profileId: 'p1' }], [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: false } as never);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should handle startWatcher throwing during restore', async () => {
      mockDbSelectForRestore([defaultPw], [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      deps = createDeps({
        getCachedConfig: vi.fn().mockRejectedValue(new Error('Config fetch error')),
      });
      manager = new WatcherManager(deps);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(0);
    });

    it('should use FUTURES fallback when marketType is null', async () => {
      mockDbSelectForRestore(
        [{ ...defaultPw, interval: '4h', marketType: null, exchange: null }],
        [defaultConfig]
      );

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      await manager.restoreWatchersFromDb();

      expect(prefetchKlines).toHaveBeenCalledWith(expect.objectContaining({
        marketType: 'FUTURES',
      }));
    });

    it('should preload configs into cache for all unique wallet IDs', async () => {
      const persistedWatchers = [
        { ...defaultPw, symbol: 'BTCUSDT' },
        { ...defaultPw, symbol: 'ETHUSDT' },
        { ...defaultPw, walletId: 'w2', userId: 'u2', symbol: 'BTCUSDT' },
      ];
      const configs = [
        defaultConfig,
        { walletId: 'w2', isEnabled: true, enabledSetupTypes: '["larry_williams_9_1"]' },
      ];
      mockDbSelectForRestore(persistedWatchers, configs);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValue({ success: true, totalInDb: 500 } as never);

      await manager.restoreWatchersFromDb();

      const stats = manager.getConfigCacheStats();
      expect(stats.preloads).toBe(2);
    });

    it('should call outputStartupResults with buffer results', async () => {
      mockDbSelectForRestore([defaultPw], [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      const { outputStartupResults } = await import('../../watcher-batch-logger');

      await manager.restoreWatchersFromDb();

      expect(outputStartupResults).toHaveBeenCalled();
    });

    it('should handle persisted watcher with profileId passed to startWatcher', async () => {
      mockDbSelectForRestore([{ ...defaultPw, profileId: 'p1' }], [defaultConfig]);

      const { prefetchKlines } = await import('../../kline-prefetch');
      vi.mocked(prefetchKlines).mockResolvedValueOnce({ success: true, totalInDb: 500 } as never);

      const profileRow = {
        id: 'p1',
        name: 'Restored Profile',
        enabledSetupTypes: '["setup_x"]',
      };
      const mockProfileLimit = vi.fn().mockResolvedValue([profileRow]);
      const mockProfileWhere = vi.fn(() => ({ limit: mockProfileLimit }));
      const mockProfileFrom = vi.fn(() => ({ where: mockProfileWhere }));
      vi.mocked(db.select).mockReturnValueOnce({ from: mockProfileFrom } as never);

      await manager.restoreWatchersFromDb();

      expect(manager.getActiveWatchersMap().size).toBe(1);
    });
  });

  describe('stopWatcher - additional branch coverage', () => {
    it('should use default marketType FUTURES when not provided', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES');

      await manager.stopWatcher('w1', 'BTCUSDT', '1h');

      expect(manager.getActiveWatchersMap().has('w1-BTCUSDT-1h-FUTURES')).toBe(false);
    });
  });

  describe('stopAllWatchersForWallet - additional branch coverage', () => {
    it('should not clear caches when some watchers remain after stopping', async () => {
      insertWatcherDirectly(manager, 'w1-BTCUSDT-1h-FUTURES', { walletId: 'w1' });
      insertWatcherDirectly(manager, 'w2-ETHUSDT-1h-FUTURES', { walletId: 'w2', symbol: 'ETHUSDT' });

      await manager.stopAllWatchersForWallet('w1');

      expect(manager.getActiveWatchersMap().size).toBe(1);
      expect(deps.clearCaches).not.toHaveBeenCalled();
    });
  });

  describe('getConfigCacheStats - additional branch coverage', () => {
    it('should calculate hitRate when total accesses > 0', () => {
      const managerAny = manager as unknown as { configCacheMetrics: { hits: number; misses: number; preloads: number } };
      managerAny.configCacheMetrics.hits = 7;
      managerAny.configCacheMetrics.misses = 3;

      const stats = manager.getConfigCacheStats();
      expect(stats.hitRate).toBe(0.7);
      expect(stats.hits).toBe(7);
      expect(stats.misses).toBe(3);
    });
  });

  describe('getPausedWalletInfo', () => {
    it('should return undefined for unknown wallet', () => {
      expect(manager.getPausedWalletInfo('nonexistent')).toBeUndefined();
    });

    it('should return pause info for paused wallet', () => {
      manager.pauseWatchersForWallet('w1', 'test reason');
      const info = manager.getPausedWalletInfo('w1');
      expect(info).toBeDefined();
      expect(info!.reason).toBe('test reason');
    });
  });
});
