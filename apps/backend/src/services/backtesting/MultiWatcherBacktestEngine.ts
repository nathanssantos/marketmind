import type {
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestTrade,
  ConflictStats,
  FibonacciProjectionData,
  Interval,
  Kline,
  MultiWatcherBacktestConfig,
  MultiWatcherBacktestResult,
  StrategyDefinition,
  TimelineEvent,
  TradingSetup,
  WatcherConfig,
  WatcherStats,
} from '@marketmind/types';
import { getDefaultFee, getRoundTripFee } from '@marketmind/types';
import { calculatePositionSize } from '@marketmind/risk';
import { calculateATR } from '@marketmind/indicators';
import { computeTrailingStopCore, type TrailingStopCoreConfig } from '../trailing-stop-core';
import { checkStochasticCondition, STOCHASTIC_FILTER } from '../../utils/stochastic-filter';
import { checkAdxCondition, ADX_FILTER } from '../../utils/adx-filter';
import { checkTrendCondition, TREND_FILTER } from '../../utils/trend-filter';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { BACKTEST_ENGINE, TIME_MS, UNIT_MS } from '../../constants';
import { db } from '../../db';
import { klines as klinesTable } from '../../db/schema';
import { generateEntityId } from '../../utils/id';
import { smartBackfillKlines } from '../binance-historical';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { StrategyLoader } from '../setup-detection/dynamic';
import { SharedPortfolioManager, type TradeResult as PortfolioTradeResult, type PortfolioConfig } from './SharedPortfolioManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WatcherState {
  config: WatcherConfig;
  klines: Kline[];
  simulationKlines?: Kline[];
  detectedSetups: TradingSetup[];
  strategies: StrategyDefinition[];
  stats: WatcherStats;
}

interface SetupEvent {
  timestamp: number;
  watcherSymbol: string;
  watcherInterval: string;
  setup: TradingSetup;
  klineIndex: number;
}

export class MultiWatcherBacktestEngine {
  private watchers: Map<string, WatcherState> = new Map();
  private portfolio!: SharedPortfolioManager;
  private timeline: TimelineEvent[] = [];
  private conflictStats: ConflictStats = {
    totalConflicts: 0,
    resolvedBy: {},
    conflictsPerWatcher: {},
  };
  private trailingStopConfig: TrailingStopCoreConfig;

  constructor(private config: MultiWatcherBacktestConfig) {
    const marketType = config.marketType ?? 'SPOT';
    const useBnbDiscount = config.useBnbDiscount ?? false;

    this.trailingStopConfig = {
      marketType,
      useBnbDiscount,
      feePercent: getRoundTripFee({ marketType, useBnbDiscount }),
      atrMultiplier: config.trailingATRMultiplier ?? 2.0,
      minTrailingDistancePercent: 0.002,
      trailingDistancePercent: 0.25,
    };
  }

