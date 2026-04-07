import type { Kline } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import {
  ABSOLUTE_MINIMUM_KLINES,
  AUTO_TRADING_BATCH,
  AUTO_TRADING_TIMING,
  TIME_MS,
} from '../../../constants';
import { db } from '../../../db';
import {
  autoTradingConfig,
  klines,
  tradingProfiles,
  wallets,
} from '../../../db/schema';
import { prefetchKlines, prefetchKlinesAsync } from '../../kline-prefetch';
import { PineStrategyLoader } from '../../pine/PineStrategyLoader';
import {
  createBatchResult,
  outputBatchResults,
  WatcherLogBuffer,
  type WatcherResult,
} from '../../watcher-batch-logger';
import { calculateRequiredKlines } from '../../../utils/kline-calculator';
import { serializeError } from '../../../utils/errors';
import type { AutoTradingConfig } from '../../../db/schema';
import { applyProfileOverrides } from '../../profile-applicator';
import type { ActiveWatcher, SignalProcessorDeps } from '../types';
import { log, yieldToEventLoop } from '../utils';
import {
  getIntervalMs,
  runSetupDetection,
  handleSemiAssistedSetups,
  emitLogsToWebSocket,
} from './signal-helpers';

const CANDLE_CLOSE_SAFETY_BUFFER_MS = AUTO_TRADING_TIMING.CANDLE_CLOSE_SAFETY_BUFFER_MS;
const BATCH_SIZE = parseInt(
  process.env['WATCHER_BATCH_SIZE'] ?? String(AUTO_TRADING_BATCH.WATCHER_BATCH_SIZE),
  10
);
const VERBOSE_BATCH_LOGS = process.env['VERBOSE_BATCH_LOGS'] === 'true';

export interface SignalProcessorConfig {
  strategiesDir: string;
}

export class SignalProcessor {
  private processingQueue: string[] = [];
  private isProcessingQueue = false;
  private batchCounter = 0;
  private cycleCounter = 0;
  private pendingResults: WatcherResult[] = [];
  private pendingCycleId: number | null = null;
  private pendingCycleStartTime: Date | null = null;
  private strategyLoader: PineStrategyLoader;
  private walletEconomyMode: Map<string, boolean> = new Map();

  constructor(
    private deps: SignalProcessorDeps,
    config: SignalProcessorConfig
  ) {
    this.strategyLoader = new PineStrategyLoader([config.strategiesDir]);
  }

  queueWatcherProcessing(watcherId: string): void {
    if (!this.processingQueue.includes(watcherId)) {
      this.processingQueue.push(watcherId);
    }
    void this.processWatcherQueue();
  }

  addToProcessingQueue(watcherIds: string[]): void {
    for (const watcherId of watcherIds) {
      if (!this.processingQueue.includes(watcherId)) {
        this.processingQueue.push(watcherId);
      }
    }
    void this.processWatcherQueue();
  }

  private async processWatcherQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    if (this.pendingCycleId === null) {
      this.cycleCounter++;
      this.pendingCycleId = this.cycleCounter;
      this.pendingCycleStartTime = new Date();
      this.pendingResults = [];

      const newWatcherIds = await this.deps.checkAllRotationsOnce();

      if (newWatcherIds.length > 0) {
        log('> [DynamicRotation] Adding new watchers to current cycle', {
          count: newWatcherIds.length,
          watcherIds: newWatcherIds.slice(0, 5).join(', ') + (newWatcherIds.length > 5 ? '...' : ''),
        });
        this.processingQueue.push(...newWatcherIds);
      }
    }

    while (this.processingQueue.length > 0) {
      this.batchCounter++;

      const batch: string[] = [];
      while (batch.length < BATCH_SIZE && this.processingQueue.length > 0) {
        const watcherId = this.processingQueue.shift();
        if (watcherId) batch.push(watcherId);
      }

      if (batch.length === 0) break;

      const results = await Promise.all(
        batch.map((watcherId) => this.processWatcherWithBuffer(watcherId))
      );

      for (const result of results) {
        const existingIndex = this.pendingResults.findIndex(r => r.watcherId === result.watcherId);
        if (existingIndex >= 0) {
          this.pendingResults[existingIndex] = result;
        } else {
          this.pendingResults.push(result);
        }
      }

      await yieldToEventLoop();
    }

