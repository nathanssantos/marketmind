import type { Interval, Kline, MarketType, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { getDefaultFee, TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ABSOLUTE_MINIMUM_KLINES, INTERVAL_MS, TIME_MS, TRADING_CONFIG, UNIT_MS } from '../constants';
import { db } from '../db';
import {
  activeWatchers as activeWatchersTable,
  autoTradingConfig,
  klines,
  setupDetections,
  tradeExecutions,
  tradingProfiles,
  wallets,
  type Wallet,
} from '../db/schema';
import { env } from '../env';
import {
  getDynamicSymbolRotationService,
  getOptimalRotationInterval,
  type RotationConfig,
  type RotationResult,
} from './dynamic-symbol-rotation';
import { parseDynamicSymbolExcluded } from '../utils/profile-transformers';
import {
  ADX_FILTER,
  checkAdxCondition,
  checkBtcCorrelation,
  checkFundingRate,
  checkMarketRegime,
  checkMomentumTiming,
  checkMtfCondition,
  checkStochasticCondition,
  checkTrendCondition,
  checkVolumeCondition,
  getHigherTimeframe,
  MOMENTUM_TIMING_FILTER,
  MTF_FILTER,
  STOCHASTIC_FILTER,
} from '../utils/filters';
import { calculateConfluenceScore, type FilterResults } from '../utils/confluence-scoring';
import { calculateRequiredKlines } from '../utils/kline-calculator';
import { autoTradingService } from './auto-trading';
import { cooldownService } from './cooldown';
import { hasSufficientKlines, prefetchKlines } from './kline-prefetch';
import { ocoOrderService } from './oco-orders';
import { positionMonitorService } from './position-monitor';
import { pyramidingService } from './pyramiding';
import { riskManagerService } from './risk-manager';
import { StrategyInterpreter, StrategyLoader } from './setup-detection/dynamic';
import { getWebSocketService } from './websocket';

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
    console.error('[Auto-Trading] Failed to write to log file:', error instanceof Error ? error.message : String(error));
  }
};

interface ActiveWatcher {
  walletId: string;
  userId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
  enabledStrategies: string[];
  profileId?: string;
  profileName?: string;
  intervalId: ReturnType<typeof setInterval>;
  lastProcessedTime: number;
  lastProcessedCandleOpenTime?: number;
  isManual: boolean;
}

const CANDLE_CLOSE_SAFETY_BUFFER_MS = 2000;