  async run(): Promise<MultiWatcherBacktestResult> {
    const backtestId = generateEntityId();
    const startTime = Date.now();

    console.log('[MultiWatcherBacktest] Starting backtest', backtestId);
    console.log('[MultiWatcherBacktest] Watchers:', this.config.watchers.length);
    console.log('[MultiWatcherBacktest] Date range:', this.config.startDate, 'to', this.config.endDate);

    const portfolioConfig: PortfolioConfig = {
      initialCapital: this.config.initialCapital,
      exposureMultiplier: this.config.exposureMultiplier ?? 1.5,
      maxPositionSizePercent: this.config.maxPositionSize ?? 10,
      maxConcurrentPositions: this.config.watchers.length,
      dailyLossLimitPercent: this.config.dailyLossLimit ?? 5,
      cooldownMinutes: this.config.cooldownMinutes ?? 15,
      useStochasticFilter: this.config.useStochasticFilter ?? false,
      useAdxFilter: this.config.useAdxFilter ?? false,
      useTrendFilter: this.config.onlyWithTrend ?? false,
      minRiskRewardRatio: this.config.minRiskRewardRatio ?? 1.25,
    };

    this.portfolio = new SharedPortfolioManager(portfolioConfig, this.config.watchers.length);

    await this.initializeWatchers();

    const unifiedTimeline = this.buildUnifiedTimeline();
    console.log('[MultiWatcherBacktest] Unified timeline events:', unifiedTimeline.length);

    const equityCurve: BacktestEquityPoint[] = [
      {
        time: this.config.startDate,
        equity: this.config.initialCapital,
        drawdown: 0,
        drawdownPercent: 0,
      },
    ];

    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let eventsProcessed = 0;
    const totalEvents = unifiedTimeline.length;
    const progressInterval = Math.max(1000, Math.floor(totalEvents / 10));

    for (const event of unifiedTimeline) {
      await this.processSetupEvent(event);

      eventsProcessed++;
      if (eventsProcessed % progressInterval === 0) {
        const progress = ((eventsProcessed / totalEvents) * 100).toFixed(0);
        console.log(`[MultiWatcherBacktest] Progress: ${progress}% (${eventsProcessed}/${totalEvents} events)`);
      }

      const currentDrawdown = this.portfolio.getMaxDrawdown();
      const currentDrawdownPercent = this.portfolio.getMaxDrawdownPercent();

      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
        maxDrawdownPercent = currentDrawdownPercent;
      }
    }

    this.closeRemainingPositions();

    const trades = this.convertToBacktestTrades();
    const watcherStats = this.buildWatcherStats();
    const metrics = this.calculateMetrics(trades, maxDrawdown, maxDrawdownPercent);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('[MultiWatcherBacktest] Completed in', duration, 'ms');
    console.log('[MultiWatcherBacktest] Total trades:', trades.length);
    console.log('[MultiWatcherBacktest] Final equity:', this.portfolio.getEquity().toFixed(2));

