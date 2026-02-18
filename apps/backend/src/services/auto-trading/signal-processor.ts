import type { Kline, TimeInterval, TradingSetup } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import {
  ABSOLUTE_MINIMUM_KLINES,
  AUTO_TRADING_BATCH,
  AUTO_TRADING_TIMING,
  TIME_MS,
  UNIT_MS,
} from '../../constants';
import { db } from '../../db';
import {
  autoTradingConfig,
  klines,
  wallets,
} from '../../db/schema';
import { meetsKlineRequirementWithTolerance, prefetchKlines } from '../kline-prefetch';
import { StrategyInterpreter, StrategyLoader } from '../setup-detection/dynamic';
import {
  createBatchResult,
  outputBatchResults,
  WatcherLogBuffer,
  type SetupLogEntry,
  type WatcherResult,
} from '../watcher-batch-logger';
import { autoTradingLogBuffer, type FrontendLogEntry } from '../auto-trading-log-buffer';
import { getWebSocketService } from '../websocket';
import { calculateRequiredKlines } from '../../utils/kline-calculator';
import { serializeError } from '../../utils/errors';
import type { ActiveWatcher, SignalProcessorDeps } from './types';
import { log, yieldToEventLoop } from './utils';
import { isDirectionAllowed } from '../../utils/trading-validation';

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
  private processedThisCycle: Set<string> = new Set();
  private batchCounter = 0;
  private cycleCounter = 0;
  private pendingResults: WatcherResult[] = [];
  private pendingCycleId: number | null = null;
  private pendingCycleStartTime: Date | null = null;
  private strategyLoader: StrategyLoader;
  private walletEconomyMode: Map<string, boolean> = new Map();

  constructor(
    private deps: SignalProcessorDeps,
    config: SignalProcessorConfig
  ) {
    this.strategyLoader = new StrategyLoader([config.strategiesDir]);
  }

  queueWatcherProcessing(watcherId: string): void {
    if (this.processedThisCycle.has(watcherId)) {
      return;
    }
    if (!this.processingQueue.includes(watcherId)) {
      this.processingQueue.push(watcherId);
      void this.processWatcherQueue();
    }
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
        if (result.status !== 'pending') {
          this.processedThisCycle.add(result.watcherId);
        }
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

      this.emitLogsToWebSocket(unifiedResult.watcherResults);

      if (!hasPendingWatchers) {
        this.pendingCycleId = null;
        this.pendingCycleStartTime = null;
        this.pendingResults = [];
        this.processedThisCycle.clear();
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

  private getIntervalMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
    const unitMs = UNIT_MS[match[2]];
    if (!unitMs) return 4 * TIME_MS.HOUR;
    return parseInt(match[1]) * unitMs;
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

    const [walletWithConfig] = await db
      .select({
        currentBalance: wallets.currentBalance,
        leverage: autoTradingConfig.leverage,
        directionMode: autoTradingConfig.directionMode,
        maxFibonacciEntryProgressPercent: autoTradingConfig.maxFibonacciEntryProgressPercent,
        fibonacciSwingRange: autoTradingConfig.fibonacciSwingRange,
        minRiskRewardRatioLong: autoTradingConfig.minRiskRewardRatioLong,
        minRiskRewardRatioShort: autoTradingConfig.minRiskRewardRatioShort,
      })
      .from(wallets)
      .leftJoin(autoTradingConfig, eq(wallets.id, autoTradingConfig.walletId))
      .where(eq(wallets.id, watcher.walletId))
      .limit(1);

    const walletBalance = parseFloat(walletWithConfig?.currentBalance ?? '0');
    const leverage = walletWithConfig?.leverage ?? 1;
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

    const directionMode = walletWithConfig?.directionMode ?? 'auto';

    const strategies = await this.strategyLoader.loadAll({ includeUnprofitable: false });
    const filteredStrategies = strategies.filter((s) => {
      if (!watcher.enabledStrategies.includes(s.id)) return false;
      if (!isDirectionAllowed(directionMode, 'SHORT') && !s.entry.long) return false;
      if (!isDirectionAllowed(directionMode, 'LONG') && !s.entry.short) return false;
      return true;
    });

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
      logBuffer.log('>', 'Backfilling klines', { count: klinesData.length, required: minRequired });

      const result = await prefetchKlines({
        symbol: watcher.symbol,
        interval: watcher.interval,
        marketType: watcher.marketType,
        targetCount: requiredKlines,
      });

      if (!result.success) {
        logBuffer.error('✗', 'Failed to fetch klines', { error: result.error });
        return logBuffer.toResult('error', 'Failed to fetch klines');
      }

      const hasReachedApiLimit = result.alreadyComplete || result.gaps === 0;

      if (!meetsKlineRequirementWithTolerance(result.totalInDb, minRequired, hasReachedApiLimit)) {
        logBuffer.warn('!', 'Insufficient klines', {
          totalInDb: result.totalInDb,
          minRequired,
          apiExhausted: hasReachedApiLimit,
        });
        return logBuffer.toResult('skipped', 'Insufficient klines', result.totalInDb);
      }

      if (result.downloaded > 0) {
        klinesData = await db.query.klines.findMany({
          where: and(
            eq(klines.symbol, watcher.symbol),
            eq(klines.interval, watcher.interval),
            eq(klines.marketType, watcher.marketType)
          ),
          orderBy: [desc(klines.openTime)],
          limit: requiredKlines,
        });
      }
    }

    klinesData.reverse();

    const now = Date.now();
    const intervalMs = this.getIntervalMs(watcher.interval);
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
    if (!lastCandle) {
      logBuffer.warn('!', 'No closed candles available');
      return logBuffer.toResult('skipped', 'No closed candles');
    }

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

    if (watcher.lastProcessedCandleOpenTime === lastCandle.openTime) {
      logBuffer.log('~', 'Candle already processed');
      return logBuffer.toResult('skipped', 'Already processed');
    }

    logBuffer.log('>', 'Scanning for setups', {
      strategies: filteredStrategies.length,
      directionMode,
      klines: closedKlines.length,
    });

    const detectedSetups: TradingSetup[] = [];
    const currentIndex = closedKlines.length - 1;

    for (const strategy of filteredStrategies) {
      await yieldToEventLoop();

      const minRRLong = walletWithConfig?.minRiskRewardRatioLong
        ? parseFloat(walletWithConfig.minRiskRewardRatioLong)
        : TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO;
      const minRRShort = walletWithConfig?.minRiskRewardRatioShort
        ? parseFloat(walletWithConfig.minRiskRewardRatioShort)
        : TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO;

      const interpreter = new StrategyInterpreter({
        enabled: true,
        minConfidence: 50,
        minRiskReward: Math.min(minRRLong, minRRShort),
        strategy,
        silent: true,
        interval: watcher.interval as TimeInterval,
        directionMode: directionMode !== 'auto' ? directionMode as 'long_only' | 'short_only' : undefined,
        maxFibonacciEntryProgressPercent: walletWithConfig?.maxFibonacciEntryProgressPercent ? parseFloat(walletWithConfig.maxFibonacciEntryProgressPercent) : undefined,
        fibonacciSwingRange: walletWithConfig?.fibonacciSwingRange ?? undefined,
      });

      const result = interpreter.detect(closedKlines, currentIndex);

      if (result.rejection) {
        const rejectionDirection = result.rejection.details?.['direction'] as string | undefined;
        const entryPrice = result.rejection.details?.['entryPrice'] as number | undefined;

        if (rejectionDirection && rejectionDirection !== '-') {
          const lastKline = closedKlines[closedKlines.length - 1];
          const currentPrice = lastKline ? parseFloat(lastKline.close) : 0;

          logBuffer.startSetupValidation({
            type: strategy.name,
            direction: rejectionDirection as 'LONG' | 'SHORT',
            entryPrice: entryPrice ?? currentPrice,
            confidence: result.confidence ?? 0,
          });

          const reasonKey = result.rejection.reason.split(':')[0]?.trim() ?? result.rejection.reason;
          const detailValues = result.rejection.details
            ? Object.entries(result.rejection.details)
                .filter(([k]) => k !== 'direction' && k !== 'entryPrice')
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')
            : '';

          logBuffer.addValidationCheck({
            name: reasonKey,
            passed: false,
            reason: detailValues || result.rejection.reason,
          });

          logBuffer.completeSetupValidation('blocked', result.rejection.reason);
        }

        logBuffer.addRejection({
          setupType: strategy.name,
          direction: rejectionDirection ?? '-',
          reason: result.rejection.reason,
          details: result.rejection.details,
        });
      }

      if (result.setup && result.confidence >= 50) {
        const setupWithTriggerData = {
          ...result.setup,
          triggerKlineIndex: result.triggerKlineIndex,
          triggerCandleData: result.triggerCandleData,
          triggerIndicatorValues: result.triggerIndicatorValues,
        };
        detectedSetups.push(setupWithTriggerData);

        const setupEntry: SetupLogEntry = {
          type: result.setup.type,
          direction: result.setup.direction,
          confidence: result.confidence,
          entryPrice: result.setup.entryPrice?.toFixed(6) ?? '-',
          stopLoss: result.setup.stopLoss?.toFixed(6) ?? '-',
          takeProfit: result.setup.takeProfit?.toFixed(6) ?? '-',
          riskReward: result.setup.riskRewardRatio?.toFixed(2) ?? '-',
        };
        logBuffer.addSetup(setupEntry);
        logBuffer.log('>', 'Setup detected', {
          type: result.setup.type,
          direction: result.setup.direction,
          confidence: result.confidence,
        });
      }
    }

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

    for (const setup of detectedSetups) {
      const executed = await this.deps.executeSetupSafe(watcher, setup, filteredStrategies, closedKlines, logBuffer);
      if (executed) {
        logBuffer.incrementTrades();
      }
    }

    watcher.lastProcessedTime = Date.now();
    return logBuffer.toResult('success', undefined, closedKlines.length);
  }

  private emitLogsToWebSocket(watcherResults: WatcherResult[]): void {
    const wsService = getWebSocketService();
    if (!wsService) return;

    const activeWatchers = this.deps.getActiveWatchers();
    for (const result of watcherResults) {
      const watcher = activeWatchers.get(result.watcherId);
      if (!watcher) continue;

      for (const logEntry of result.logs) {
        const entry: FrontendLogEntry = autoTradingLogBuffer.addLog(watcher.walletId, {
          timestamp: logEntry.timestamp.getTime(),
          level: logEntry.level,
          emoji: logEntry.emoji,
          message: logEntry.message,
          symbol: result.symbol,
          interval: result.interval,
        });
        wsService.emitAutoTradingLog(watcher.walletId, entry);
      }
    }
  }
}