    const hasPendingWatchers = this.pendingResults.some(r => r.status === 'pending');

    if (this.pendingResults.length > 0) {
      const unifiedResult = createBatchResult(
        this.pendingCycleId,
        this.pendingCycleStartTime!,
        this.pendingResults
      );
      outputBatchResults(unifiedResult, VERBOSE_BATCH_LOGS, this.deps.getConfigCacheStats());

      emitLogsToWebSocket(unifiedResult.watcherResults, this.deps.getActiveWatchers());

      if (!hasPendingWatchers) {
        this.pendingCycleId = null;
        this.pendingCycleStartTime = null;
        this.pendingResults = [];
      }
    }

    this.isProcessingQueue = false;
  }

  private async processWatcherWithBuffer(watcherId: string): Promise<WatcherResult> {
    const activeWatchers = this.deps.getActiveWatchers();
    const watcher = activeWatchers.get(watcherId);
    if (!watcher) {
      return {
        watcherId,
        symbol: 'unknown',
        interval: 'unknown',
        marketType: 'unknown',
        status: 'error',
        reason: 'Watcher not found',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      };
    }

    const logBuffer = new WatcherLogBuffer(
      watcherId,
      watcher.symbol,
      watcher.interval,
      watcher.marketType,
      watcher.profileName
    );

    const isRecentlyRotated = this.deps.isWatcherRecentlyRotated(watcherId);

    try {
      const result = await this.processWatcherCore(watcher, logBuffer);
      result.isRecentlyRotated = isRecentlyRotated;
      return result;
    } catch (error) {
      logBuffer.error('✗', 'Error processing watcher', {
        error: serializeError(error),
      });
      const result = logBuffer.toResult('error', serializeError(error));
      result.isRecentlyRotated = isRecentlyRotated;
      return result;
    }
  }

  private async processWatcherCore(
    watcher: ActiveWatcher,
    logBuffer: WatcherLogBuffer
  ): Promise<WatcherResult> {
    const watcherId = `${watcher.walletId}-${watcher.symbol}-${watcher.interval}-${watcher.marketType}`;

    if (this.deps.isWalletPaused(watcher.walletId)) {
      logBuffer.log('~', 'Wallet paused (no free capital)');
      return logBuffer.toResult('skipped', 'Wallet paused - no free capital');
    }

    logBuffer.log('>', 'Processing watcher');

    const [[walletRow], [baseConfig]] = await Promise.all([
      db.select({ currentBalance: wallets.currentBalance })
        .from(wallets).where(eq(wallets.id, watcher.walletId)).limit(1),
      db.select().from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, watcher.walletId)).limit(1),
    ]);

    let effectiveConfig: AutoTradingConfig | null = baseConfig ?? null;
    if (effectiveConfig && watcher.profileId) {
      const [profileRow] = await db.select().from(tradingProfiles)
        .where(eq(tradingProfiles.id, watcher.profileId)).limit(1);
      if (profileRow) effectiveConfig = applyProfileOverrides(effectiveConfig, profileRow);
    }

    const walletBalance = parseFloat(walletRow?.currentBalance ?? '0');
    const leverage = effectiveConfig?.leverage ?? 1;
    const availableCapital = walletBalance * leverage;
    const wasInEconomyMode = this.walletEconomyMode.get(watcher.walletId) ?? false;

    if (availableCapital <= TRADING_DEFAULTS.MIN_TRADE_VALUE_USD) {
      this.walletEconomyMode.set(watcher.walletId, true);
      logBuffer.log('~', 'Economy mode - no available capital', {
        balance: walletBalance.toFixed(2),
        leverage,
        available: availableCapital.toFixed(2),
      });
      return logBuffer.toResult('skipped', 'Economy mode - waiting for capital');
    }

    if (wasInEconomyMode) {
      this.walletEconomyMode.set(watcher.walletId, false);
      logBuffer.log('>', 'Waking up from economy mode', {
        balance: walletBalance.toFixed(2),
        available: availableCapital.toFixed(2),
      });
      await this.deps.checkAllRotationsOnce();
    }

    const directionMode = effectiveConfig?.directionMode ?? 'auto';

    const strategies = await this.strategyLoader.loadAllCached();
    const filteredStrategies = strategies.filter((s) =>
      watcher.enabledStrategies.includes(s.metadata.id)
    );

    const klinesAndCandle = await this.loadKlinesData(watcher, watcherId, logBuffer);
    if (!klinesAndCandle) return logBuffer.toResult('pending', 'Kline backfill in progress');
    if (klinesAndCandle === 'no-candles') {
      logBuffer.warn('!', 'No closed candles available');
      return logBuffer.toResult('skipped', 'No closed candles');
    }

    const { closedKlines, lastCandle } = klinesAndCandle;

    const timingResult = await this.handleCandleTiming(watcher, watcherId, lastCandle, logBuffer);
    if (timingResult) return timingResult;

    if (watcher.lastProcessedCandleOpenTime === lastCandle.openTime) {
      logBuffer.log('~', 'Candle already processed');
      return logBuffer.toResult('skipped', 'Already processed');
    }

    logBuffer.log('>', 'Scanning for setups', {
      strategies: filteredStrategies.length,
      directionMode,
      klines: closedKlines.length,
    });

    const detectedSetups = await runSetupDetection(
      closedKlines, filteredStrategies, effectiveConfig, directionMode, watcher, logBuffer
    );

    watcher.lastProcessedCandleOpenTime = lastCandle.openTime;

    this.deps.incrementBarsForOpenTrades(watcher.symbol, watcher.interval, parseFloat(lastCandle.close)).catch((error: unknown) => {
      logBuffer.warn('!', 'Failed to increment bars for open trades', {
        error: serializeError(error),
      });
    });

    if (detectedSetups.length === 0) {
      logBuffer.log('·', 'No setups found');
      watcher.lastProcessedTime = Date.now();
      return logBuffer.toResult('success', undefined, closedKlines.length);
    }

    const effectiveTradingMode = effectiveConfig?.tradingMode ?? 'auto';

    if (effectiveTradingMode === 'semi_assisted') {
      await handleSemiAssistedSetups(
        detectedSetups, watcher, watcherId, effectiveConfig,
        filteredStrategies, closedKlines, lastCandle, this.deps, logBuffer
      );
      watcher.lastProcessedTime = Date.now();
      return logBuffer.toResult('success', undefined, closedKlines.length);
    }

    for (const setup of detectedSetups) {
      const executed = await this.deps.executeSetupSafe(watcher, setup, filteredStrategies, closedKlines, logBuffer);
      if (executed) {
        logBuffer.incrementTrades();
      }
    }

    watcher.lastProcessedTime = Date.now();
    return logBuffer.toResult('success', undefined, closedKlines.length);
  }

  private async loadKlinesData(
    watcher: ActiveWatcher,
    watcherId: string,
    logBuffer: WatcherLogBuffer
  ): Promise<{ closedKlines: Kline[]; lastCandle: Kline } | null | 'no-candles'> {
    const requiredKlines = calculateRequiredKlines();
    const minRequired = ABSOLUTE_MINIMUM_KLINES;

    let klinesData = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, watcher.symbol),
        eq(klines.interval, watcher.interval),
        eq(klines.marketType, watcher.marketType)
      ),
      orderBy: [desc(klines.openTime)],
      limit: requiredKlines,
    });

    if (klinesData.length < minRequired) {
      logBuffer.log('>', 'Kline backfill in progress', { count: klinesData.length, required: minRequired });
      prefetchKlinesAsync({
        symbol: watcher.symbol,
        interval: watcher.interval,
        marketType: watcher.marketType,
        targetCount: requiredKlines,
        silent: true,
      });
      setTimeout(() => {
        this.queueWatcherProcessing(watcherId);
      }, AUTO_TRADING_TIMING.BACKFILL_RECHECK_MS);
      return null;
    }

    klinesData.reverse();

    const now = Date.now();
    const intervalMs = getIntervalMs(watcher.interval);
    const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;

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

    const closedKlines = mappedKlines.filter(k => k.openTime < currentCandleOpenTime);
    const lastCandle = closedKlines[closedKlines.length - 1];
    if (!lastCandle) return 'no-candles';

    return { closedKlines, lastCandle };
  }

  private async handleCandleTiming(
    watcher: ActiveWatcher,
    watcherId: string,
    lastCandle: Kline,
    logBuffer: WatcherLogBuffer
  ): Promise<WatcherResult | null> {
    const now = Date.now();
    const intervalMs = getIntervalMs(watcher.interval);

    const pendingRotation = this.deps.getRotationPendingWatcher(watcherId);
    if (pendingRotation) {
      const targetSafeTime = pendingRotation.targetCandleClose + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      if (now < targetSafeTime) {
        const remainingMs = targetSafeTime - now;
        logBuffer.log('>', 'Rotation sync pending', {
          targetCandleClose: new Date(pendingRotation.targetCandleClose).toISOString(),
          remainingMs,
        });

        if (remainingMs > 0 && remainingMs < 10 * TIME_MS.MINUTE) {
          setTimeout(() => {
            this.queueWatcherProcessing(watcherId);
          }, Math.min(remainingMs + 100, 5000));
        }

        return logBuffer.toResult('pending', `Rotation sync: ${Math.ceil(remainingMs / 1000)}s`);
      }

      this.deps.deleteRotationPendingWatcher(watcherId);
      logBuffer.log('✓', 'Rotation sync complete, processing normally');
    }

    const expectedCandleOpenTime = Math.floor(now / intervalMs) * intervalMs - intervalMs;
    const candleCloseTime = lastCandle.closeTime;
    const safeCloseTime = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
    const isCandleClosed = now >= safeCloseTime;

    if (lastCandle.openTime < expectedCandleOpenTime) {
      const missingCandleCloseTime = expectedCandleOpenTime + intervalMs;
      const safeMissingClose = missingCandleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      const waitMs = Math.max(0, safeMissingClose - now);

      if (waitMs > 0 && waitMs < 10000) {
        logBuffer.log('~', 'Waiting for latest candle', {
          expected: new Date(expectedCandleOpenTime).toISOString(),
          actual: new Date(lastCandle.openTime).toISOString(),
          waitMs,
        });

        setTimeout(() => {
          this.queueWatcherProcessing(watcherId);
        }, waitMs + 500);

        return logBuffer.toResult('pending', `Waiting for latest candle (${Math.ceil(waitMs / 1000)}s)`);
      }

      logBuffer.log('>', 'Fetching latest candle', {
        expected: new Date(expectedCandleOpenTime).toISOString(),
        actual: new Date(lastCandle.openTime).toISOString(),
      });

      const requiredKlines = calculateRequiredKlines();
      const result = await prefetchKlines({
        symbol: watcher.symbol,
        interval: watcher.interval,
        marketType: watcher.marketType,
        targetCount: requiredKlines,
        silent: true,
      });

      if (result.success && result.downloaded > 0) {
        setTimeout(() => {
          this.queueWatcherProcessing(watcherId);
        }, 500);

        return logBuffer.toResult('pending', 'Fetched missing candle, reprocessing');
      }
    }

    if (!isCandleClosed) {
      const remainingMs = safeCloseTime - now;
      const maxWaitMs = 5 * 60 * 1000;
      const waitMs = Math.min(remainingMs, maxWaitMs);

      if (waitMs > 0) {
        setTimeout(() => {
          this.queueWatcherProcessing(watcherId);
        }, waitMs + 100);
      }

      return logBuffer.toResult('pending', `Candle closes in ${Math.ceil(remainingMs / 1000)}s`);
    }

    return null;
  }

}