const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const getPollingIntervalForTimeframe = (interval: string): number => {
  const intervalMs = INTERVAL_MS[interval as Interval];
  if (!intervalMs) {
    log(`⚠️ Unknown interval ${interval}, defaulting to 1 minute polling`);
    return TIME_MS.MINUTE;
  }
  return Math.max(intervalMs, TIME_MS.MINUTE);
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000;

export class AutoTradingScheduler {
  private activeWatchers: Map<string, ActiveWatcher> = new Map();
  private strategyLoader: StrategyLoader;
  private processingQueue: string[] = [];
  private isProcessingQueue = false;

  private btcKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private htfKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private fundingRateCache: Map<string, CacheEntry<number>> = new Map();
  private readonly FUNDING_CACHE_TTL_MS = 5 * TIME_MS.MINUTE;

  constructor() {
    this.strategyLoader = new StrategyLoader([STRATEGIES_DIR]);
    log('🚀 AutoTradingScheduler initialized');
  }

  private isCacheValid<T>(cache: CacheEntry<T> | undefined): cache is CacheEntry<T> {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL_MS;
  }

  private async getBtcKlines(interval: string): Promise<Kline[]> {
    const cacheKey = `BTCUSDT-${interval}`;
    const cached = this.btcKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const btcKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, 'BTCUSDT'),
        eq(klines.interval, interval)
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

  private async getHtfKlines(symbol: string, htfInterval: string): Promise<Kline[]> {
    const cacheKey = `${symbol}-${htfInterval}`;
    const cached = this.htfKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const htfKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, htfInterval)
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
    if (!this.processingQueue.includes(watcherId)) {
      this.processingQueue.push(watcherId);
      void this.processWatcherQueue();
    }
  }

  private async processWatcherQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.processingQueue.length > 0) {
      const watcherId = this.processingQueue.shift();
      if (watcherId) {
        await this.processWatcher(watcherId);
        await yieldToEventLoop();
      }
    }

    this.isProcessingQueue = false;
  }

  private getIntervalMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
    const unitMs = UNIT_MS[match[2]];
    if (!unitMs) return 4 * TIME_MS.HOUR;
    return parseInt(match[1]) * unitMs;
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
    runImmediateCheck: boolean = false
  ): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;

    if (this.activeWatchers.has(watcherId)) {
      log('⚠️ Watcher already exists', { watcherId });
      return;
    }

    const [config] = await db
      .select()
      .from(autoTradingConfig)
      .where(
        and(
          eq(autoTradingConfig.walletId, walletId),
          eq(autoTradingConfig.userId, userId)
        )
      )
      .limit(1);

    if (!config?.isEnabled) {
      log('⚠️ Auto-trading not enabled for wallet', { walletId });
      await db
        .delete(activeWatchersTable)
        .where(eq(activeWatchersTable.walletId, walletId));
      log('🗑️ Removed stale watcher from database', { walletId });
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
        log('📋 Using trading profile', { profileId, profileName, strategies: enabledStrategies.length });
      } else {
        log('⚠️ Profile not found, falling back to global config', { profileId });
        enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
      }
    } else {
      enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
    }

    if (enabledStrategies.length === 0) {
      log('⚠️ No strategies enabled', { walletId, enabledStrategies, profileId });
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
        log('💾 Persisted watcher to database', { watcherId, profileId, marketType, isManual });
      } else if (existingWatcher[0] && existingWatcher[0].profileId !== profileId) {
        await db
          .update(activeWatchersTable)
          .set({ profileId: profileId ?? null })
          .where(eq(activeWatchersTable.id, watcherId));
        log('💾 Updated watcher profile in database', { watcherId, profileId });
      }
    }

    const pollIntervalMs = getPollingIntervalForTimeframe(interval);
    const now = Date.now();
    const nextCandleClose = Math.ceil(now / pollIntervalMs) * pollIntervalMs;
    const delayUntilNextCandle = nextCandleClose - now;

    log('🟢 Starting watcher', {
      watcherId,
      symbol,
      interval,
      enabledStrategies,
      profileId,
      profileName,
      pollIntervalMs: `${pollIntervalMs / 1000}s`,
      nextCandleClose: new Date(nextCandleClose).toISOString(),
      delayUntilSync: `${Math.round(delayUntilNextCandle / 1000)}s`,
    });

    const syncTimeoutId = setTimeout(() => {
      log('🔄 Watcher synchronized with candle close', {
        watcherId,
        symbol,
        interval,
        syncedAt: new Date().toISOString(),
      });

      this.queueWatcherProcessing(watcherId);

      const intervalId = setInterval(() => {
        this.queueWatcherProcessing(watcherId);
      }, pollIntervalMs);

      const watcher = this.activeWatchers.get(watcherId);
      if (watcher) {
        watcher.intervalId = intervalId;
      }
    }, delayUntilNextCandle);

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
      isManual,
    };

    this.activeWatchers.set(watcherId, watcher);

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('./binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.subscribe(symbol, interval);
    } else {
      binanceKlineStreamService.subscribe(symbol, interval);
    }
    log('📊 Subscribed to kline stream', { symbol, interval, marketType });

    if (runImmediateCheck) {
      log('⚡ Running immediate check for rotated symbol', { watcherId, symbol, interval });
      setImmediate(() => {
        void (async () => {
          try {
            const result = await prefetchKlines({ symbol, interval, marketType });
            if (!result.success) {
              log('⚠️ Immediate prefetch failed, skipping detection', { watcherId, symbol, error: result.error });
              return;
            }
            if (!hasSufficientKlines(result.totalInDb, ABSOLUTE_MINIMUM_KLINES)) {
              log('⚠️ Insufficient klines after prefetch, skipping detection', {
                watcherId,
                symbol,
                totalInDb: result.totalInDb,
                required: ABSOLUTE_MINIMUM_KLINES,
              });
              return;
            }
            log('✅ Immediate prefetch completed, queuing detection', { watcherId, symbol, totalInDb: result.totalInDb });
            this.queueWatcherProcessing(watcherId);
          } catch (error) {
            log('❌ Immediate check failed', {
              watcherId,
              symbol,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      });
    }
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

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('./binance-kline-stream');
    if (watcher.marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.unsubscribe(symbol, interval);
    } else {
      binanceKlineStreamService.unsubscribe(symbol, interval);
    }
    log('📊 Unsubscribed from kline stream', { symbol, interval, marketType: watcher.marketType });

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
      this.clearCaches();
      log('🧹 Caches cleared - no active watchers');
    }
  }

  // eslint-disable-next-line complexity
  private async processWatcher(watcherId: string): Promise<void> {
    const watcher = this.activeWatchers.get(watcherId);
    if (!watcher) return;

    log('🔍 Processing watcher', {
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
    });

    const [walletData] = await db
      .select({ currentBalance: wallets.currentBalance })
      .from(wallets)
      .where(eq(wallets.id, watcher.walletId))
      .limit(1);

    const [configData] = await db
      .select({ leverage: autoTradingConfig.leverage })
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.walletId, watcher.walletId))
      .limit(1);

    const walletBalance = parseFloat(walletData?.currentBalance ?? '0');
    const leverage = configData?.leverage ?? 1;
    const availableCapital = walletBalance * leverage;

    if (availableCapital <= TRADING_DEFAULTS.MIN_TRADE_VALUE_USD) {
      log('💤 Skipping setup scan - insufficient capital', {
        walletId: watcher.walletId,
        symbol: watcher.symbol,
        walletBalance: walletBalance.toFixed(2),
        leverage,
        availableCapital: availableCapital.toFixed(2),
        minRequired: TRADING_DEFAULTS.MIN_TRADE_VALUE_USD,
      });
      return;
    }

    try {
      const strategies = await this.strategyLoader.loadAll({ includeUnprofitable: false });
      const filteredStrategies = strategies.filter((s) =>
        watcher.enabledStrategies.includes(s.id)
      );

      const requiredKlines = calculateRequiredKlines();
      const minRequired = ABSOLUTE_MINIMUM_KLINES;

      const klinesData = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, watcher.symbol),
          eq(klines.interval, watcher.interval),
          eq(klines.marketType, watcher.marketType)
        ),
        orderBy: [desc(klines.openTime)],
        limit: requiredKlines,
      });

      if (klinesData.length < minRequired) {
        log('📥 Insufficient klines data, using smart backfill...', { count: klinesData.length, required: minRequired, target: requiredKlines });

        const result = await prefetchKlines({
          symbol: watcher.symbol,
          interval: watcher.interval,
          marketType: watcher.marketType,
          targetCount: requiredKlines,
        });

        if (!result.success) {
          log('❌ Failed to fetch historical klines', { error: result.error });
          return;
        }

        const hasReachedApiLimit = result.alreadyComplete || result.gaps === 0;

        if (!hasSufficientKlines(result.totalInDb, minRequired)) {
          if (hasReachedApiLimit && result.totalInDb >= ABSOLUTE_MINIMUM_KLINES) {
            log('⚠️ Proceeding with available klines (API limit reached)', {
              available: result.totalInDb,
              required: minRequired,
              absoluteMinimum: ABSOLUTE_MINIMUM_KLINES,
              alreadyComplete: result.alreadyComplete,
              gaps: result.gaps,
            });
          } else if (!hasReachedApiLimit) {
            log('⚠️ Insufficient klines, more data may be available', {
              totalInDb: result.totalInDb,
              minRequired,
              gaps: result.gaps,
            });
            return;
          } else {
            log('❌ Critical: insufficient klines even after exhausting API', {
              available: result.totalInDb,
              absoluteMinimum: ABSOLUTE_MINIMUM_KLINES,
              required: minRequired,
            });
            return;
          }
        }

        const refreshedKlines = await db.query.klines.findMany({
          where: and(
            eq(klines.symbol, watcher.symbol),
            eq(klines.interval, watcher.interval),
            eq(klines.marketType, watcher.marketType)
          ),
          orderBy: [desc(klines.openTime)],
          limit: requiredKlines,
        });

        if (refreshedKlines.length < minRequired) {
          if (hasReachedApiLimit && refreshedKlines.length >= ABSOLUTE_MINIMUM_KLINES) {
            log('⚠️ Proceeding with refreshed klines (API limit)', {
              available: refreshedKlines.length,
              required: minRequired,
            });
          } else {
            log('⚠️ Insufficient klines after refresh', {
              count: refreshedKlines.length,
              required: minRequired,
              hasReachedApiLimit,
            });
            return;
          }
        }

        klinesData.length = 0;
        klinesData.push(...refreshedKlines);
      }

      klinesData.reverse();

      const mappedKlines: Kline[] = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval,
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

      const lastCandle = mappedKlines[mappedKlines.length - 1];
      if (!lastCandle) {
        log('⚠️ No candles available', { symbol: watcher.symbol });
        return;
      }

      const now = Date.now();
      const candleCloseTime = lastCandle.closeTime;
      const safeCloseTime = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      const isCandleClosed = now >= safeCloseTime;

      if (!isCandleClosed) {
        const remainingMs = safeCloseTime - now;
        log('⏳ Waiting for candle to close (with safety buffer)', {
          symbol: watcher.symbol,
          interval: watcher.interval,
          candleOpenTime: new Date(lastCandle.openTime).toISOString(),
          candleCloseTime: new Date(candleCloseTime).toISOString(),
          safeCloseTime: new Date(safeCloseTime).toISOString(),
          remainingMs,
        });

        if (remainingMs > 0 && remainingMs < 10000) {
          setTimeout(() => {
            log('🔄 Retrying after candle close buffer', { watcherId, symbol: watcher.symbol });
            this.queueWatcherProcessing(watcherId);
          }, remainingMs + 100);
        }

        return;
      }

      if (watcher.lastProcessedCandleOpenTime === lastCandle.openTime) {
        log('⏭️ Candle already processed, skipping', {
          symbol: watcher.symbol,
          candleOpenTime: new Date(lastCandle.openTime).toISOString(),
        });
        return;
      }

      log('📊 Scanning for setups', {
        symbol: watcher.symbol,
        strategies: filteredStrategies.length,
        klines: mappedKlines.length,
        lastCandleTime: new Date(lastCandle.openTime).toISOString(),
      });

      const detectedSetups: TradingSetup[] = [];
      const currentIndex = mappedKlines.length - 1;

      for (const strategy of filteredStrategies) {
        await yieldToEventLoop();

        const interpreter = new StrategyInterpreter({
          enabled: true,
          minConfidence: 50,
          minRiskReward: 1.0,
          strategy,
        });

        const result = interpreter.detect(mappedKlines, currentIndex);

        if (result.setup && result.confidence >= 50) {
          const setupWithTriggerData = {
            ...result.setup,
            triggerKlineIndex: result.triggerKlineIndex,
            triggerCandleData: result.triggerCandleData,
            triggerIndicatorValues: result.triggerIndicatorValues,
          };
          detectedSetups.push(setupWithTriggerData);
          log('📍 Setup detected', {
            type: result.setup.type,
            direction: result.setup.direction,
            confidence: result.confidence,
            entryPrice: result.setup.entryPrice?.toFixed(6),
            stopLoss: result.setup.stopLoss?.toFixed(6),
            takeProfit: result.setup.takeProfit?.toFixed(6),
            riskRewardRatio: result.setup.riskRewardRatio?.toFixed(2),
            candleCloseTime: new Date(candleCloseTime).toISOString(),
          });
        }
      }

      watcher.lastProcessedCandleOpenTime = lastCandle.openTime;

      if (detectedSetups.length === 0) {
        log('📭 No setups found');
        watcher.lastProcessedTime = Date.now();
        return;
      }

      for (const setup of detectedSetups) {
        await this.executeSetup(watcher, setup, filteredStrategies, mappedKlines);
      }

      watcher.lastProcessedTime = Date.now();
    } catch (error) {
      log('❌ Error processing watcher', {
        watcherId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // eslint-disable-next-line complexity
  private async executeSetup(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[]
  ): Promise<void> {
    log('🚀 Attempting to execute setup', {
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
    });

    const [config] = await db
      .select()
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.walletId, watcher.walletId))
      .limit(1);

    const tpCalculationMode = config?.tpCalculationMode ?? 'default';
    const fibonacciTargetLevel = config?.fibonacciTargetLevel ?? 'auto';

    let effectiveTakeProfit = setup.takeProfit;

    if (tpCalculationMode === 'fibonacci' && setup.fibonacciProjection) {
      const fibTarget = this.getFibonacciTargetPrice(setup, fibonacciTargetLevel);
      if (fibTarget !== null) {
        const isValidTarget = setup.direction === 'LONG'
          ? fibTarget > setup.entryPrice
          : fibTarget < setup.entryPrice;

        if (isValidTarget) {
          log('📐 Using Fibonacci projection for take profit', {
            originalTP: setup.takeProfit?.toFixed(6),
            fibonacciTP: fibTarget.toFixed(6),
            configLevel: fibonacciTargetLevel,
            primaryLevel: setup.fibonacciProjection.primaryLevel,
            direction: setup.direction,
          });
          effectiveTakeProfit = fibTarget;
        } else {
          log('⚠️ Fibonacci target invalid for direction, using default TP', {
            fibTarget: fibTarget.toFixed(6),
            entryPrice: setup.entryPrice.toFixed(6),
            direction: setup.direction,
          });
        }
      }
    }

    if (setup.stopLoss && effectiveTakeProfit) {
      const entryPrice = setup.entryPrice;
      const stopLoss = setup.stopLoss;
      const takeProfit = effectiveTakeProfit;

      let risk: number;
      let reward: number;

      if (setup.direction === 'LONG') {
        risk = entryPrice - stopLoss;
        reward = takeProfit - entryPrice;
      } else {
        risk = stopLoss - entryPrice;
        reward = entryPrice - takeProfit;
      }

      if (risk <= 0) {
        log('❌ Invalid stop loss - no risk', {
          type: setup.type,
          direction: setup.direction,
          entryPrice,
          stopLoss,
        });
        return;
      }

      const riskRewardRatio = reward / risk;

      if (riskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
        log('❌ Setup rejected - insufficient risk/reward ratio', {
          type: setup.type,
          direction: setup.direction,
          entryPrice,
          stopLoss,
          takeProfit,
          risk: risk.toFixed(2),
          reward: reward.toFixed(2),
          riskRewardRatio: riskRewardRatio.toFixed(2),
          minRequired: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
        });
        return;
      }

      log('✅ Risk/Reward ratio validated', {
        type: setup.type,
        direction: setup.direction,
        entryPrice: entryPrice.toFixed(6),
        stopLoss: stopLoss.toFixed(6),
        takeProfit: takeProfit.toFixed(6),
        risk: risk.toFixed(6),
        reward: reward.toFixed(6),
        riskRewardRatio: riskRewardRatio.toFixed(2),
      });
    } else if (!setup.stopLoss) {
      log('⚠️ Missing stop loss - cannot execute', {
        type: setup.type,
      });
      return;
    } else {
      log('ℹ️ Setup without take profit - skipping R:R validation', {
        type: setup.type,
      });
    }

    try {
      const [config] = await db
        .select()
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, watcher.walletId),
            eq(autoTradingConfig.userId, watcher.userId)
          )
        )
        .limit(1);

      if (!config?.isEnabled) {
        log('⚠️ Auto-trading disabled during execution');
        return;
      }

      const strategy = strategies.find(s => s.id === setup.type);
      const strategyParams = strategy?.optimizedParams;

      const walletMaxConcurrent = config.maxConcurrentPositions;
      const strategyMaxConcurrent = strategyParams?.maxConcurrentPositions;

      const effectiveMaxPositionSize = strategyParams?.maxPositionSize
        ?? parseFloat(config.maxPositionSize);

      if (strategyParams) {
        log('📈 Using strategy optimizedParams (profit-maximized)', {
          strategyId: setup.type,
          walletMaxPositionSize: parseFloat(config.maxPositionSize),
          strategyMaxPositionSize: strategyParams.maxPositionSize,
          effectiveMaxPositionSize,
          walletMaxConcurrent,
          strategyMaxConcurrent,
        });
      }

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, watcher.walletId))
        .limit(1);

      if (!wallet) {
        log('❌ Wallet not found', { walletId: watcher.walletId });
        return;
      }

      const walletSupportsLive = wallet.walletType === 'live' || wallet.walletType === 'testnet';
      const isLiveExecution = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (walletSupportsLive && !env.ENABLE_LIVE_TRADING) {
        log('⚠️ Live trading disabled via ENABLE_LIVE_TRADING=false, using paper mode', {
          walletType: wallet.walletType,
        });
      }

      log('📋 Wallet type', { walletType: wallet.walletType, isLiveExecution, enableLiveTrading: env.ENABLE_LIVE_TRADING });

      const activePositions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, watcher.walletId),
            inArray(tradeExecutions.status, ['open', 'pending'])
          )
        );

      const openPositions = activePositions.filter(p => p.status === 'open');
      const pendingPositions = activePositions.filter(p => p.status === 'pending');

      const strategyPositions = activePositions.filter(p => p.setupType === setup.type);

      log('📊 Current positions', {
        open: openPositions.length,
        pending: pendingPositions.length,
        total: activePositions.length,
        strategyPositions: strategyPositions.length,
        strategyMax: strategyMaxConcurrent ?? 'unlimited',
      });

      if (strategyMaxConcurrent && strategyPositions.length >= strategyMaxConcurrent) {
        log('⚠️ Strategy max concurrent positions reached', {
          strategy: setup.type,
          strategyPositions: strategyPositions.length,
          strategyMax: strategyMaxConcurrent,
        });
        return;
      }

      log('🔍 Checking cooldown', {
        setupType: setup.type,
        symbol: watcher.symbol,
        interval: watcher.interval,
        walletId: watcher.walletId,
      });

      const cooldownCheck = await cooldownService.checkCooldown(
        setup.type,
        watcher.symbol,
        watcher.interval,
        watcher.walletId
      );

      log('🔎 Cooldown check result', {
        setupType: setup.type,
        inCooldown: cooldownCheck.inCooldown,
        cooldownUntil: cooldownCheck.cooldownUntil,
        reason: cooldownCheck.reason,
      });

      if (cooldownCheck.inCooldown) {
        const remainingMs = cooldownCheck.cooldownUntil
          ? cooldownCheck.cooldownUntil.getTime() - Date.now()
          : 0;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        log('⏳ Trade cooldown active', {
          setupType: setup.type,
          direction: setup.direction,
          reason: cooldownCheck.reason,
          remainingMinutes,
        });
        return;
      }

      log('✅ No cooldown active - proceeding with execution', {
        setupType: setup.type,
      });

      const filterResults: FilterResults = {};

      if (config.useBtcCorrelationFilter) {
        const isAltcoin = !watcher.symbol.startsWith('BTC') && watcher.symbol !== 'BTCUSDT';

        if (isAltcoin) {
          const mappedBtcKlines = await this.getBtcKlines(watcher.interval);

          if (mappedBtcKlines.length >= 26) {
            const btcResult = checkBtcCorrelation(mappedBtcKlines, setup.direction, watcher.symbol);
            filterResults.btcCorrelation = btcResult;

            log('📊 BTC Correlation Filter Check', {
              symbol: watcher.symbol,
              direction: setup.direction,
              btcTrend: btcResult.btcTrend,
              btcPrice: btcResult.btcPrice?.toFixed(2) ?? 'null',
              btcEma21: btcResult.btcEma21?.toFixed(2) ?? 'null',
              isAllowed: btcResult.isAllowed,
              reason: btcResult.reason,
            });

            if (!btcResult.isAllowed) {
              log('🚫 BTC Correlation filter blocked trade (hard block)', {
                direction: setup.direction,
                btcTrend: btcResult.btcTrend,
                reason: btcResult.reason,
              });
              return;
            }
          } else {
            log('⚠️ Insufficient BTCUSDT klines for BTC Correlation filter - soft pass', {
              available: mappedBtcKlines.length,
              required: 26,
            });
          }
        }
      }

      if (config.useFundingFilter && watcher.marketType === 'FUTURES') {
        try {
          const cachedFundingRate = await this.getCachedFundingRate(watcher.symbol);
          const fundingResult = checkFundingRate(
            cachedFundingRate !== null ? cachedFundingRate / 100 : null,
            setup.direction,
            undefined
          );
          filterResults.fundingRate = fundingResult;

          log('📊 Funding Rate Filter Check (cached)', {
            symbol: watcher.symbol,
            direction: setup.direction,
            fundingRate: fundingResult.currentRate?.toFixed(6) ?? 'null',
            fundingLevel: fundingResult.fundingLevel,
            signal: fundingResult.signal,
            isAllowed: fundingResult.isAllowed,
            reason: fundingResult.reason,
          });

          if (!fundingResult.isAllowed) {
            log('🚫 Funding Rate filter blocked trade', {
              direction: setup.direction,
              fundingRate: fundingResult.currentRate?.toFixed(6) ?? 'null',
              fundingLevel: fundingResult.fundingLevel,
              reason: fundingResult.reason,
            });
            return;
          }
        } catch (fundingError) {
          log('⚠️ Failed to fetch funding rate - soft pass', {
            error: fundingError instanceof Error ? fundingError.message : String(fundingError),
          });
        }
      }

      if (config.useMtfFilter) {
        const htfInterval = getHigherTimeframe(watcher.interval);

        if (htfInterval) {
          const mappedHtfKlines = await this.getHtfKlines(watcher.symbol, htfInterval);

          if (mappedHtfKlines.length >= MTF_FILTER.MIN_KLINES_FOR_EMA200) {
            const mtfResult = checkMtfCondition(mappedHtfKlines, setup.direction, htfInterval);
            filterResults.mtf = mtfResult;

            log('📊 MTF Filter Check', {
              symbol: watcher.symbol,
              tradingInterval: watcher.interval,
              htfInterval,
              direction: setup.direction,
              htfTrend: mtfResult.htfTrend,
              ema50: mtfResult.ema50?.toFixed(2) ?? 'null',
              ema200: mtfResult.ema200?.toFixed(2) ?? 'null',
              price: mtfResult.price?.toFixed(2) ?? 'null',
              goldenCross: mtfResult.goldenCross,
              deathCross: mtfResult.deathCross,
              isAllowed: mtfResult.isAllowed,
              reason: mtfResult.reason,
            });

            if (!mtfResult.isAllowed) {
              log('🚫 MTF filter blocked trade', {
                direction: setup.direction,
                htfTrend: mtfResult.htfTrend,
                htfInterval,
                reason: mtfResult.reason,
              });
              return;
            }
          } else {
            log('⚠️ Insufficient HTF klines for MTF filter - soft pass', {
              htfInterval,
              available: mappedHtfKlines.length,
              required: MTF_FILTER.MIN_KLINES_FOR_EMA200,
            });
          }
        } else {
          log('ℹ️ No higher timeframe available for MTF filter - soft pass', {
            tradingInterval: watcher.interval,
          });
        }
      }

      if (config.useMarketRegimeFilter) {
        if (cycleKlines.length >= 30) {
          const regimeResult = checkMarketRegime(cycleKlines, setup.type);
          filterResults.marketRegime = regimeResult;
          filterResults.adxValue = regimeResult.adx ?? undefined;

          log('📊 Market Regime Filter Check', {
            symbol: watcher.symbol,
            interval: watcher.interval,
            setupType: setup.type,
            regime: regimeResult.regime,
            adx: regimeResult.adx?.toFixed(2) ?? 'null',
            volatilityLevel: regimeResult.volatilityLevel,
            recommendedStrategy: regimeResult.recommendedStrategy,
            isAllowed: regimeResult.isAllowed,
            reason: regimeResult.reason,
          });

          if (!regimeResult.isAllowed) {
            log('🚫 Market Regime filter blocked trade', {
              direction: setup.direction,
              setupType: setup.type,
              regime: regimeResult.regime,
              recommendedStrategy: regimeResult.recommendedStrategy,
              reason: regimeResult.reason,
            });
            return;
          }
        } else {
          log('⚠️ Insufficient klines for Market Regime filter - soft pass', {
            available: cycleKlines.length,
            required: 30,
          });
        }
      }

      if (config.useVolumeFilter) {
        if (cycleKlines.length >= 21) {
          const volumeResult = checkVolumeCondition(cycleKlines, setup.direction, setup.type);
          filterResults.volume = volumeResult;

          log('📊 Volume Filter Check', {
            symbol: watcher.symbol,
            interval: watcher.interval,
            direction: setup.direction,
            currentVolume: volumeResult.currentVolume?.toFixed(2) ?? 'null',
            averageVolume: volumeResult.averageVolume?.toFixed(2) ?? 'null',
            volumeRatio: volumeResult.volumeRatio?.toFixed(2) ?? 'null',
            isVolumeSpike: volumeResult.isVolumeSpike,
            obvTrend: volumeResult.obvTrend,
            isAllowed: volumeResult.isAllowed,
            reason: volumeResult.reason,
          });

          if (!volumeResult.isAllowed) {
            log('🚫 Volume filter blocked trade', {
              direction: setup.direction,
              setupType: setup.type,
              volumeRatio: volumeResult.volumeRatio?.toFixed(2) ?? 'null',
              reason: volumeResult.reason,
            });
            return;
          }
        } else {
          log('⚠️ Insufficient klines for Volume filter - soft pass', {
            available: cycleKlines.length,
            required: 21,
          });
        }
      }

      if (config.useConfluenceScoring) {
        const confluenceResult = calculateConfluenceScore(filterResults, config.confluenceMinScore);

        log('📊 Confluence Scoring Result', {
          symbol: watcher.symbol,
          direction: setup.direction,
          totalScore: confluenceResult.totalScore,
          maxScore: confluenceResult.maxPossibleScore,
          scorePercent: `${confluenceResult.scorePercent.toFixed(1)}%`,
          alignmentBonus: confluenceResult.alignmentBonus,
          recommendation: confluenceResult.recommendation,
          isAllowed: confluenceResult.isAllowed,
          minRequired: config.confluenceMinScore,
          contributions: confluenceResult.contributions.map((c) => ({
            filter: c.filterName,
            score: c.score,
            max: c.maxScore,
            passed: c.passed,
          })),
        });

        if (!confluenceResult.isAllowed) {
          log('🚫 Confluence Scoring blocked trade', {
            direction: setup.direction,
            scorePercent: `${confluenceResult.scorePercent.toFixed(1)}%`,
            minRequired: config.confluenceMinScore,
            recommendation: confluenceResult.recommendation,
            reason: confluenceResult.reason,
          });
          return;
        }

        log('✅ Confluence Scoring passed', {
          scorePercent: `${confluenceResult.scorePercent.toFixed(1)}%`,
          recommendation: confluenceResult.recommendation,
        });
      }

      if (config.useStochasticFilter) {
        const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
        const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

        if (cycleKlines.length < minRequired) {
          log('⚠️ Insufficient klines for Slow Stochastic calculation - soft pass', {
            required: minRequired,
            available: cycleKlines.length,
          });
        } else {
          const stochResult = checkStochasticCondition(cycleKlines, setup.direction);

          log('📊 Slow Stochastic Filter Check', {
            symbol: watcher.symbol,
            interval: watcher.interval,
            direction: setup.direction,
            currentK: stochResult.currentK?.toFixed(2) ?? 'null',
            currentD: stochResult.currentD?.toFixed(2) ?? 'null',
            isOversold: stochResult.isOversold,
            isOverbought: stochResult.isOverbought,
            isAllowed: stochResult.isAllowed,
            reason: stochResult.reason,
          });

          if (!stochResult.isAllowed) {
            log('🚫 Slow Stochastic filter blocked trade', {
              direction: setup.direction,
              currentK: stochResult.currentK?.toFixed(2) ?? 'null',
              isOversold: stochResult.isOversold,
              isOverbought: stochResult.isOverbought,
              reason: stochResult.reason,
            });
            return;
          }

          log('✅ Slow Stochastic filter passed', {
            direction: setup.direction,
            currentK: stochResult.currentK?.toFixed(2) ?? 'null',
            isOversold: stochResult.isOversold,
            isOverbought: stochResult.isOverbought,
            condition: stochResult.reason,
          });
        }
      }

      if (config.useMomentumTimingFilter) {
        const { MIN_KLINES_REQUIRED } = MOMENTUM_TIMING_FILTER;

        if (cycleKlines.length < MIN_KLINES_REQUIRED) {
          log('⚠️ Insufficient klines for Momentum Timing calculation - soft pass', {
            required: MIN_KLINES_REQUIRED,
            available: cycleKlines.length,
          });
        } else {
          const momentumResult = checkMomentumTiming(cycleKlines, setup.direction);

          log('📊 Momentum Timing Filter Check', {
            symbol: watcher.symbol,
            interval: watcher.interval,
            direction: setup.direction,
            rsiValue: momentumResult.rsiValue?.toFixed(2) ?? 'null',
            rsiMomentum: momentumResult.rsiMomentum,
            mfiValue: momentumResult.mfiValue?.toFixed(2) ?? 'null',
            mfiConfirmation: momentumResult.mfiConfirmation,
            isAllowed: momentumResult.isAllowed,
            reason: momentumResult.reason,
          });

          if (!momentumResult.isAllowed) {
            log('🚫 Momentum Timing filter blocked trade', {
              direction: setup.direction,
              rsiValue: momentumResult.rsiValue?.toFixed(2) ?? 'null',
              rsiMomentum: momentumResult.rsiMomentum,
              reason: momentumResult.reason,
            });
            return;
          }

          log('✅ Momentum Timing filter passed', {
            direction: setup.direction,
            rsiValue: momentumResult.rsiValue?.toFixed(2) ?? 'null',
            rsiMomentum: momentumResult.rsiMomentum,
            mfiConfirmation: momentumResult.mfiConfirmation,
          });
        }
      }

      if (config.useAdxFilter) {
        const { MIN_KLINES_REQUIRED } = ADX_FILTER;

        if (cycleKlines.length < MIN_KLINES_REQUIRED) {
          log('⚠️ Insufficient klines for ADX calculation', {
            required: MIN_KLINES_REQUIRED,
            available: cycleKlines.length,
          });
          return;
        }

        const adxResult = checkAdxCondition(cycleKlines, setup.direction);

        log('📊 ADX Filter Check', {
          symbol: watcher.symbol,
          interval: watcher.interval,
          direction: setup.direction,
          adx: adxResult.adx?.toFixed(2) ?? 'null',
          plusDI: adxResult.plusDI?.toFixed(2) ?? 'null',
          minusDI: adxResult.minusDI?.toFixed(2) ?? 'null',
          trendThreshold: ADX_FILTER.TREND_THRESHOLD,
          isBullish: adxResult.isBullish,
          isBearish: adxResult.isBearish,
          isStrongTrend: adxResult.isStrongTrend,
          isAllowed: adxResult.isAllowed,
        });

        if (!adxResult.isAllowed) {
          log('🚫 ADX filter blocked trade', {
            direction: setup.direction,
            adx: adxResult.adx?.toFixed(2) ?? 'null',
            plusDI: adxResult.plusDI?.toFixed(2) ?? 'null',
            minusDI: adxResult.minusDI?.toFixed(2) ?? 'null',
            reason: adxResult.reason,
          });
          return;
        }

        log('✅ ADX filter passed', {
          direction: setup.direction,
          adx: adxResult.adx?.toFixed(2) ?? 'null',
          plusDI: adxResult.plusDI?.toFixed(2) ?? 'null',
          minusDI: adxResult.minusDI?.toFixed(2) ?? 'null',
          condition: adxResult.reason,
        });
      }

      const setupStrategy = strategies.find(s => s.id === setup.type);
      const globalTrendFilterEnabled = config.useTrendFilter === true;
      const strategyTrendFilterEnabled = setupStrategy?.filters?.trendFilter?.enabled === true;
      const shouldApplyTrendFilter = globalTrendFilterEnabled || strategyTrendFilterEnabled;
      const trendFilterSource = globalTrendFilterEnabled && strategyTrendFilterEnabled
        ? 'global+strategy'
        : globalTrendFilterEnabled
          ? 'global'
          : strategyTrendFilterEnabled
            ? 'strategy'
            : 'none';

      log('🔍 Trend Filter Config', {
        globalEnabled: globalTrendFilterEnabled,
        strategyEnabled: strategyTrendFilterEnabled,
        shouldApply: shouldApplyTrendFilter,
        source: trendFilterSource,
        strategyId: setup.type,
      });

      if (shouldApplyTrendFilter) {
        log('🔍 Trend Filter Debug - Using cycle klines', {
          symbol: watcher.symbol,
          interval: watcher.interval,
          available: cycleKlines.length,
        });

        if (cycleKlines.length < 2) {
          log('⚠️ Insufficient klines for Trend (EMA21) calculation', {
            required: 2,
            available: cycleKlines.length,
          });
          return;
        }

        const trendResult = checkTrendCondition(cycleKlines, setup.direction);

        log('📊 Trend Filter Check (Price vs EMA21)', {
          symbol: watcher.symbol,
          interval: watcher.interval,
          direction: setup.direction,
          price: trendResult.price?.toFixed(2) ?? 'null',
          ema21: trendResult.ema21?.toFixed(2) ?? 'null',
          isBullish: trendResult.isBullish,
          isBearish: trendResult.isBearish,
          isAllowed: trendResult.isAllowed,
          source: trendFilterSource,
          strategyId: setup.type,
        });

        if (!trendResult.isAllowed) {
          log(`🚫 Trend filter blocked trade (source: ${trendFilterSource})`, {
            direction: setup.direction,
            price: trendResult.price?.toFixed(2) ?? 'null',
            ema21: trendResult.ema21?.toFixed(2) ?? 'null',
            reason: trendResult.reason,
            filterSource: trendFilterSource,
          });
          return;
        }

        log('✅ Trend filter passed', {
          direction: setup.direction,
          price: trendResult.price?.toFixed(2) ?? 'null',
          ema21: trendResult.ema21?.toFixed(2) ?? 'null',
          condition: trendResult.reason,
          source: trendFilterSource,
        });
      }

      const oppositeDirectionPosition = openPositions.find(
        (pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction
      );

      if (oppositeDirectionPosition) {
        log('⚠️ Opposite direction position exists - cannot open both LONG and SHORT (One-Way Mode)', {
          symbol: watcher.symbol,
          existingDirection: oppositeDirectionPosition.side,
          newDirection: setup.direction,
          existingExecutionId: oppositeDirectionPosition.id,
        });
        return;
      }

      const sameDirectionPositions = openPositions.filter(
        (pos) => pos.symbol === watcher.symbol && pos.side === setup.direction
      );

      if (sameDirectionPositions.length > 0) {
        const pyramidEval = await pyramidingService.evaluatePyramid(
          watcher.userId,
          watcher.walletId,
          watcher.symbol,
          setup.direction,
          setup.entryPrice,
          setup.confidence ? setup.confidence / 100 : undefined
        );

        if (!pyramidEval.canPyramid) {
          log('⚠️ Position exists but cannot pyramid', {
            symbol: watcher.symbol,
            direction: setup.direction,
            reason: pyramidEval.reason,
            currentEntries: pyramidEval.currentEntries,
            maxEntries: pyramidEval.maxEntries,
            profitPercent: `${(pyramidEval.profitPercent * 100).toFixed(2)  }%`,
          });
          return;
        }

        log('📈 Pyramiding opportunity detected', {
          symbol: watcher.symbol,
          direction: setup.direction,
          currentEntries: pyramidEval.currentEntries,
          profitPercent: `${(pyramidEval.profitPercent * 100).toFixed(2)  }%`,
          suggestedSize: pyramidEval.suggestedSize,
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');

      const activeWatchersForWallet = this.getWatcherStatus(watcher.walletId).watchers;

      const dynamicSize = await pyramidingService.calculateDynamicPositionSize(
        watcher.userId,
        watcher.walletId,
        watcher.symbol,
        setup.direction,
        walletBalance,
        setup.entryPrice,
        undefined,
        activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined
      );

      if (dynamicSize.quantity <= 0) {
        log('⚠️ Dynamic sizing returned zero quantity', { reason: dynamicSize.reason });
        return;
      }

      const positionValue = dynamicSize.quantity * setup.entryPrice;

      log('💰 Dynamic position sizing', {
        walletBalance: walletBalance.toFixed(2),
        sizePercent: dynamicSize.sizePercent.toFixed(2),
        positionValue: positionValue.toFixed(2),
        reason: dynamicSize.reason,
      });

      const effectiveConfig = {
        ...config,
        maxPositionSize: effectiveMaxPositionSize.toString(),
        maxConcurrentPositions: activeWatchersForWallet || walletMaxConcurrent,
      };

      const exposureMultiplier = parseFloat(config.exposureMultiplier);
      const exposurePerWatcher = activeWatchersForWallet > 0
        ? Math.min((100 * exposureMultiplier) / activeWatchersForWallet, 100)
        : parseFloat(config.maxPositionSize);

      log('📊 Dynamic exposure calculation', {
        activeWatchers: activeWatchersForWallet,
        exposureMultiplier: `${exposureMultiplier}x`,
        exposurePerWatcher: `${exposurePerWatcher.toFixed(1)}%`,
        effectiveMaxConcurrent: activeWatchersForWallet || walletMaxConcurrent,
      });

      const riskValidation = await riskManagerService.validateNewPositionLocked(
        watcher.walletId,
        effectiveConfig,
        positionValue,
        activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined
      );

      if (!riskValidation.isValid) {
        log('⚠️ Risk validation failed', { reason: riskValidation.reason });
        return;
      }

      const setupId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.insert(setupDetections).values({
        id: setupId,
        userId: watcher.userId,
        symbol: watcher.symbol,
        interval: watcher.interval,
        setupType: setup.type,
        direction: setup.direction,
        entryPrice: setup.entryPrice.toString(),
        stopLoss: setup.stopLoss?.toString(),
        takeProfit: setup.takeProfit?.toString(),
        confidence: Math.round(setup.confidence),
        riskReward: setup.riskRewardRatio.toString(),
        detectedAt: new Date(),
        expiresAt,
      });

      log('📝 Created setup detection', { setupId });

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const quantityFormatted = dynamicSize.quantity.toFixed(8);

      log('📐 Final position size', {
        positionValue: positionValue.toFixed(2),
        entryPrice: setup.entryPrice,
        quantity: quantityFormatted,
        walletBalance: walletBalance.toFixed(2),
        sizePercent: dynamicSize.sizePercent.toFixed(2),
      });

      const SLIPPAGE_PERCENT = 0.1;
      const commissionRate = getDefaultFee(watcher.marketType ?? 'SPOT', 'TAKER');
      const COMMISSION_PERCENT = commissionRate * 100;
      const slippageFactor = setup.direction === 'LONG' ? (1 + SLIPPAGE_PERCENT / 100) : (1 - SLIPPAGE_PERCENT / 100);
      const expectedEntryWithSlippage = setup.entryPrice * slippageFactor;

      let entryOrderId: number | null = null;
      let actualEntryPrice = expectedEntryWithSlippage;
      let actualQuantity = dynamicSize.quantity;
      let stopLossOrderId: number | null = null;
      let takeProfitOrderId: number | null = null;
      let orderListId: number | null = null;

      log('💸 Entry price adjusted for slippage', {
        originalEntry: setup.entryPrice,
        expectedEntry: expectedEntryWithSlippage,
        slippagePercent: SLIPPAGE_PERCENT,
        commissionPercent: COMMISSION_PERCENT,
        direction: setup.direction,
      });

      const useLimit = false;
      const orderType = 'MARKET' as const;

      if (isLiveExecution) {
        log(`🔴 LIVE EXECUTION - Placing ${orderType} order on Binance`, {
          walletType: wallet.walletType,
          symbol: watcher.symbol,
          side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
          quantity: quantityFormatted,
          orderType,
          limitPrice: useLimit ? setup.limitEntryPrice : undefined,
        });

        try {
          const orderResult = await autoTradingService.executeBinanceOrder(
            wallet as Wallet,
            {
              symbol: watcher.symbol,
              side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
              type: orderType,
              quantity: dynamicSize.quantity,
              price: useLimit ? setup.limitEntryPrice : undefined,
              timeInForce: useLimit ? 'GTC' : undefined,
            }
          );

          entryOrderId = orderResult.orderId;
          actualEntryPrice = parseFloat(orderResult.price) || setup.entryPrice;
          actualQuantity = parseFloat(orderResult.executedQty) || dynamicSize.quantity;

          const orderFilled = parseFloat(orderResult.executedQty) > 0;

          log('✅ Binance order executed', {
            orderId: entryOrderId,
            executedQty: orderResult.executedQty,
            price: orderResult.price,
            orderType,
            filled: orderFilled,
          });

          if (!orderFilled && useLimit) {
            log('📋 LIMIT order pending - will create SL/TP when filled', {
              orderId: entryOrderId,
              limitPrice: setup.limitEntryPrice,
            });
          }

          if (orderFilled && setup.stopLoss && effectiveTakeProfit) {
            try {
              const ocoResult = await ocoOrderService.createExitOCO(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.stopLoss,
                effectiveTakeProfit,
                setup.direction
              );

              if (ocoResult) {
                orderListId = ocoResult.orderListId;
                stopLossOrderId = ocoResult.stopLossOrderId;
                takeProfitOrderId = ocoResult.takeProfitOrderId;
                log('✅ OCO exit orders placed', {
                  orderListId,
                  stopLossOrderId,
                  takeProfitOrderId,
                  stopLoss: setup.stopLoss,
                  takeProfit: effectiveTakeProfit,
                });
              } else {
                log('⚠️ OCO placement returned null, falling back to separate orders');
                stopLossOrderId = await autoTradingService.createStopLossOrder(
                  wallet as Wallet,
                  watcher.symbol,
                  actualQuantity,
                  setup.stopLoss,
                  setup.direction
                );
                takeProfitOrderId = await autoTradingService.createTakeProfitOrder(
                  wallet as Wallet,
                  watcher.symbol,
                  actualQuantity,
                  effectiveTakeProfit,
                  setup.direction
                );
              }
            } catch (ocoError) {
              log('⚠️ Failed to place OCO exit orders, falling back to separate orders', {
                error: ocoError instanceof Error ? ocoError.message : String(ocoError),
              });
              try {
                stopLossOrderId = await autoTradingService.createStopLossOrder(
                  wallet as Wallet,
                  watcher.symbol,
                  actualQuantity,
                  setup.stopLoss,
                  setup.direction
                );
                log('🛡️ Stop loss order placed (fallback)', { stopLossOrderId });
              } catch (slError) {
                log('⚠️ Failed to place stop loss order', {
                  error: slError instanceof Error ? slError.message : String(slError),
                });
              }
              try {
                takeProfitOrderId = await autoTradingService.createTakeProfitOrder(
                  wallet as Wallet,
                  watcher.symbol,
                  actualQuantity,
                  effectiveTakeProfit,
                  setup.direction
                );
                log('🎯 Take profit order placed (fallback)', { takeProfitOrderId });
              } catch (tpError) {
                log('⚠️ Failed to place take profit order', {
                  error: tpError instanceof Error ? tpError.message : String(tpError),
                });
              }
            }
          } else if (orderFilled && setup.stopLoss) {
            try {
              stopLossOrderId = await autoTradingService.createStopLossOrder(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.stopLoss,
                setup.direction
              );
              log('🛡️ Stop loss order placed (no TP)', { stopLossOrderId, stopLoss: setup.stopLoss });
            } catch (slError) {
              log('⚠️ Failed to place stop loss order', {
                error: slError instanceof Error ? slError.message : String(slError),
              });
            }
          }
        } catch (orderError) {
          log('❌ Failed to execute Binance order', {
            error: orderError instanceof Error ? orderError.message : String(orderError),
          });
          return;
        }
      } else {
        try {
          const currentMarketPrice = await positionMonitorService.getCurrentPrice(watcher.symbol, watcher.marketType);

          if (useLimit && setup.limitEntryPrice) {
            const wouldLimitFill = setup.direction === 'LONG'
              ? currentMarketPrice && currentMarketPrice <= setup.limitEntryPrice
              : currentMarketPrice && currentMarketPrice >= setup.limitEntryPrice;

            if (!wouldLimitFill) {
              log('📋 PAPER TRADING - Creating PENDING limit order', {
                walletType: wallet.walletType,
                direction: setup.direction,
                limitEntryPrice: setup.limitEntryPrice,
                currentMarketPrice,
                reason: setup.direction === 'LONG'
                  ? `Waiting for price to drop to ${setup.limitEntryPrice} (pullback)`
                  : `Waiting for price to rise to ${setup.limitEntryPrice} (bounce)`,
              });

              const expirationBars = setup.expirationBars ?? 3;
              const intervalMs = this.getIntervalMs(watcher.interval);
              const expiresAt = new Date(Date.now() + (expirationBars * intervalMs));

              try {
                const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
                await db.insert(tradeExecutions).values({
                  id: executionId,
                  userId: watcher.userId,
                  walletId: watcher.walletId,
                  setupId,
                  setupType: setup.type,
                  symbol: watcher.symbol,
                  side: setup.direction,
                  entryPrice: setup.limitEntryPrice.toString(),
                  quantity: actualQuantity.toFixed(8),
                  stopLoss: setup.stopLoss?.toString(),
                  takeProfit: effectiveTakeProfit?.toString(),
                  openedAt: new Date(),
                  status: 'pending',
                  entryOrderType: 'LIMIT',
                  limitEntryPrice: setup.limitEntryPrice.toString(),
                  expiresAt,
                  marketType: watcher.marketType,
                  triggerKlineIndex: setup.triggerKlineIndex,
                  triggerKlineOpenTime: triggerCandle?.openTime,
                  triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
                  triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
                  fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
                });

                log('✅ PENDING order created - waiting for price to reach limit', {
                  executionId,
                  limitEntryPrice: setup.limitEntryPrice,
                  currentMarketPrice,
                  expiresAt: expiresAt.toISOString(),
                  expirationBars,
                });

                const wsService = getWebSocketService();
                if (wsService) {
                  wsService.emitPositionUpdate(watcher.walletId, {
                    id: executionId,
                    symbol: watcher.symbol,
                    side: setup.direction,
                    status: 'pending',
                    entryPrice: setup.limitEntryPrice.toString(),
                    limitEntryPrice: setup.limitEntryPrice.toString(),
                    quantity: actualQuantity.toFixed(8),
                    stopLoss: setup.stopLoss?.toString(),
                    takeProfit: effectiveTakeProfit?.toString(),
                    setupType: setup.type,
                    expiresAt: expiresAt.toISOString(),
                    fibonacciProjection: setup.fibonacciProjection,
                  });
                }

                await cooldownService.setCooldown(
                  setup.type,
                  watcher.symbol,
                  watcher.interval,
                  watcher.walletId,
                  executionId,
                  15,
                  'Pending order created'
                );
              } catch (pendingError) {
                log('❌ Failed to create pending order', {
                  error: pendingError instanceof Error ? pendingError.message : String(pendingError),
                });
              }

              return;
            }

            actualEntryPrice = currentMarketPrice || setup.limitEntryPrice;
            log('📝 PAPER TRADING - LIMIT order filled immediately at market price', {
              walletType: wallet.walletType,
              direction: setup.direction,
              setupClosePrice: setup.entryPrice,
              limitEntryPrice: setup.limitEntryPrice,
              actualFillPrice: actualEntryPrice,
              orderType: 'LIMIT',
            });
          } else {
            log('📝 PAPER TRADING - Using current market price', {
              walletType: wallet.walletType,
              setupPrice: setup.entryPrice,
              orderType: 'MARKET',
            });

            if (currentMarketPrice) {
              actualEntryPrice = currentMarketPrice;
              log('✅ Using live market price for paper trading', {
                setupPrice: setup.entryPrice,
                marketPrice: currentMarketPrice,
                difference: `${((currentMarketPrice - setup.entryPrice) / setup.entryPrice * 100).toFixed(2)}%`,
              });
            } else {
              log('⚠️ No live price available, using setup price with slippage', {
                setupPrice: setup.entryPrice,
                priceUsed: expectedEntryWithSlippage,
              });
            }
          }
        } catch (priceError) {
          log('⚠️ Failed to get market price, using setup price with slippage', {
            error: priceError instanceof Error ? priceError.message : String(priceError),
          });
        }
      }

      if (setup.stopLoss && effectiveTakeProfit) {
        let risk: number;
        let reward: number;

        if (setup.direction === 'LONG') {
          risk = actualEntryPrice - setup.stopLoss;
          reward = effectiveTakeProfit - actualEntryPrice;
        } else {
          risk = setup.stopLoss - actualEntryPrice;
          reward = actualEntryPrice - effectiveTakeProfit;
        }

        if (risk <= 0) {
          log('❌ Invalid stop loss after price adjustment - no risk', {
            type: setup.type,
            direction: setup.direction,
            actualEntryPrice,
            stopLoss: setup.stopLoss,
          });
          return;
        }

        const finalRiskRewardRatio = reward / risk;

        if (finalRiskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
          log('❌ Setup rejected after price adjustment - insufficient final R:R ratio', {
            type: setup.type,
            direction: setup.direction,
            setupEntryPrice: setup.entryPrice,
            actualEntryPrice,
            stopLoss: setup.stopLoss,
            takeProfit: effectiveTakeProfit,
            risk: risk.toFixed(2),
            reward: reward.toFixed(2),
            originalRR: setup.riskRewardRatio.toFixed(2),
            finalRR: finalRiskRewardRatio.toFixed(2),
            minRequired: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
            priceDeviation: `${((actualEntryPrice - setup.entryPrice) / setup.entryPrice * 100).toFixed(2)}%`,
            orderType,
          });
          return;
        }

        log('✅ Final Risk/Reward ratio validated after price adjustment', {
          type: setup.type,
          direction: setup.direction,
          setupEntryPrice: setup.entryPrice.toFixed(6),
          actualEntryPrice: actualEntryPrice.toFixed(6),
          stopLoss: setup.stopLoss.toFixed(6),
          takeProfit: effectiveTakeProfit.toFixed(6),
          risk: risk.toFixed(6),
          reward: reward.toFixed(6),
          originalRR: setup.riskRewardRatio.toFixed(2),
          finalRR: finalRiskRewardRatio.toFixed(2),
        });
      }

      log('💾 Inserting trade execution into database', {
        executionId,
        setupType: setup.type,
        symbol: watcher.symbol,
        direction: setup.direction,
        finalEntryPrice: actualEntryPrice,
      });

      try {
        const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: watcher.userId,
          walletId: watcher.walletId,
          setupId,
          setupType: setup.type,
          symbol: watcher.symbol,
          side: setup.direction,
          entryPrice: actualEntryPrice.toString(),
          entryOrderId,
          stopLossOrderId,
          takeProfitOrderId,
          orderListId,
          quantity: actualQuantity.toFixed(8),
          stopLoss: setup.stopLoss?.toString(),
          takeProfit: effectiveTakeProfit?.toString(),
          openedAt: new Date(),
          status: 'open',
          entryOrderType: useLimit ? 'LIMIT' : 'MARKET',
          marketType: watcher.marketType,
          triggerKlineIndex: setup.triggerKlineIndex,
          triggerKlineOpenTime: triggerCandle?.openTime,
          triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
          triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
          fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
        });

        log('✅ Trade execution inserted into database', { executionId });

        const wsServiceOpen = getWebSocketService();
        if (wsServiceOpen) {
          wsServiceOpen.emitPositionUpdate(watcher.walletId, {
            id: executionId,
            symbol: watcher.symbol,
            side: setup.direction,
            status: 'open',
            entryPrice: actualEntryPrice.toString(),
            quantity: actualQuantity.toFixed(8),
            stopLoss: setup.stopLoss?.toString(),
            takeProfit: effectiveTakeProfit?.toString(),
            setupType: setup.type,
            fibonacciProjection: setup.fibonacciProjection,
          });
        }
      } catch (dbError) {
        log('❌ Failed to insert trade execution into database', {
          executionId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });
        throw dbError;
      }

      log('⏱️ Setting cooldown', {
        setupType: setup.type,
        symbol: watcher.symbol,
        interval: watcher.interval,
        walletId: watcher.walletId,
        cooldownMinutes: 15,
      });

      try {
        await cooldownService.setCooldown(
          setup.type,
          watcher.symbol,
          watcher.interval,
          watcher.walletId,
          executionId,
          15,
          'Trade executed'
        );

        log('✅ Cooldown set successfully', {
          setupType: setup.type,
          cooldownMinutes: 15,
        });
      } catch (cooldownError) {
        log('❌ Failed to set cooldown', {
          setupType: setup.type,
          error: cooldownError instanceof Error ? cooldownError.message : String(cooldownError),
        });
      }

      log('✅ Trade execution created', {
        executionId,
        setupType: setup.type,
        symbol: watcher.symbol,
        direction: setup.direction,
        entryPrice: actualEntryPrice,
        quantity: actualQuantity.toFixed(8),
        positionValue: (actualQuantity * actualEntryPrice).toFixed(2),
        stopLoss: setup.stopLoss,
        takeProfit: effectiveTakeProfit,
        confidence: setup.confidence,
        isLiveExecution,
        entryOrderId,
        cooldownMinutes: 15,
        tpMode: tpCalculationMode,
      });

      await positionMonitorService.invalidatePriceCache(watcher.symbol);
    } catch (error) {
      log('❌ Error executing setup', {
        type: setup.type,
        error: error instanceof Error ? error.message : String(error),
      });
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
    log('🔄 Restoring watchers from database...');

    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable);

    if (persistedWatchers.length === 0) {
      log('📭 No persisted watchers found');
      return;
    }

    log(`📋 Found ${persistedWatchers.length} persisted watcher(s)`);

    const requiredKlines = calculateRequiredKlines();

    for (const pw of persistedWatchers) {
      const marketType = (pw.marketType as MarketType) ?? 'SPOT';

      const result = await prefetchKlines({
        symbol: pw.symbol,
        interval: pw.interval,
        marketType,
        targetCount: requiredKlines,
      });

      if (!result.success) {
        log('❌ Failed to prefetch klines for watcher', { watcherId: pw.id, symbol: pw.symbol, error: result.error });
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
          pw.isManual
        );
        log('✅ Restored watcher', { watcherId: pw.id, symbol: pw.symbol, interval: pw.interval, profileId: pw.profileId, marketType: pw.marketType, isManual: pw.isManual });
      } catch (error) {
        log('❌ Failed to restore watcher', {
          watcherId: pw.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private getFibonacciTargetPrice(
    setup: TradingSetup,
    fibonacciTargetLevel: 'auto' | '1' | '1.272' | '1.618' | '2' = 'auto'
  ): number | null {
    const fib = setup.fibonacciProjection;
    if (!fib || !fib.levels || fib.levels.length === 0) return null;

    const targetLevel = fibonacciTargetLevel === 'auto'
      ? fib.primaryLevel
      : parseFloat(fibonacciTargetLevel);

    const targetLevelData = fib.levels.find(
      (l) => Math.abs(l.level - targetLevel) < 0.001
    );

    if (targetLevelData) {
      log('📊 Fibonacci target level resolved', {
        configLevel: fibonacciTargetLevel,
        primaryLevel: fib.primaryLevel,
        resolvedLevel: targetLevel,
        price: targetLevelData.price.toFixed(6),
      });
      return targetLevelData.price;
    }

    log('⚠️ Fibonacci target level not found in levels, falling back to 161.8%', {
      configLevel: fibonacciTargetLevel,
      primaryLevel: fib.primaryLevel,
      targetLevel,
      availableLevels: fib.levels.map(l => l.level),
    });

    const level1618 = fib.levels.find((l) => Math.abs(l.level - 1.618) < 0.001);
    return level1618?.price ?? null;
  }

  async startDynamicRotation(
    walletId: string,
    userId: string,
    config: {
      useDynamicSymbolSelection: boolean;
      dynamicSymbolLimit: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
    }
  ): Promise<void> {
    if (!config.useDynamicSymbolSelection) {
      log('ℹ️ Dynamic symbol selection is disabled', { walletId });
      return;
    }

    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);
    const optimalInterval = getOptimalRotationInterval(config.interval);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.dynamicSymbolLimit,
      interval: optimalInterval,
      excludedSymbols,
      marketType: config.marketType,
    };

    log('🔄 Starting dynamic symbol rotation', {
      walletId,
      limit: rotationConfig.limit,
      interval: rotationConfig.interval,
      excludedSymbols: excludedSymbols.length,
      marketType: config.marketType,
    });

    const initialResult = await rotationService.executeRotation(walletId, userId, rotationConfig);
    await this.applyRotation(walletId, userId, initialResult, config.interval, config.profileId, config.marketType);

    await rotationService.startRotation(walletId, userId, rotationConfig);

    log('✅ Dynamic symbol rotation started', {
      walletId,
      nextRotation: rotationService.getNextRotationTime(walletId)?.toISOString(),
    });
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    const rotationService = getDynamicSymbolRotationService();

    if (!rotationService.isRotationActive(walletId)) {
      log('ℹ️ No active rotation for wallet', { walletId });
      return;
    }

    rotationService.stopRotation(walletId);

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

      log('🛑 Stopped dynamic rotation and removed dynamic watchers', {
        walletId,
        watchersRemoved: dynamicWatchers.length,
      });
    } else {
      log('🛑 Stopped dynamic rotation (kept existing watchers)', { walletId });
    }
  }

  async applyRotation(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'SPOT'
  ): Promise<void> {
    log('📊 Applying rotation result', {
      walletId,
      toAdd: result.added.length,
      toRemove: result.removed.length,
      kept: result.kept.length,
      skippedWithPositions: result.skippedWithPositions.length,
    });

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
        log('🔻 Removed dynamic watcher', { walletId, symbol });
      }
    }

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
        await this.startWatcher(
          walletId,
          userId,
          symbol,
          interval,
          profileId,
          false,
          marketType,
          false,
          true
        );
        log('🔺 Added dynamic watcher with immediate check', { walletId, symbol });
      } else {
        log('ℹ️ Symbol already has watcher (possibly manual)', { walletId, symbol });
      }
    }

    log('✅ Rotation applied successfully', {
      walletId,
      added: result.added.length,
      removed: result.removed.length,
    });
  }

  async triggerManualRotation(
    walletId: string,
    userId: string,
    config: {
      dynamicSymbolLimit: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
    }
  ): Promise<RotationResult> {
    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.dynamicSymbolLimit,
      interval: '4h',
      excludedSymbols,
      marketType: config.marketType,
    };

    log('🔄 Triggering manual rotation', {
      walletId,
      limit: rotationConfig.limit,
      excludedSymbols: excludedSymbols.length,
    });

    const result = await rotationService.executeRotation(walletId, userId, rotationConfig);
    await this.applyRotation(walletId, userId, result, config.interval, config.profileId, config.marketType);

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
}

export const autoTradingScheduler = new AutoTradingScheduler();
