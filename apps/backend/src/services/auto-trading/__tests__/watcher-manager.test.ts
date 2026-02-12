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
  StartupLogBuffer: vi.fn().mockImplementation(() => ({
    setPersistedCount: vi.fn(),
    setPreloadedConfigs: vi.fn(),
    addRestoredWatcher: vi.fn(),
    getResults: vi.fn(() => ({
      watchers: [],
      persistedCount: 0,
      durationMs: 0,
      preloadedConfigs: 0,
      walletCount: 0,
    })),
  })),
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
});