    return {
      id: backtestId,
      config: this.config,
      trades,
      metrics,
      equityCurve,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      status: 'COMPLETED',
      watcherStats,
      timeline: this.timeline,
      conflictStats: this.conflictStats,
    };
  }

  private async initializeWatchers(): Promise<void> {
    const strategiesDir = resolve(__dirname, '../../../strategies/builtin');
    const loader = new StrategyLoader([strategiesDir]);
    const allStrategies = await loader.loadAll({ includeUnprofitable: true });

    const useTrailingStop = this.config.useTrailingStop ?? false;
    const simulationInterval = this.config.trailingStopSimulationInterval;
    const needSimulationKlines = useTrailingStop && simulationInterval;

    if (needSimulationKlines) {
      console.log(`[MultiWatcherBacktest] Trailing stop simulation enabled with ${simulationInterval} interval`);
    }

    for (const watcherConfig of this.config.watchers) {
      const watcherId = `${watcherConfig.symbol}-${watcherConfig.interval}`;
      console.log(`[MultiWatcherBacktest] Initializing watcher: ${watcherId}`);

      const klines = await this.fetchKlines(watcherConfig);
      console.log(`[MultiWatcherBacktest] Fetched ${klines.length} klines for ${watcherId}`);

      let simulationKlines: Kline[] | undefined;
      if (needSimulationKlines) {
        simulationKlines = await this.fetchSimulationKlines(watcherConfig, simulationInterval);
        console.log(`[MultiWatcherBacktest] Fetched ${simulationKlines.length} simulation klines (${simulationInterval}) for ${watcherId}`);
      }

      const setupTypes = watcherConfig.setupTypes ?? this.config.setupTypes ?? [];
      const watcherStrategies = allStrategies.filter((s) => setupTypes.includes(s.id));

      const setups = await this.detectSetups(watcherConfig, klines, watcherStrategies);
      console.log(`[MultiWatcherBacktest] Detected ${setups.length} setups for ${watcherId}`);

      this.watchers.set(watcherId, {
        config: watcherConfig,
        klines,
        simulationKlines,
        detectedSetups: setups,
        strategies: watcherStrategies,
        stats: this.initWatcherStats(watcherConfig),
      });
    }
  }

  private async fetchKlines(watcherConfig: WatcherConfig): Promise<Kline[]> {
    const marketType = watcherConfig.marketType ?? 'FUTURES';
    const intervalMs = this.getIntervalMs(watcherConfig.interval);
    const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
    const startTime = new Date(new Date(this.config.startDate).getTime() - warmupMs);
    const endTime = new Date(this.config.endDate);

    return this.fetchKlinesFromDbWithBackfill(
      watcherConfig.symbol,
      watcherConfig.interval as Interval,
      marketType,
      startTime,
      endTime
    );
  }

  private async fetchSimulationKlines(watcherConfig: WatcherConfig, simulationInterval: Interval): Promise<Kline[]> {
    const marketType = watcherConfig.marketType ?? 'FUTURES';
    const startTime = new Date(this.config.startDate);
    const endTime = new Date(this.config.endDate);

    return this.fetchKlinesFromDbWithBackfill(
      watcherConfig.symbol,
      simulationInterval,
      marketType,
      startTime,
      endTime
    );
  }

  private async fetchKlinesFromDbWithBackfill(
    symbol: string,
    interval: Interval,
    marketType: 'SPOT' | 'FUTURES',
    startTime: Date,
    endTime: Date
  ): Promise<Kline[]> {
    const intervalMs = this.getIntervalMs(interval);
    const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / intervalMs);
    const minRequired = Math.max(50, Math.ceil(expectedKlines * 0.5));

    let dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klinesTable.symbol, symbol),
        eq(klinesTable.interval, interval),
        eq(klinesTable.marketType, marketType),
        gte(klinesTable.openTime, startTime),
        lte(klinesTable.openTime, endTime)
      ),
      orderBy: [desc(klinesTable.openTime)],
    });

    if (dbKlines.length < minRequired) {
      console.log(`[MultiWatcherBacktest] Insufficient klines in DB (${dbKlines.length}/${minRequired}), running smart backfill...`);

      const backfillResult = await smartBackfillKlines(symbol, interval, expectedKlines, marketType);
      console.log(`[MultiWatcherBacktest] Backfill complete: downloaded ${backfillResult.downloaded}, total in DB: ${backfillResult.totalInDb}`);

      dbKlines = await db.query.klines.findMany({
        where: and(
          eq(klinesTable.symbol, symbol),
          eq(klinesTable.interval, interval),
          eq(klinesTable.marketType, marketType),
          gte(klinesTable.openTime, startTime),
          lte(klinesTable.openTime, endTime)
        ),
        orderBy: [desc(klinesTable.openTime)],
      });
    }

    return mapDbKlinesReversed(dbKlines);
  }

  private async detectSetups(
    _watcherConfig: WatcherConfig,
    klines: Kline[],
    strategies: StrategyDefinition[]
  ): Promise<TradingSetup[]> {
    if (strategies.length === 0) return [];

    const setupDetectionService = new SetupDetectionService({});
    const strategyOverrides = this.config.strategyParams || {};

    for (const strategy of strategies) {
      setupDetectionService.loadStrategy(strategy, strategyOverrides);
    }

    const warmupPeriod = BACKTEST_ENGINE.EMA200_WARMUP_BARS;
    const userStartTimestamp = new Date(this.config.startDate).getTime();

    const detectedSetups = setupDetectionService.detectSetupsInRange(
      klines,
      warmupPeriod,
      klines.length - 1
    );

    return detectedSetups.filter((s) => s.openTime >= userStartTimestamp);
  }

  private buildUnifiedTimeline(): SetupEvent[] {
    const events: SetupEvent[] = [];

    for (const [_watcherId, watcher] of this.watchers) {
      for (const setup of watcher.detectedSetups) {
        const klineIndex = watcher.klines.findIndex((k) => k.openTime === setup.openTime);

        events.push({
          timestamp: setup.openTime,
          watcherSymbol: watcher.config.symbol,
          watcherInterval: watcher.config.interval,
          setup,
          klineIndex,
        });
      }
    }

    events.sort((a, b) => a.timestamp - b.timestamp);

    return events;
  }

  private applyIndicatorFilters(
    klines: Kline[],
    direction: 'LONG' | 'SHORT',
    strategy: StrategyDefinition | undefined,
    stats: WatcherStats
  ): { passed: boolean } {
    const globalStochasticEnabled = this.config.useStochasticFilter === true;
    if (globalStochasticEnabled) {
      const requiredKlines = STOCHASTIC_FILTER.PERIOD + STOCHASTIC_FILTER.LOOKBACK_BUFFER + 1;
      if (klines.length >= requiredKlines) {
        const stochResult = checkStochasticCondition(klines, direction);
        if (!stochResult.isAllowed) {
          stats.tradesSkipped++;
          stats.skippedReasons['stochastic'] = (stats.skippedReasons['stochastic'] ?? 0) + 1;
          return { passed: false };
        }
      }
    }

    const globalAdxEnabled = this.config.useAdxFilter === true;
    if (globalAdxEnabled) {
      if (klines.length >= ADX_FILTER.MIN_KLINES_REQUIRED) {
        const adxResult = checkAdxCondition(klines, direction);
        if (!adxResult.isAllowed) {
          stats.tradesSkipped++;
          stats.skippedReasons['adx'] = (stats.skippedReasons['adx'] ?? 0) + 1;
          return { passed: false };
        }
      }
    }

    const globalTrendEnabled = this.config.onlyWithTrend === true;
    const strategyTrendEnabled = strategy?.filters?.trendFilter?.enabled === true;
    const shouldApplyTrend = globalTrendEnabled || strategyTrendEnabled;

    if (shouldApplyTrend) {
      if (klines.length >= TREND_FILTER.MIN_KLINES_REQUIRED) {
        const trendResult = checkTrendCondition(klines, direction);
        if (!trendResult.isAllowed) {
          stats.tradesSkipped++;
          stats.skippedReasons['trend'] = (stats.skippedReasons['trend'] ?? 0) + 1;
          return { passed: false };
        }
      }
    }

    return { passed: true };
  }

  private async processSetupEvent(event: SetupEvent): Promise<void> {
    const watcherId = `${event.watcherSymbol}-${event.watcherInterval}`;
    const watcher = this.watchers.get(watcherId);
    if (!watcher) return;

    watcher.stats.totalSetups++;

    this.timeline.push({
      timestamp: event.timestamp,
      type: 'setup',
      watcherSymbol: event.watcherSymbol,
      watcherInterval: event.watcherInterval,
      details: {
        setupType: event.setup.type,
        direction: event.setup.direction,
        entryPrice: event.setup.entryPrice,
        confidence: event.setup.confidence,
      },
    });

    this.checkAndClosePositions(event.timestamp, watcher.klines, event.klineIndex);

    const klinesUpToSetup = watcher.klines.slice(0, event.klineIndex + 1);
    const setupStrategy = watcher.strategies.find((s) => s.id === event.setup.type);

    const filterResult = this.applyIndicatorFilters(
      klinesUpToSetup,
      event.setup.direction,
      setupStrategy,
      watcher.stats
    );
    if (!filterResult.passed) return;

    const { exposurePerWatcher } = this.portfolio.calculateExposureForNewPosition();
    const { quantity, positionValue } = calculatePositionSize(
      this.portfolio.getEquity(),
      event.setup.entryPrice,
      exposurePerWatcher
    );

    const portfolioFilterResult = this.portfolio.runAllFilters(
      event.setup,
      event.watcherSymbol,
      event.watcherInterval,
      event.timestamp,
      positionValue
    );

    if (!portfolioFilterResult.passed) {
      watcher.stats.tradesSkipped++;

      const reasonKey = portfolioFilterResult.reason?.split(']')[0]?.replace('[', '') ?? 'unknown';
      watcher.stats.skippedReasons[reasonKey] = (watcher.stats.skippedReasons[reasonKey] ?? 0) + 1;

      return;
    }

    const effectiveTakeProfit = this.getEffectiveTakeProfit(event.setup);

    let atr: number | undefined;
    if (this.config.useTrailingStop && event.klineIndex > 14) {
      const klinesForAtr = watcher.klines.slice(Math.max(0, event.klineIndex - 14), event.klineIndex + 1);
      const atrValues = calculateATR(klinesForAtr, 14);
      atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : undefined;
    }

    const setupWithEffectiveTP: TradingSetup = {
      ...event.setup,
      takeProfit: effectiveTakeProfit ?? event.setup.takeProfit,
      atr,
    };

    const position = this.portfolio.openPosition(
      setupWithEffectiveTP,
      event.watcherSymbol,
      event.watcherInterval,
      quantity,
      event.timestamp
    );

    watcher.stats.tradesExecuted++;

    this.timeline.push({
      timestamp: event.timestamp,
      type: 'entry',
      watcherSymbol: event.watcherSymbol,
      watcherInterval: event.watcherInterval,
      details: {
        positionId: position.id,
        setupType: event.setup.type,
        direction: event.setup.direction,
        entryPrice: event.setup.entryPrice,
        quantity,
        positionValue,
      },
    });
  }

  private checkAndClosePositions(currentTime: number, _klines: Kline[], currentIndex: number): void {
    const openPositions = this.portfolio.getOpenPositions();
    const useTrailingStop = this.config.useTrailingStop ?? false;
    const hasSimulation = Boolean(this.config.trailingStopSimulationInterval);

    for (const position of openPositions) {
      const watcherId = `${position.watcherSymbol}-${position.watcherInterval}`;
      const watcher = this.watchers.get(watcherId);
      if (!watcher) continue;

      const positionKlines = watcher.klines;
      const entryIndex = positionKlines.findIndex((k) => k.openTime === position.entryTime);
      if (entryIndex < 0) continue;

      for (let i = entryIndex + 1; i <= Math.min(currentIndex, positionKlines.length - 1); i++) {
        const kline = positionKlines[i];
        if (!kline || kline.openTime > currentTime) break;

        this.portfolio.incrementBarsInTrade(position.id);

        if (useTrailingStop && hasSimulation && watcher.simulationKlines) {
          const exitResult = this.simulateTrailingStopWithinCandle(
            position,
            kline,
            watcher.simulationKlines
          );

          if (exitResult) {
            this.closePositionWithResult(position, exitResult, kline.closeTime);
            break;
          }
        } else {
          const high = parseFloat(String(kline.high));
          const low = parseFloat(String(kline.low));
          const close = parseFloat(String(kline.close));

          const exitResult = this.checkExit(position, kline);

          if (exitResult) {
            this.closePositionWithResult(position, exitResult, kline.closeTime);
            break;
          }

          if (useTrailingStop && position.barsInTrade > 0) {
            const trailingResult = this.computeTrailingStop(position, close, high, low);
            this.portfolio.updatePositionPriceExtremes(
              position.id,
              high,
              low,
              trailingResult?.newStopLoss
            );
          } else {
            this.portfolio.updatePositionPriceExtremes(position.id, high, low);
          }
        }
      }
    }
  }

  private binarySearchKlineIndex(klines: Kline[], targetTime: number): number {
    let left = 0;
    let right = klines.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const klineTime = klines[mid]!.openTime;

      if (klineTime < targetTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  private simulateTrailingStopWithinCandle(
    position: ReturnType<typeof this.portfolio.getOpenPositions>[0],
    mainKline: Kline,
    simulationKlines: Kline[]
  ): { exitPrice: number; reason: string; exitTime: number } | null {
    const startIndex = this.binarySearchKlineIndex(simulationKlines, mainKline.openTime);
    const endIndex = this.binarySearchKlineIndex(simulationKlines, mainKline.closeTime);

    const relevantKlines = startIndex < endIndex
      ? simulationKlines.slice(startIndex, endIndex)
      : [];

    if (relevantKlines.length === 0) {
      const high = parseFloat(String(mainKline.high));
      const low = parseFloat(String(mainKline.low));
      const close = parseFloat(String(mainKline.close));

      const exitResult = this.checkExit(position, mainKline);
      if (exitResult) {
        return { ...exitResult, exitTime: mainKline.closeTime };
      }

      if (position.barsInTrade > 0) {
        const trailingResult = this.computeTrailingStop(position, close, high, low);
        this.portfolio.updatePositionPriceExtremes(
          position.id,
          high,
          low,
          trailingResult?.newStopLoss
        );
      }

      return null;
    }

    for (const simKline of relevantKlines) {
      const high = parseFloat(String(simKline.high));
      const low = parseFloat(String(simKline.low));
      const close = parseFloat(String(simKline.close));

      const exitResult = this.checkExit(position, simKline);
      if (exitResult) {
        return { ...exitResult, exitTime: simKline.closeTime };
      }

      if (position.barsInTrade > 0) {
        const trailingResult = this.computeTrailingStop(position, close, high, low);
        this.portfolio.updatePositionPriceExtremes(
          position.id,
          high,
          low,
          trailingResult?.newStopLoss
        );
      }
    }

    return null;
  }

  private closePositionWithResult(
    position: ReturnType<typeof this.portfolio.getOpenPositions>[0],
    exitResult: { exitPrice: number; reason: string; exitTime?: number },
    fallbackExitTime: number
  ): void {
    const commission =
      position.positionValue *
      getDefaultFee(this.config.marketType ?? 'SPOT', 'TAKER') *
      2;

    const exitTime = exitResult.exitTime ?? fallbackExitTime;

    const tradeResult = this.portfolio.closePosition(
      position.id,
      exitResult.exitPrice,
      exitTime,
      exitResult.reason,
      commission
    );

    if (tradeResult) {
      this.updateWatcherStats(position.watcherSymbol, position.watcherInterval, tradeResult);

      this.timeline.push({
        timestamp: exitTime,
        type: 'exit',
        watcherSymbol: position.watcherSymbol,
        watcherInterval: position.watcherInterval,
        details: {
          positionId: position.id,
          exitPrice: exitResult.exitPrice,
          exitReason: exitResult.reason,
          pnl: tradeResult.pnl,
          netPnl: tradeResult.netPnl,
        },
      });
    }
  }

  private computeTrailingStop(
    position: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      stopLoss?: number;
      takeProfit?: number;
      atr?: number;
      highestHigh: number;
      lowestLow: number;
    },
    currentPrice: number,
    high: number,
    low: number
  ): { newStopLoss: number } | null {
    const isLong = position.side === 'LONG';

    const highestPrice = isLong ? Math.max(position.highestHigh, high) : undefined;
    const lowestPrice = !isLong ? Math.min(position.lowestLow, low) : undefined;

    const result = computeTrailingStopCore(
      {
        entryPrice: position.entryPrice,
        currentPrice,
        currentStopLoss: position.stopLoss ?? null,
        side: position.side,
        takeProfit: position.takeProfit,
        atr: position.atr,
        highestPrice,
        lowestPrice,
      },
      this.trailingStopConfig
    );

    return result;
  }

  private checkExit(
    position: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    kline: Kline,
    _useTrailingStop: boolean = false
  ): { exitPrice: number; reason: string } | null {
    const high = parseFloat(String(kline.high));
    const low = parseFloat(String(kline.low));

    if (position.stopLoss) {
      if (position.side === 'LONG' && low <= position.stopLoss) {
        return { exitPrice: position.stopLoss, reason: 'STOP_LOSS' };
      }
      if (position.side === 'SHORT' && high >= position.stopLoss) {
        return { exitPrice: position.stopLoss, reason: 'STOP_LOSS' };
      }
    }

    if (position.takeProfit) {
      if (position.side === 'LONG' && high >= position.takeProfit) {
        return { exitPrice: position.takeProfit, reason: 'TAKE_PROFIT' };
      }
      if (position.side === 'SHORT' && low <= position.takeProfit) {
        return { exitPrice: position.takeProfit, reason: 'TAKE_PROFIT' };
      }
    }

    return null;
  }

  private closeRemainingPositions(): void {
    const openPositions = this.portfolio.getOpenPositions();

    for (const position of openPositions) {
      const watcherId = `${position.watcherSymbol}-${position.watcherInterval}`;
      const watcher = this.watchers.get(watcherId);
      if (!watcher) continue;

      const lastKline = watcher.klines[watcher.klines.length - 1];
      if (!lastKline) continue;

      const exitPrice = parseFloat(String(lastKline.close));
      const commission =
        position.positionValue *
        getDefaultFee(this.config.marketType ?? 'SPOT', 'TAKER') *
        2;

      const tradeResult = this.portfolio.closePosition(
        position.id,
        exitPrice,
        lastKline.closeTime,
        'END_OF_PERIOD',
        commission
      );

      if (tradeResult) {
        this.updateWatcherStats(position.watcherSymbol, position.watcherInterval, tradeResult);

        this.timeline.push({
          timestamp: lastKline.closeTime,
          type: 'exit',
          watcherSymbol: position.watcherSymbol,
          watcherInterval: position.watcherInterval,
          details: {
            positionId: position.id,
            exitPrice,
            exitReason: 'END_OF_PERIOD',
            pnl: tradeResult.pnl,
            netPnl: tradeResult.netPnl,
          },
        });
      }
    }
  }

  private updateWatcherStats(
    symbol: string,
    interval: string,
    tradeResult: PortfolioTradeResult
  ): void {
    const watcherId = `${symbol}-${interval}`;
    const watcher = this.watchers.get(watcherId);
    if (!watcher) return;

    watcher.stats.pnl += tradeResult.netPnl;

    if (tradeResult.netPnl > 0) {
      watcher.stats.winningTrades++;
    } else {
      watcher.stats.losingTrades++;
    }

    const totalTrades = watcher.stats.winningTrades + watcher.stats.losingTrades;
    watcher.stats.winRate = totalTrades > 0 ? (watcher.stats.winningTrades / totalTrades) * 100 : 0;
  }

  private initWatcherStats(config: WatcherConfig): WatcherStats {
    return {
      symbol: config.symbol,
      interval: config.interval,
      totalSetups: 0,
      tradesExecuted: 0,
      tradesSkipped: 0,
      skippedReasons: {},
      pnl: 0,
      winRate: 0,
      winningTrades: 0,
      losingTrades: 0,
    };
  }

  private buildWatcherStats(): WatcherStats[] {
    return Array.from(this.watchers.values()).map((w) => w.stats);
  }

  private convertToBacktestTrades(): BacktestTrade[] {
    return this.portfolio.getClosedTrades().map((trade) => ({
      id: trade.position.id,
      setupId: trade.position.id,
      setupType: trade.position.setupType,
      entryTime: new Date(trade.position.entryTime).toISOString(),
      entryPrice: trade.position.entryPrice,
      exitTime: new Date(trade.exitTime).toISOString(),
      exitPrice: trade.exitPrice,
      side: trade.position.side,
      quantity: trade.position.quantity,
      stopLoss: trade.position.stopLoss,
      takeProfit: trade.position.takeProfit,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      commission: trade.commission,
      netPnl: trade.netPnl,
      exitReason: trade.exitReason as BacktestTrade['exitReason'],
      status: 'CLOSED' as const,
      marketType: this.config.marketType,
    }));
  }

  private calculateMetrics(
    trades: BacktestTrade[],
    maxDrawdown: number,
    maxDrawdownPercent: number
  ): BacktestMetrics {
    const closedTrades = trades.filter((t) => t.status === 'CLOSED');
    const totalTrades = closedTrades.length;

    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        avgPnl: 0,
        avgPnlPercent: 0,
        grossWinRate: 0,
        grossProfitFactor: 0,
        totalGrossPnl: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        profitFactor: 0,
        maxDrawdown,
        maxDrawdownPercent,
        totalCommission: 0,
        avgTradeDuration: 0,
        avgWinDuration: 0,
        avgLossDuration: 0,
      };
    }

    const winningTrades = closedTrades.filter((t) => (t.netPnl ?? 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.netPnl ?? 0) <= 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
    const totalGrossPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalCommission = closedTrades.reduce((sum, t) => sum + t.commission, 0);

    const grossWins = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0) / winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0) / losingTrades.length
        : 0;

    const largestWin = Math.max(...closedTrades.map((t) => t.netPnl ?? 0), 0);
    const largestLoss = Math.min(...closedTrades.map((t) => t.netPnl ?? 0), 0);

    const calculateDuration = (trade: BacktestTrade): number => {
      if (!trade.entryTime || !trade.exitTime) return 0;
      return (new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / 60000;
    };

    const avgTradeDuration =
      totalTrades > 0
        ? closedTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / totalTrades
        : 0;

    const avgWinDuration =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / winningTrades.length
        : 0;

    const avgLossDuration =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / losingTrades.length
        : 0;

    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / totalTrades) * 100,
      totalPnl,
      totalPnlPercent: (totalPnl / this.config.initialCapital) * 100,
      avgPnl: totalPnl / totalTrades,
      avgPnlPercent: (totalPnl / this.config.initialCapital / totalTrades) * 100,
      grossWinRate: (winningTrades.length / totalTrades) * 100,
      grossProfitFactor: profitFactor,
      totalGrossPnl,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercent,
      totalCommission,
      avgTradeDuration,
      avgWinDuration,
      avgLossDuration,
    };
  }

  private getIntervalMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
    const unitMs = UNIT_MS[match[2]];
    if (!unitMs) return 4 * TIME_MS.HOUR;
    return parseInt(match[1]) * unitMs;
  }

  private getEffectiveTakeProfit(setup: TradingSetup): number | undefined {
    let effectiveTakeProfit = setup.takeProfit;

    if (this.config.tpCalculationMode === 'fibonacci' && setup.fibonacciProjection) {
      const fibTarget = this.getFibonacciTargetPrice(setup.fibonacciProjection, setup.direction, setup.entryPrice);
      if (fibTarget !== null) {
        const isValidTarget = setup.direction === 'LONG'
          ? fibTarget > setup.entryPrice
          : fibTarget < setup.entryPrice;

        if (isValidTarget) {
          effectiveTakeProfit = fibTarget;
        }
      }
    }

    return effectiveTakeProfit;
  }

  private getFibonacciTargetPrice(
    fib: FibonacciProjectionData,
    direction: 'LONG' | 'SHORT',
    entryPrice: number
  ): number | null {
    if (!fib || !fib.levels || fib.levels.length === 0) return null;

    const targetLevel = this.config.fibonacciTpLevel ?? fib.primaryLevel;

    const targetLevelData = fib.levels.find(
      (l) => Math.abs(l.level - targetLevel) < 0.001
    );

    if (!targetLevelData) return null;

    const isValidDirection = direction === 'LONG'
      ? targetLevelData.price > entryPrice
      : targetLevelData.price < entryPrice;

    if (!isValidDirection) return null;

    return targetLevelData.price;
  }
}
