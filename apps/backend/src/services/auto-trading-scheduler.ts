import type { ExchangeId, Interval, Kline, MarketType, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { AUTO_TRADING_CONFIG, TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    AUTO_TRADING_CACHE,
    AUTO_TRADING_ROTATION,
    AUTO_TRADING_TIMING,
    INTERVAL_MS,
    TIME_MS,
} from '../constants';
import { db } from '../db';
import {
    activeWatchers as activeWatchersTable,
    autoTradingConfig,
    klines,
    tradeExecutions,
    tradingProfiles,
    wallets,
} from '../db/schema';
import { serializeError } from '../utils/errors';
import { calculateRequiredKlines } from '../utils/kline-calculator';
import { parseDynamicSymbolExcluded } from '../utils/profile-transformers';
import {
    getDynamicSymbolRotationService,
    getIntervalMs as getRotationIntervalMs,
    type RotationConfig,
    type RotationResult,
} from './dynamic-symbol-rotation';
import { getKlineMaintenance } from './kline-maintenance';
import { prefetchKlines } from './kline-prefetch';
import { opportunityCostManagerService } from './opportunity-cost-manager';
import {
    outputStartupResults,
    StartupLogBuffer,
    WatcherLogBuffer,
} from './watcher-batch-logger';
import {
    SignalProcessor,
    OrderExecutor,
    type ActiveWatcher as ModuleActiveWatcher,
} from './auto-trading/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');
const LOG_FILE = path.join(__dirname, '../../logs/auto-trading.log');

const ensureLogDir = (): void => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

const log = (message: string, data?: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  const logLine = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}`
    : `[${timestamp}] ${message}`;

  console.log(`[Auto-Trading] ${logLine}`);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${logLine}\n`);
  } catch (error) {
    console.error('[Auto-Trading] Failed to write to log file:', serializeError(error));
  }
};

interface ActiveWatcher {
  walletId: string;
  userId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
  exchange: ExchangeId;
  enabledStrategies: string[];
  profileId?: string;
  profileName?: string;
  intervalId: ReturnType<typeof setInterval>;
  lastProcessedTime: number;
  lastProcessedCandleOpenTime?: number;
  isManual: boolean;
}

