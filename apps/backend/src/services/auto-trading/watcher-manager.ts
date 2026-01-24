import type { MarketType } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import { INTERVAL_MS, TIME_MS } from '../../constants';
import { db } from '../../db';
import {
  activeWatchers as activeWatchersTable,
  autoTradingConfig,
  tradingProfiles,
} from '../../db/schema';
import { calculateRequiredKlines } from '../../utils/kline-calculator';
import { serializeError } from '../../utils/errors';
import { prefetchKlines } from '../kline-prefetch';
import {
  outputStartupResults,
  StartupLogBuffer,
} from '../watcher-batch-logger';
import type { ActiveWatcher, WatcherManagerDeps } from './types';
import { log, getPollingIntervalForTimeframe } from './utils';

export interface WalletPauseInfo {
  pausedAt: Date;
  reason: string;
}

export class WatcherManager {
  private activeWatchers: Map<string, ActiveWatcher> = new Map();
  private configCache: Map<string, { data: typeof autoTradingConfig.$inferSelect; timestamp: number }> = new Map();
  private configCacheMetrics = { hits: 0, misses: 0, preloads: 0 };
  private pausedWallets: Map<string, WalletPauseInfo> = new Map();

  constructor(private deps: WatcherManagerDeps) {}

  pauseWatchersForWallet(walletId: string, reason: string): void {
    if (this.pausedWallets.has(walletId)) {
      log('⏸️ Wallet already paused', { walletId });
      return;
    }
    this.pausedWallets.set(walletId, { pausedAt: new Date(), reason });
    log('⏸️ Watchers paused for wallet', { walletId, reason });
  }

  resumeWatchersForWallet(walletId: string): void {
    const pauseInfo = this.pausedWallets.get(walletId);
    if (!pauseInfo) return;

    this.pausedWallets.delete(walletId);
    const pausedDuration = Date.now() - pauseInfo.pausedAt.getTime();
    log('▶️ Watchers resumed for wallet', { walletId, wasReason: pauseInfo.reason, pausedDurationMs: pausedDuration });
  }

  isWalletPaused(walletId: string): boolean {
    return this.pausedWallets.has(walletId);
  }

  getPausedWalletInfo(walletId: string): WalletPauseInfo | undefined {
    return this.pausedWallets.get(walletId);
  }

  getPausedWallets(): Map<string, WalletPauseInfo> {
    return new Map(this.pausedWallets);
  }

  getActiveWatchersMap(): Map<string, ActiveWatcher> {
    return this.activeWatchers;
  }

  async startWatcher(
    walletId: string,
    userId: string,
    symbol: string,
    interval: string,
    profileId?: string,
    skipDbPersist: boolean = false,
    marketType: MarketType = 'SPOT',
    isManual: boolean = true,
    _runImmediateCheck: boolean = false,
    silent: boolean = false,
    targetCandleClose?: number
  ): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;

    if (this.activeWatchers.has(watcherId)) {
      if (!silent) log('⚠️ Watcher already exists', { watcherId });
      return;
    }

    const config = await this.deps.getCachedConfig(walletId, userId);

    if (!config || !(config as { isEnabled?: boolean }).isEnabled) {
      if (!silent) log('⚠️ Auto-trading not enabled for wallet', { walletId });
      await db
        .delete(activeWatchersTable)
        .where(eq(activeWatchersTable.walletId, walletId));
      if (!silent) log('🗑️ Removed stale watcher from database', { walletId });
      return;
    }

    let enabledStrategies: string[];
    let profileName: string | undefined;

    const configWithStrategies = config as { enabledSetupTypes?: string };

    if (profileId) {
      const [profile] = await db
        .select()
        .from(tradingProfiles)
        .where(eq(tradingProfiles.id, profileId))
        .limit(1);

      if (profile) {
        enabledStrategies = JSON.parse(profile.enabledSetupTypes) as string[];
        profileName = profile.name;
      } else {
        if (!silent) log('⚠️ Profile not found, falling back to global config', { profileId });
        enabledStrategies = JSON.parse(configWithStrategies.enabledSetupTypes ?? '[]') as string[];
      }
    } else {
      enabledStrategies = JSON.parse(configWithStrategies.enabledSetupTypes ?? '[]') as string[];
    }

    if (enabledStrategies.length === 0) {
      if (!silent) log('⚠️ No strategies enabled', { walletId, enabledStrategies, profileId });
      return;
    }