const getPollingIntervalForTimeframe = (interval: string): number => {
  const intervalMs = INTERVAL_MS[interval as Interval];
  if (!intervalMs) {
    log(`! Unknown interval ${interval}, defaulting to 1 minute polling`);
    return TIME_MS.MINUTE;
  }
  return Math.max(intervalMs, TIME_MS.MINUTE);
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = AUTO_TRADING_CACHE.DEFAULT_TTL_MS;

const MIN_ROTATION_ANTICIPATION_MS = AUTO_TRADING_ROTATION.MIN_ANTICIPATION_MS;
const MAX_ROTATION_ANTICIPATION_MS = AUTO_TRADING_ROTATION.MAX_ANTICIPATION_MS;
const MIN_ROTATION_PREPARATION_TIME_MS = AUTO_TRADING_ROTATION.MIN_PREPARATION_TIME_MS;

const getRotationAnticipationMs = (interval: string): number => {
  const intervalMs = INTERVAL_MS[interval as Interval] ?? TIME_MS.HOUR;
  const anticipation = Math.floor(intervalMs * 0.05);
  return Math.max(MIN_ROTATION_ANTICIPATION_MS, Math.min(anticipation, MAX_ROTATION_ANTICIPATION_MS));
};

interface WalletRotationState {
  config: RotationConfig;
  userId: string;
  profileId?: string;
  lastCandleCloseTime: number;
  lastRotationCandleClose: number;
}

const getRotationStateKey = (walletId: string, interval: string): string =>
  `${walletId}:${interval}`;

const getCandleCloseTime = (interval: string, timestamp: number = Date.now()): number => {
  const intervalMs = getRotationIntervalMs(interval);
  const candleOpenTime = Math.floor(timestamp / intervalMs) * intervalMs;
  return candleOpenTime + intervalMs;
};

const getNextCandleCloseTime = (interval: string, timestamp: number = Date.now()): number => {
  return getCandleCloseTime(interval, timestamp) + getRotationIntervalMs(interval);
};

export interface WalletPauseInfo {
  pausedAt: Date;
  reason: string;
}

export class AutoTradingScheduler {
  private activeWatchers: Map<string, ActiveWatcher> = new Map();
  private pausedWallets: Map<string, WalletPauseInfo> = new Map();

  private btcKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private htfKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private fundingRateCache: Map<string, CacheEntry<number>> = new Map();
  private configCache: Map<string, CacheEntry<typeof autoTradingConfig.$inferSelect>> = new Map();
  private readonly CONFIG_CACHE_TTL_MS = AUTO_TRADING_CACHE.CONFIG_TTL_MS;
  private configCacheMetrics = { hits: 0, misses: 0, preloads: 0 };
  private readonly FUNDING_CACHE_TTL_MS = AUTO_TRADING_CACHE.FUNDING_RATE_TTL_MS;

  private rotationStates: Map<string, WalletRotationState> = new Map();
  private isCheckingRotation: Set<string> = new Set();
  private rotationPendingWatchers = new Map<string, { addedAt: number; targetCandleClose: number }>();
  private recentlyRotatedWatchers = new Map<string, number>();
  private anticipationCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly ANTICIPATION_CHECK_INTERVAL_MS = AUTO_TRADING_TIMING.ANTICIPATION_CHECK_INTERVAL_MS;

  private signalProcessor: SignalProcessor;
  private orderExecutor: OrderExecutor;

  constructor() {
    this.orderExecutor = new OrderExecutor({
      getBtcKlines: (interval: string, marketType: MarketType) => this.getBtcKlines(interval, marketType),
      getHtfKlines: (symbol: string, htfInterval: string, marketType: MarketType) => this.getHtfKlines(symbol, htfInterval, marketType),
      getCachedFundingRate: (symbol: string) => this.getCachedFundingRate(symbol),
      getCachedConfig: (walletId: string, userId?: string) => this.getCachedConfig(walletId, userId),
      getWatcherStatus: (walletId: string) => this.getWatcherStatus(walletId),
    });

    this.signalProcessor = new SignalProcessor(
      {
        getActiveWatchers: () => this.activeWatchers as Map<string, ModuleActiveWatcher>,
        executeSetupSafe: (watcher, setup, strategies, cycleKlines, logBuffer) =>
          this.orderExecutor.executeSetupSafe(
            watcher as ActiveWatcher,
            setup as TradingSetup,
            strategies as StrategyDefinition[],
            cycleKlines,
            logBuffer as WatcherLogBuffer
          ),
        isWatcherRecentlyRotated: (watcherId: string) => this.isWatcherRecentlyRotated(watcherId),
        getRotationPendingWatcher: (watcherId: string) => this.rotationPendingWatchers.get(watcherId),
        deleteRotationPendingWatcher: (watcherId: string) => this.rotationPendingWatchers.delete(watcherId),
        incrementBarsForOpenTrades: (symbol: string, interval: string, currentPrice: number) =>
          this.incrementBarsForOpenTrades(symbol, interval, currentPrice),
        checkAllRotationsOnce: () => this.checkAllRotationsOnce(),
        getConfigCacheStats: () => this.getConfigCacheStats(),
        isWalletPaused: (walletId: string) => this.isWalletPaused(walletId),
        pauseWatchersForWallet: (walletId: string, reason: string) => this.pauseWatchersForWallet(walletId, reason),
        resumeWatchersForWallet: (walletId: string) => this.resumeWatchersForWallet(walletId),
      },
      { strategiesDir: STRATEGIES_DIR }
    );
  }

  pauseWatchersForWallet(walletId: string, reason: string): void {
    if (this.pausedWallets.has(walletId)) {
      log('~ [Scheduler] Wallet already paused', { walletId });
      return;
    }
    this.pausedWallets.set(walletId, { pausedAt: new Date(), reason });
    log('~ [Scheduler] Watchers paused for wallet', { walletId, reason });
  }

  resumeWatchersForWallet(walletId: string): void {
    const pauseInfo = this.pausedWallets.get(walletId);
    if (!pauseInfo) return;

    this.pausedWallets.delete(walletId);
    const pausedDurationMs = Date.now() - pauseInfo.pausedAt.getTime();
    log('✓ [Scheduler] Watchers resumed for wallet', { walletId, wasReason: pauseInfo.reason, pausedDurationMs });
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

  private isCacheValid<T>(cache: CacheEntry<T> | undefined): cache is CacheEntry<T> {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL_MS;
  }

  private async getBtcKlines(interval: string, marketType: MarketType = 'FUTURES'): Promise<Kline[]> {
    const cacheKey = `BTCUSDT-${interval}-${marketType}`;
    const cached = this.btcKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const btcKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, 'BTCUSDT'),
        eq(klines.interval, interval),
        eq(klines.marketType, marketType)
      ),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    const mappedKlines: Kline[] = btcKlines.reverse().map((k) => ({
      symbol: k.symbol,
      interval: k.interval as Interval,
      openTime: k.openTime.getTime(),
      closeTime: k.closeTime.getTime(),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume ?? '0',
      trades: k.trades ?? 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
    }));

    this.btcKlinesCache.set(cacheKey, { data: mappedKlines, timestamp: Date.now() });
    return mappedKlines;
  }

  private async getHtfKlines(symbol: string, htfInterval: string, marketType: MarketType = 'FUTURES'): Promise<Kline[]> {
    const cacheKey = `${symbol}-${htfInterval}-${marketType}`;
    const cached = this.htfKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const htfKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, htfInterval),
        eq(klines.marketType, marketType)
      ),
      orderBy: [desc(klines.openTime)],
      limit: 300,
    });

    const mappedKlines: Kline[] = htfKlines.reverse().map((k) => ({
      symbol: k.symbol,
      interval: k.interval as Interval,
      openTime: k.openTime.getTime(),
      closeTime: k.closeTime.getTime(),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume ?? '0',
      trades: k.trades ?? 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
    }));

    this.htfKlinesCache.set(cacheKey, { data: mappedKlines, timestamp: Date.now() });
    return mappedKlines;
  }

  private clearCaches(): void {
    this.btcKlinesCache.clear();
    this.htfKlinesCache.clear();
    this.fundingRateCache.clear();
    this.configCache.clear();
  }

  private btcStreamSubscribed: Set<string> = new Set();

  private async ensureBtcKlineStream(
    walletId: string,
    userId: string,
    interval: string,
    marketType: MarketType
  ): Promise<void> {
    const config = await this.getCachedConfig(walletId, userId);
    if (!config?.useBtcCorrelationFilter) return;

    const btcKey = `BTCUSDT-${interval}-${marketType}`;
    if (this.btcStreamSubscribed.has(btcKey)) return;

    const hasBtcWatcher = Array.from(this.activeWatchers.values()).some(
      (w) => w.symbol === 'BTCUSDT' && w.interval === interval && w.marketType === marketType
    );

    if (hasBtcWatcher) return;

    const requiredKlines = calculateRequiredKlines();

    await prefetchKlines({
      symbol: 'BTCUSDT',
      interval,
      marketType,
      targetCount: requiredKlines,
      silent: true,
    });

    try {
      const klineMaintenance = getKlineMaintenance();
      await klineMaintenance.forceCheckSymbol('BTCUSDT', interval as Interval, marketType);
    } catch (error) {
      log('! [BTC Correlation] Maintenance check failed for BTCUSDT', { error: serializeError(error) });
    }

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('./binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.subscribe('BTCUSDT', interval);
    } else {
      binanceKlineStreamService.subscribe('BTCUSDT', interval);
    }

    this.btcStreamSubscribed.add(btcKey);
  }

  private async cleanupBtcKlineStreamIfNeeded(interval: string, marketType: MarketType): Promise<void> {
    const btcKey = `BTCUSDT-${interval}-${marketType}`;
    if (!this.btcStreamSubscribed.has(btcKey)) return;

    const hasActiveWatchersForInterval = Array.from(this.activeWatchers.values()).some(
      (w) => w.interval === interval && w.marketType === marketType
    );

    if (hasActiveWatchersForInterval) return;

    const hasBtcWatcher = Array.from(this.activeWatchers.values()).some(
      (w) => w.symbol === 'BTCUSDT' && w.interval === interval && w.marketType === marketType
    );

    if (hasBtcWatcher) return;

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('./binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.unsubscribe('BTCUSDT', interval);
    } else {
      binanceKlineStreamService.unsubscribe('BTCUSDT', interval);
    }

    this.btcStreamSubscribed.delete(btcKey);
    log('> Unsubscribed from BTCUSDT kline stream (no more watchers)', { interval, marketType });
  }

  private async getCachedConfig(walletId: string, userId?: string): Promise<typeof autoTradingConfig.$inferSelect | null> {
    const cacheKey = walletId;
    const cached = this.configCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CONFIG_CACHE_TTL_MS) {
      this.configCacheMetrics.hits++;
      return cached.data;
    }

    this.configCacheMetrics.misses++;

    const whereClause = userId
      ? and(eq(autoTradingConfig.walletId, walletId), eq(autoTradingConfig.userId, userId))
      : eq(autoTradingConfig.walletId, walletId);

    const [config] = await db
      .select()
      .from(autoTradingConfig)
      .where(whereClause)
      .limit(1);

    if (config) {
      this.configCache.set(cacheKey, { data: config, timestamp: Date.now() });
    }
    return config ?? null;
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

  invalidateConfigCache(walletId: string): void {
    this.configCache.delete(walletId);
  }

  private startAnticipationTimer(): void {
    if (this.anticipationCheckIntervalId) return;

    this.anticipationCheckIntervalId = setInterval(() => {
      void this.checkAnticipatedRotations();
    }, this.ANTICIPATION_CHECK_INTERVAL_MS);
  }

  private stopAnticipationTimer(): void {
    if (!this.anticipationCheckIntervalId) return;

    clearInterval(this.anticipationCheckIntervalId);
    this.anticipationCheckIntervalId = null;

    log('✗ [DynamicRotation] Stopped anticipation timer');
  }

  private async checkAnticipatedRotations(): Promise<void> {
    if (this.rotationStates.size === 0) return;

    const now = Date.now();

    for (const [stateKey, state] of this.rotationStates.entries()) {
      if (this.isCheckingRotation.has(stateKey)) continue;

      const anticipationMs = getRotationAnticipationMs(state.config.interval);
      const currentCandleClose = getCandleCloseTime(state.config.interval, now);
      const timeUntilCurrentClose = currentCandleClose - now;

      const isInRotationWindow = timeUntilCurrentClose > 0 &&
                                 timeUntilCurrentClose <= anticipationMs &&
                                 timeUntilCurrentClose >= MIN_ROTATION_PREPARATION_TIME_MS;

      if (isInRotationWindow && state.lastRotationCandleClose !== currentCandleClose) {
        log('> [DynamicRotation] Anticipating rotation', {
          stateKey,
          interval: state.config.interval,
          marketType: state.config.marketType,
          timeUntilClose: `${Math.round(timeUntilCurrentClose / 1000)}s`,
          targetCandleClose: new Date(currentCandleClose).toISOString(),
        });

        this.isCheckingRotation.add(stateKey);

        try {
          const walletId = stateKey.split(':')[0]!;
          const rotationService = getDynamicSymbolRotationService();

          if (state.config.capitalRequirement) {
            const [wallet] = await db
              .select({ currentBalance: wallets.currentBalance })
              .from(wallets)
              .where(eq(wallets.id, walletId))
              .limit(1);

            if (wallet) {
              state.config.capitalRequirement.walletBalance = parseFloat(wallet.currentBalance ?? '0');
            }
          }

          const result = await rotationService.executeRotation(
            walletId,
            state.userId,
            state.config
          );

          if (result.added.length > 0 || result.removed.length > 0) {
            log('> [DynamicRotation] Applying anticipated rotation', {
              walletId,
              added: result.added.length,
              removed: result.removed.length,
              targetCandleClose: new Date(currentCandleClose).toISOString(),
            });

            await this.applyRotationWithQueue(
              walletId,
              state.userId,
              result,
              state.config.interval,
              state.profileId,
              state.config.marketType,
              currentCandleClose
            );
          }

          state.lastRotationCandleClose = currentCandleClose;
        } catch (error) {
          log('✗ [DynamicRotation] Anticipated rotation failed', {
            stateKey,
            error: serializeError(error),
          });
        } finally {
          this.isCheckingRotation.delete(stateKey);
        }
      }
    }
  }

  private async checkAllRotationsOnce(): Promise<string[]> {
    const allAddedWatcherIds: string[] = [];

    if (this.rotationStates.size === 0) {
      return allAddedWatcherIds;
    }

    const now = Date.now();
    const rotationsToExecute: Array<{ stateKey: string; state: WalletRotationState; targetCandleClose: number; isAnticipated: boolean }> = [];

    for (const [stateKey, state] of this.rotationStates.entries()) {
      if (this.isCheckingRotation.has(stateKey)) continue;

      const intervalMs = INTERVAL_MS[state.config.interval as Interval] ?? TIME_MS.HOUR;
      const currentCandleClose = getCandleCloseTime(state.config.interval, now);
      const previousCandleClose = currentCandleClose - intervalMs;
      const isNewCandle = currentCandleClose > state.lastCandleCloseTime;

      if (isNewCandle && state.lastRotationCandleClose !== previousCandleClose) {
        rotationsToExecute.push({ stateKey, state, targetCandleClose: previousCandleClose, isAnticipated: false });
      }
    }

    if (rotationsToExecute.length === 0) {
      return allAddedWatcherIds;
    }

    log('> [DynamicRotation] Checking rotations', {
      count: rotationsToExecute.length,
      wallets: rotationsToExecute.map(r => r.state.config.marketType).join(', '),
      anticipated: rotationsToExecute.filter(r => r.isAnticipated).length,
    });

    for (const { stateKey, state, targetCandleClose, isAnticipated } of rotationsToExecute) {
      this.isCheckingRotation.add(stateKey);

      try {
        const walletId = stateKey.split(':')[0]!;
        const rotationService = getDynamicSymbolRotationService();

        if (state.config.capitalRequirement) {
          const [wallet] = await db
            .select({ currentBalance: wallets.currentBalance })
            .from(wallets)
            .where(eq(wallets.id, walletId))
            .limit(1);

          if (wallet) {
            state.config.capitalRequirement.walletBalance = parseFloat(wallet.currentBalance ?? '0');
          }
        }

        const result = await rotationService.executeRotation(
          walletId,
          state.userId,
          state.config
        );

        if (result.added.length > 0 || result.removed.length > 0) {
          log('> [DynamicRotation] Applying rotation', {
            walletId,
            added: result.added.length,
            removed: result.removed.length,
            anticipated: isAnticipated,
            targetCandleClose: new Date(targetCandleClose).toISOString(),
          });

          const addedIds = await this.applyRotationWithQueue(
            walletId,
            state.userId,
            result,
            state.config.interval,
            state.profileId,
            state.config.marketType,
            targetCandleClose
          );
          allAddedWatcherIds.push(...addedIds);
        }

        state.lastCandleCloseTime = getCandleCloseTime(state.config.interval, now);
        state.lastRotationCandleClose = targetCandleClose;
      } catch (error) {
        log('✗ [DynamicRotation] Rotation check failed', {
          stateKey,
          error: serializeError(error),
        });
      } finally {
        this.isCheckingRotation.delete(stateKey);
      }
    }

    return allAddedWatcherIds;
  }

  private async applyRotationWithQueue(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'FUTURES',
    targetCandleClose?: number
  ): Promise<string[]> {
    const addedWatcherIds: string[] = [];

    for (const symbol of result.removed) {
      await this.stopWatcher(walletId, symbol, interval, marketType);
    }

    const symbolsToAdd = result.added.filter(symbol => {
      const existingWatcher = this.activeWatchers.get(`${walletId}-${symbol}-${interval}-${marketType}`);
      return !existingWatcher;
    });

    if (symbolsToAdd.length > 0) {
      log('> [DynamicRotation] Backfilling new symbols', {
        count: symbolsToAdd.length,
        symbols: symbolsToAdd.join(', '),
        targetCandleClose: targetCandleClose ? new Date(targetCandleClose).toISOString() : 'not set',
      });

      const klineMaintenance = getKlineMaintenance();

      const requiredKlinesForRotation = calculateRequiredKlines();

      await Promise.all(
        symbolsToAdd.map(async (symbol) => {
          log('> [DynamicRotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForRotation });
          const prefetchResult = await prefetchKlines({
            symbol,
            interval,
            marketType,
            targetCount: requiredKlinesForRotation,
            silent: false,
            forRotation: true,
          });
          log('> [DynamicRotation] Prefetch result', {
            symbol,
            success: prefetchResult.success,
            downloaded: prefetchResult.downloaded,
            totalInDb: prefetchResult.totalInDb,
            gaps: prefetchResult.gaps,
            alreadyComplete: prefetchResult.alreadyComplete,
            error: prefetchResult.error,
          });
          await klineMaintenance.forceCheckSymbol(symbol, interval as Interval, marketType);
        })
      );
    }

    for (const symbol of symbolsToAdd) {
      const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
      await this.startWatcher(walletId, userId, symbol, interval, profileId, false, marketType, false, false, true, targetCandleClose);
      addedWatcherIds.push(watcherId);

      this.recentlyRotatedWatchers.set(watcherId, Date.now());

      if (targetCandleClose) {
        this.rotationPendingWatchers.set(watcherId, {
          addedAt: Date.now(),
          targetCandleClose,
        });
      }
    }

    return addedWatcherIds;
  }

  private async getCachedFundingRate(symbol: string): Promise<number | null> {
    const cached = this.fundingRateCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.FUNDING_CACHE_TTL_MS) {
      return cached.data;
    }

    const { getBinanceFuturesDataService } = await import('./binance-futures-data');
    const markPrice = await getBinanceFuturesDataService().getMarkPrice(symbol);
    const rate = markPrice?.lastFundingRate ?? null;

    if (rate !== null) {
      this.fundingRateCache.set(symbol, { data: rate, timestamp: Date.now() });
    }
    return rate;
  }

  private queueWatcherProcessing(watcherId: string): void {
    this.signalProcessor.queueWatcherProcessing(watcherId);
  }
  private isWatcherRecentlyRotated(watcherId: string): boolean {
    const rotatedAt = this.recentlyRotatedWatchers.get(watcherId);
    if (!rotatedAt) return false;

    const maxAge = 2 * TIME_MS.HOUR;
    if (Date.now() - rotatedAt > maxAge) {
      this.recentlyRotatedWatchers.delete(watcherId);
      return false;
    }
    return true;
  }

  private async incrementBarsForOpenTrades(symbol: string, interval: string, currentPrice: number): Promise<void> {
    const openTrades = await db
      .select()
      .from(tradeExecutions)
      .where(and(
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.entryInterval, interval),
        eq(tradeExecutions.status, 'open')
      ));

    for (const trade of openTrades) {
      await opportunityCostManagerService.incrementBarsInTrade(trade.id, currentPrice);
    }
  }

  async startWatcher(
    walletId: string,
    userId: string,
    symbol: string,
    interval: string,
    profileId?: string,
    skipDbPersist: boolean = false,
    marketType: MarketType = 'FUTURES',
    isManual: boolean = true,
    _runImmediateCheck: boolean = false,
    silent: boolean = false,
    targetCandleClose?: number,
    exchange: ExchangeId = 'BINANCE'
  ): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;

    if (this.activeWatchers.has(watcherId)) {
      if (!silent) log('! Watcher already exists', { watcherId });
      return;
    }

    const config = await this.getCachedConfig(walletId, userId);

    if (!config?.isEnabled) {
      if (!silent) log('! Auto-trading not enabled for wallet', { walletId });
      await db
        .delete(activeWatchersTable)
        .where(eq(activeWatchersTable.walletId, walletId));
      if (!silent) log('✗ Removed stale watcher from database', { walletId });
      return;
    }

    let enabledStrategies: string[];
    let profileName: string | undefined;

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
        if (!silent) log('! Profile not found, falling back to global config', { profileId });
        enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
      }
    } else {
      enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
    }

    if (enabledStrategies.length === 0) {
      if (!silent) log('! No strategies enabled', { walletId, enabledStrategies, profileId });
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
          exchange,
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
      this.queueWatcherProcessing(watcherId);

      const intervalId = setInterval(() => {
        this.queueWatcherProcessing(watcherId);
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
      log('> [Rotation] Watcher initialized for rotation', {
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
      exchange,
      enabledStrategies,
      profileId,
      profileName,
      intervalId: syncTimeoutId as unknown as ReturnType<typeof setInterval>,
      lastProcessedTime: Date.now(),
      lastProcessedCandleOpenTime,
      isManual,
    };

    this.activeWatchers.set(watcherId, watcher);

    const { getKlineStreamService } = await import('./exchange-stream-factory');
    const streamService = await getKlineStreamService(exchange, marketType);
    streamService.subscribe(symbol, interval);

    await this.ensureBtcKlineStream(walletId, userId, interval, marketType);

  }

  async stopWatcher(walletId: string, symbol: string, interval: string, marketType: MarketType = 'FUTURES'): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
    const watcher = this.activeWatchers.get(watcherId);

    if (!watcher) {
      log('! Watcher not found', { watcherId });
      return;
    }

    clearInterval(watcher.intervalId);
    clearTimeout(watcher.intervalId);
    this.activeWatchers.delete(watcherId);

    const { getKlineStreamService } = await import('./exchange-stream-factory');
    const streamService = await getKlineStreamService(watcher.exchange, watcher.marketType);
    streamService.unsubscribe(symbol, interval);
    log('> Unsubscribed from kline stream', { symbol, interval, marketType: watcher.marketType, exchange: watcher.exchange });

    await this.cleanupBtcKlineStreamIfNeeded(interval, marketType);

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

    log('✗ Watcher stopped', { watcherId, marketType });
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

    log('✗ All watchers stopped for wallet', { walletId, count: watchersToStop.length });

    if (this.activeWatchers.size === 0) {
      this.clearCaches();
      log('>Caches cleared - no active watchers');
    }
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

  getActiveWatchers(): Array<{ watcherId: string; symbol: string; interval: string; marketType: MarketType; exchange: ExchangeId; profileId?: string; profileName?: string; isManual: boolean }> {
    const result: Array<{ watcherId: string; symbol: string; interval: string; marketType: MarketType; exchange: ExchangeId; profileId?: string; profileName?: string; isManual: boolean }> = [];
    for (const [watcherId, watcher] of this.activeWatchers.entries()) {
      result.push({
        watcherId,
        symbol: watcher.symbol,
        interval: watcher.interval,
        marketType: watcher.marketType,
        exchange: watcher.exchange,
        profileId: watcher.profileId,
        profileName: watcher.profileName,
        isManual: watcher.isManual,
      });
    }
    return result;
  }

  async getWatcherStatusFromDb(walletId: string): Promise<{ active: boolean; watchers: number; watcherDetails: { symbol: string; interval: string; marketType: MarketType; exchange: ExchangeId; profileId?: string; profileName?: string; isManual: boolean }[] }> {
    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    const watcherDetails: { symbol: string; interval: string; marketType: MarketType; exchange: ExchangeId; profileId?: string; profileName?: string; isManual: boolean }[] = [];

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
        marketType: (w.marketType as MarketType) ?? 'FUTURES',
        exchange: (w.exchange as ExchangeId) ?? 'BINANCE',
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
      const marketType = (pw.marketType as MarketType) ?? 'FUTURES';
      const exchange = (pw.exchange as ExchangeId) ?? 'BINANCE';

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
          true,
          undefined,
          exchange
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

    await this.restoreRotationStates(persistedWatchers);
  }

  private async restoreRotationStates(
    persistedWatchers: Array<{
      walletId: string;
      userId: string;
      interval: string;
      marketType: string | null;
      isManual: boolean;
      profileId: string | null;
    }>
  ): Promise<void> {
    const dynamicWatchersByWallet = new Map<string, {
      userId: string;
      interval: string;
      marketType: MarketType;
      profileId?: string;
    }>();

    for (const pw of persistedWatchers) {
      if (pw.isManual) continue;

      const key = `${pw.walletId}:${pw.interval}`;
      if (!dynamicWatchersByWallet.has(key)) {
        dynamicWatchersByWallet.set(key, {
          userId: pw.userId,
          interval: pw.interval,
          marketType: (pw.marketType as MarketType) ?? 'FUTURES',
          profileId: pw.profileId ?? undefined,
        });
      }
    }

    if (dynamicWatchersByWallet.size === 0) {
      log('> [Startup] No dynamic watchers to restore rotation for');
      return;
    }

    const walletIds = [...new Set([...dynamicWatchersByWallet.keys()].map(k => k.split(':')[0]!))].filter(Boolean);

    const configs = await db
      .select()
      .from(autoTradingConfig)
      .where(inArray(autoTradingConfig.walletId, walletIds));

    const walletsData = await db
      .select({ id: wallets.id, currentBalance: wallets.currentBalance })
      .from(wallets)
      .where(inArray(wallets.id, walletIds));

    const configByWallet = new Map(configs.map(c => [c.walletId, c]));
    const walletBalanceMap = new Map(walletsData.map(w => [w.id, parseFloat(w.currentBalance ?? '0')]));

    let restoredCount = 0;
    for (const [key, watcherInfo] of dynamicWatchersByWallet.entries()) {
      const walletId = key.split(':')[0]!;
      const config = configByWallet.get(walletId);

      if (!config?.useDynamicSymbolSelection) continue;

      try {
        const activeCount = this.getDynamicWatcherCount(walletId);
        const targetCount = activeCount > 0 ? activeCount : AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT;

        await this.startDynamicRotation(walletId, watcherInfo.userId, {
          useDynamicSymbolSelection: true,
          targetWatcherCount: targetCount,
          dynamicSymbolExcluded: config.dynamicSymbolExcluded,
          marketType: watcherInfo.marketType,
          interval: watcherInfo.interval,
          profileId: watcherInfo.profileId,
          enableAutoRotation: config.enableAutoRotation,
          leverage: config.leverage ?? 1,
          positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
          walletBalance: walletBalanceMap.get(walletId),
          useBtcCorrelationFilter: config.useBtcCorrelationFilter ?? true,
        });
        restoredCount++;
      } catch (error) {
        log('! [Startup] Failed to restore rotation', {
          walletId,
          interval: watcherInfo.interval,
          error: serializeError(error),
        });
      }
    }

  }

  async startDynamicRotation(
    walletId: string,
    userId: string,
    config: {
      useDynamicSymbolSelection: boolean;
      targetWatcherCount: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
      enableAutoRotation?: boolean;
      leverage?: number;
      positionSizePercent?: number;
      walletBalance?: number;
      useBtcCorrelationFilter?: boolean;
    }
  ): Promise<void> {
    if (!config.useDynamicSymbolSelection) {
      log('· Dynamic symbol selection is disabled', { walletId });
      return;
    }

    const enableAutoRotation = config.enableAutoRotation ?? true;

    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.targetWatcherCount,
      interval: config.interval,
      excludedSymbols,
      marketType: config.marketType,
      capitalRequirement: config.walletBalance !== undefined ? {
        walletBalance: config.walletBalance,
        leverage: config.leverage ?? 1,
        targetWatchersCount: config.targetWatcherCount,
        positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
      } : undefined,
      useBtcCorrelationFilter: config.useBtcCorrelationFilter,
    };

    const initialResult = await rotationService.executeRotation(walletId, userId, rotationConfig);
    const addedWatcherIds = await this.applyRotation(walletId, userId, initialResult, config.interval, config.profileId, config.marketType);

    if (addedWatcherIds.length > 0) {
      this.signalProcessor.addToProcessingQueue(addedWatcherIds);
    }

    if (enableAutoRotation) {
      const stateKey = getRotationStateKey(walletId, config.interval);
      const intervalMs = INTERVAL_MS[config.interval as Interval] ?? TIME_MS.HOUR;
      const currentCandleClose = getCandleCloseTime(config.interval);
      const previousCandleClose = currentCandleClose - intervalMs;

      this.rotationStates.set(stateKey, {
        config: rotationConfig,
        userId,
        profileId: config.profileId,
        lastCandleCloseTime: currentCandleClose,
        lastRotationCandleClose: previousCandleClose,
      });

      this.startAnticipationTimer();
    } else {
      log('· Auto rotation disabled - manual rotation only', { walletId });
    }
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length === 0) {
      log('· No active rotation for wallet', { walletId });
      return;
    }

    for (const key of keysToDelete) {
      this.rotationStates.delete(key);
      this.isCheckingRotation.delete(key);
    }

    if (this.rotationStates.size === 0) {
      this.stopAnticipationTimer();
    }

    if (stopDynamicWatchers) {
      const dynamicWatchers = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.isManual, false)
          )
        );

      for (const watcher of dynamicWatchers) {
        await this.stopWatcher(watcher.walletId, watcher.symbol, watcher.interval, watcher.marketType as MarketType);
      }

      log('✗ Stopped dynamic rotation and removed dynamic watchers', {
        walletId,
        watchersRemoved: dynamicWatchers.length,
      });
    } else {
      log('✗ Stopped dynamic rotation (kept existing watchers)', { walletId });
    }
  }

  async applyRotation(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'FUTURES'
  ): Promise<string[]> {
    const addedWatcherIds: string[] = [];

    for (const symbol of result.removed) {
      const existingWatcher = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.symbol, symbol),
            eq(activeWatchersTable.isManual, false)
          )
        )
        .limit(1);

      if (existingWatcher.length > 0) {
        await this.stopWatcher(walletId, symbol, interval, marketType);
      }
    }

    const klineMaintenance = getKlineMaintenance();
    const validations: Array<{ symbol: string; gapsFilled: number; corruptedFixed: number }> = [];

    const symbolsToAdd: string[] = [];
    for (const symbol of result.added) {
      const existingWatcher = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.symbol, symbol)
          )
        )
        .limit(1);

      if (existingWatcher.length === 0) {
        symbolsToAdd.push(symbol);
      }
    }

    if (symbolsToAdd.length > 0) {
      log('> [Rotation] Backfilling new symbols', {
        count: symbolsToAdd.length,
        symbols: symbolsToAdd.join(', '),
      });

      const requiredKlinesForApply = calculateRequiredKlines();

      await Promise.all(
        symbolsToAdd.map(async (symbol) => {
          log('> [Rotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForApply });
          const prefetchResult = await prefetchKlines({ symbol, interval, marketType, targetCount: requiredKlinesForApply, silent: false });
          log('> [Rotation] Prefetch result', {
            symbol,
            success: prefetchResult.success,
            downloaded: prefetchResult.downloaded,
            totalInDb: prefetchResult.totalInDb,
            gaps: prefetchResult.gaps,
            alreadyComplete: prefetchResult.alreadyComplete,
            error: prefetchResult.error,
          });

          const validationResult = await klineMaintenance.forceCheckSymbol(
            symbol,
            interval as Interval,
            marketType
          );

          if (validationResult.gapsFilled > 0 || validationResult.corruptedFixed > 0) {
            validations.push({
              symbol,
              gapsFilled: validationResult.gapsFilled,
              corruptedFixed: validationResult.corruptedFixed,
            });
          }
        })
      );
    }

    for (const symbol of symbolsToAdd) {
      const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
      await this.startWatcher(
        walletId,
        userId,
        symbol,
        interval,
        profileId,
        false,
        marketType,
        false,
        false,
        true
      );
      addedWatcherIds.push(watcherId);
    }

    if (validations.length > 0) {
      log('# [Rotation] Kline validations completed', {
        symbols: validations.map(v => v.symbol).join(', '),
        totalGapsFilled: validations.reduce((sum, v) => sum + v.gapsFilled, 0),
        totalCorruptedFixed: validations.reduce((sum, v) => sum + v.corruptedFixed, 0),
        details: validations,
      });
    }

    return addedWatcherIds;
  }

  async triggerManualRotation(
    walletId: string,
    userId: string,
    config: {
      targetWatcherCount: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
      leverage?: number;
      positionSizePercent?: number;
      walletBalance?: number;
      useBtcCorrelationFilter?: boolean;
    }
  ): Promise<RotationResult> {
    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.targetWatcherCount,
      interval: config.interval,
      excludedSymbols,
      marketType: config.marketType,
      capitalRequirement: config.walletBalance !== undefined ? {
        walletBalance: config.walletBalance,
        leverage: config.leverage ?? 1,
        targetWatchersCount: config.targetWatcherCount,
        positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
      } : undefined,
      useBtcCorrelationFilter: config.useBtcCorrelationFilter,
    };

    const result = await rotationService.executeRotation(walletId, userId, rotationConfig);
    const addedWatcherIds = await this.applyRotation(walletId, userId, result, config.interval, config.profileId, config.marketType);

    if (addedWatcherIds.length > 0) {
      this.signalProcessor.addToProcessingQueue(addedWatcherIds);
    }

    return result;
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

  isRotationActive(walletId: string): boolean {
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) {
        return true;
      }
    }
    return false;
  }

  getNextRotationTime(walletId: string): Date | null {
    let earliestTime: Date | null = null;
    const now = Date.now();

    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        const nextCandleClose = getNextCandleCloseTime(state.config.interval, now);
        const nextTime = new Date(nextCandleClose);
        if (!earliestTime || nextTime < earliestTime) {
          earliestTime = nextTime;
        }
      }
    }

    return earliestTime;
  }

  getRotationConfig(walletId: string): RotationConfig | null {
    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        return state.config;
      }
    }
    return null;
  }

  getRotationCycles(walletId: string): Array<{ interval: string; nextRotation: Date; config: RotationConfig }> {
    const cycles: Array<{ interval: string; nextRotation: Date; config: RotationConfig }> = [];
    const now = Date.now();

    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        const interval = key.split(':')[1] ?? state.config.interval;
        const nextCandleClose = getNextCandleCloseTime(state.config.interval, now);
        cycles.push({
          interval,
          nextRotation: new Date(nextCandleClose),
          config: state.config,
        });
      }
    }

    return cycles.sort((a, b) => a.nextRotation.getTime() - b.nextRotation.getTime());
  }

}

export const autoTradingScheduler = new AutoTradingScheduler();