    if (!skipDbPersist) {
      const existingWatcher = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.symbol, symbol),
            eq(activeWatchersTable.interval, interval),
            eq(activeWatchersTable.marketType, marketType)
          )
        )
        .limit(1);

      if (existingWatcher.length === 0) {
        await db.insert(activeWatchersTable).values({
          id: watcherId,
          userId,
          walletId,
          symbol,
          interval,
          marketType,
          profileId: profileId ?? null,
          startedAt: new Date(),
          isManual,
        });
      } else if (existingWatcher[0] && existingWatcher[0].profileId !== profileId) {
        await db
          .update(activeWatchersTable)
          .set({ profileId: profileId ?? null })
          .where(eq(activeWatchersTable.id, watcherId));
      }
    }

    const pollIntervalMs = getPollingIntervalForTimeframe(interval);
    const now = Date.now();
    const nextCandleClose = Math.ceil(now / pollIntervalMs) * pollIntervalMs;
    const delayUntilNextCandle = nextCandleClose - now;

    const syncTimeoutId = setTimeout(() => {
      this.deps.queueWatcherProcessing(watcherId);

      const intervalId = setInterval(() => {
        this.deps.queueWatcherProcessing(watcherId);
      }, pollIntervalMs);

      const watcher = this.activeWatchers.get(watcherId);
      if (watcher) {
        watcher.intervalId = intervalId;
      }
    }, delayUntilNextCandle);

    const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
    const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;

    const isFromRotation = targetCandleClose !== undefined;
    const candlesBack = isFromRotation ? 2 : 1;
    const lastProcessedCandleOpenTime = currentCandleOpenTime - (intervalMs * candlesBack);

    if (isFromRotation && !silent) {
      log('🔄 [Rotation] Watcher initialized for rotation', {
        watcherId,
        targetCandleClose: new Date(targetCandleClose).toISOString(),
        lastProcessedCandleOpenTime: new Date(lastProcessedCandleOpenTime).toISOString(),
      });
    }

    const watcher: ActiveWatcher = {
      walletId,
      userId,
      symbol,
      interval,
      marketType,
      enabledStrategies,
      profileId,
      profileName,
      intervalId: syncTimeoutId as unknown as ReturnType<typeof setInterval>,
      lastProcessedTime: Date.now(),
      lastProcessedCandleOpenTime,
      isManual,
    };

    this.activeWatchers.set(watcherId, watcher);

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('../binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.subscribe(symbol, interval);
    } else {
      binanceKlineStreamService.subscribe(symbol, interval);
    }

    await this.deps.ensureBtcKlineStream(walletId, userId, interval, marketType);
  }

  async stopWatcher(walletId: string, symbol: string, interval: string, marketType: MarketType = 'SPOT'): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
    const watcher = this.activeWatchers.get(watcherId);

    if (!watcher) {
      log('⚠️ Watcher not found', { watcherId });
      return;
    }

    clearInterval(watcher.intervalId);
    clearTimeout(watcher.intervalId);
    this.activeWatchers.delete(watcherId);

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('../binance-kline-stream');
    if (watcher.marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.unsubscribe(symbol, interval);
    } else {
      binanceKlineStreamService.unsubscribe(symbol, interval);
    }
    log('📊 Unsubscribed from kline stream', { symbol, interval, marketType: watcher.marketType });

    await this.deps.cleanupBtcKlineStreamIfNeeded(interval, marketType);

    await db
      .delete(activeWatchersTable)
      .where(
        and(
          eq(activeWatchersTable.walletId, walletId),
          eq(activeWatchersTable.symbol, symbol),
          eq(activeWatchersTable.interval, interval),
          eq(activeWatchersTable.marketType, marketType)
        )
      );

    log('🔴 Watcher stopped', { watcherId, marketType });
  }

  async stopAllWatchersForWallet(walletId: string): Promise<void> {
    const watchersToStop: string[] = [];

    for (const [watcherId, watcher] of this.activeWatchers) {
      if (watcher.walletId === walletId) {
        watchersToStop.push(watcherId);
      }
    }

    for (const watcherId of watchersToStop) {
      const watcher = this.activeWatchers.get(watcherId);
      if (watcher) {
        clearInterval(watcher.intervalId);
        this.activeWatchers.delete(watcherId);
      }
    }

    await db
      .delete(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    log('🔴 All watchers stopped for wallet', { walletId, count: watchersToStop.length });

    if (this.activeWatchers.size === 0) {
      this.deps.clearCaches();
      log('🧹 Caches cleared - no active watchers');
    }
  }

  getActiveWatchers(): { watcherId: string; symbol: string; interval: string; marketType: MarketType; profileId?: string; profileName?: string; isManual: boolean }[] {
    return Array.from(this.activeWatchers.entries()).map(([watcherId, watcher]) => ({
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
      marketType: watcher.marketType,
      profileId: watcher.profileId,
      profileName: watcher.profileName,
      isManual: watcher.isManual,
    }));
  }

  getWatcherStatus(walletId: string): { active: boolean; watchers: number } {
    let count = 0;
    for (const watcher of this.activeWatchers.values()) {
      if (watcher.walletId === walletId) {
        count++;
      }
    }
    return { active: count > 0, watchers: count };
  }

  async getWatcherStatusFromDb(walletId: string): Promise<{ active: boolean; watchers: number; watcherDetails: { symbol: string; interval: string; marketType: MarketType; profileId?: string; profileName?: string; isManual: boolean }[] }> {
    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    const watcherDetails: { symbol: string; interval: string; marketType: MarketType; profileId?: string; profileName?: string; isManual: boolean }[] = [];

    for (const w of persistedWatchers) {
      let profileName: string | undefined;
      if (w.profileId) {
        const [profile] = await db
          .select({ name: tradingProfiles.name })
          .from(tradingProfiles)
          .where(eq(tradingProfiles.id, w.profileId))
          .limit(1);
        profileName = profile?.name;
      }
      watcherDetails.push({
        symbol: w.symbol,
        interval: w.interval,
        marketType: (w.marketType as MarketType) ?? 'SPOT',
        profileId: w.profileId ?? undefined,
        profileName,
        isManual: w.isManual,
      });
    }

    return {
      active: persistedWatchers.length > 0,
      watchers: persistedWatchers.length,
      watcherDetails,
    };
  }

  async restoreWatchersFromDb(): Promise<void> {
    const startupBuffer = new StartupLogBuffer();

    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable);

    if (persistedWatchers.length === 0) {
      return;
    }

    startupBuffer.setPersistedCount(persistedWatchers.length);

    const walletIds = [...new Set(persistedWatchers.map(w => w.walletId))];
    if (walletIds.length > 0) {
      const configs = await db
        .select()
        .from(autoTradingConfig)
        .where(inArray(autoTradingConfig.walletId, walletIds));

      for (const config of configs) {
        this.configCache.set(config.walletId, { data: config, timestamp: Date.now() });
        this.configCacheMetrics.preloads++;
      }
      startupBuffer.setPreloadedConfigs(configs.length, walletIds.length);
    }

    const requiredKlines = calculateRequiredKlines();
    const pollIntervalMs = getPollingIntervalForTimeframe(persistedWatchers[0]?.interval ?? '4h');
    const now = Date.now();
    const nextCandleClose = new Date(Math.ceil(now / pollIntervalMs) * pollIntervalMs);

    for (const pw of persistedWatchers) {
      const marketType = (pw.marketType as MarketType) ?? 'SPOT';

      const result = await prefetchKlines({
        symbol: pw.symbol,
        interval: pw.interval,
        marketType,
        targetCount: requiredKlines,
        silent: false,
      });

      if (!result.success) {
        startupBuffer.addRestoredWatcher({
          symbol: pw.symbol,
          interval: pw.interval,
          marketType,
          profileId: pw.profileId ?? undefined,
          isManual: pw.isManual,
          status: 'failed',
          error: result.error ?? 'Prefetch failed',
        });
        continue;
      }

      try {
        await this.startWatcher(
          pw.walletId,
          pw.userId,
          pw.symbol,
          pw.interval,
          pw.profileId ?? undefined,
          true,
          marketType,
          pw.isManual,
          false,
          true
        );

        startupBuffer.addRestoredWatcher({
          symbol: pw.symbol,
          interval: pw.interval,
          marketType,
          profileId: pw.profileId ?? undefined,
          isManual: pw.isManual,
          status: 'success',
          totalKlinesInDb: result.totalInDb,
          nextCandleClose,
        });
      } catch (error) {
        startupBuffer.addRestoredWatcher({
          symbol: pw.symbol,
          interval: pw.interval,
          marketType,
          profileId: pw.profileId ?? undefined,
          isManual: pw.isManual,
          status: 'failed',
          error: serializeError(error),
        });
      }
    }

    const results = startupBuffer.getResults();
    outputStartupResults(results.watchers, results.persistedCount, results.durationMs, results.preloadedConfigs, results.walletCount);
  }

  getDynamicWatcherCount(walletId: string): number {
    let count = 0;
    for (const watcher of this.activeWatchers.values()) {
      if (watcher.walletId === walletId && !watcher.isManual) {
        count++;
      }
    }
    return count;
  }

  getManualWatcherCount(walletId: string): number {
    let count = 0;
    for (const watcher of this.activeWatchers.values()) {
      if (watcher.walletId === walletId && watcher.isManual) {
        count++;
      }
    }
    return count;
  }

  getConfigCacheStats(): { size: number; hits: number; misses: number; preloads: number; hitRate: number } {
    const total = this.configCacheMetrics.hits + this.configCacheMetrics.misses;
    return {
      size: this.configCache.size,
      hits: this.configCacheMetrics.hits,
      misses: this.configCacheMetrics.misses,
      preloads: this.configCacheMetrics.preloads,
      hitRate: total > 0 ? this.configCacheMetrics.hits / total : 0,
    };
  }

  resetCacheMetrics(): void {
    this.configCacheMetrics = { hits: 0, misses: 0, preloads: 0 };
  }
}
