import type {
  BacktestEquityPoint,
  BacktestTrade,
  ConflictStats,
  FibonacciProjectionData,
  Interval,
  Kline,
  MultiWatcherBacktestConfig,
  MultiWatcherBacktestResult,
  TimelineEvent,
  TradingSetup,
  WatcherConfig,
  WatcherStats,
} from '@marketmind/types';
import { calculateTotalFees } from '@marketmind/types';
import { calculatePositionSize } from '@marketmind/risk';
import { BACKTEST_DEFAULTS } from '../../constants';
import {
  FILTER_REGISTRY,
  getHigherTimeframe,
  getOneStepAboveTimeframe,
} from '../../utils/filters';
import type { FilterResults } from '../../utils/confluence-scoring';
import { FilterManager, type FilterConfig } from './FilterManager';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BACKTEST_ENGINE } from '../../constants';
import { generateEntityId } from '../../utils/id';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { PineStrategyLoader } from '../pine/PineStrategyLoader';
import { getIntervalMs, fetchKlinesFromDbWithBackfill } from './kline-fetcher';
import { calculateBacktestMetrics } from './metrics-calculator';
import { SharedPortfolioManager, type TradeResult as PortfolioTradeResult, type PortfolioConfig } from './SharedPortfolioManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WatcherState {
  config: WatcherConfig;
  klines: Kline[];
  klineIndexMap: Map<number, number>;
  detectedSetups: TradingSetup[];
  strategies: import('../pine/types').PineStrategy[];
  stats: WatcherStats;
  filterManager: FilterManager;
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
  private btcKlinesCache: Map<string, Kline[]> = new Map();
  private htfKlinesCache: Map<string, Kline[]> = new Map();
  private stochasticHtfKlinesCache: Map<string, Kline[]> = new Map();

  constructor(private config: MultiWatcherBacktestConfig) {}

  async run(): Promise<MultiWatcherBacktestResult> {
    const backtestId = generateEntityId();
    const startTime = Date.now();

    console.log('[MultiWatcherBacktest] Starting backtest', backtestId);
    console.log('[MultiWatcherBacktest] Watchers:', this.config.watchers.length);
    console.log('[MultiWatcherBacktest] Date range:', this.config.startDate, 'to', this.config.endDate);

    const portfolioConfig: PortfolioConfig = {
      initialCapital: this.config.initialCapital,
      positionSizePercent: this.config.positionSizePercent ?? BACKTEST_DEFAULTS.POSITION_SIZE_PERCENT,
      maxPositionSizePercent: 10,
      maxConcurrentPositions: this.config.watchers.length,
      dailyLossLimitPercent: 5,
      cooldownMinutes: this.config.cooldownMinutes ?? 15,
      useStochasticFilter: this.config.useStochasticFilter ?? false,
      useStochasticRecoveryFilter: this.config.useStochasticRecoveryFilter ?? false,
      useMomentumTimingFilter: this.config.useMomentumTimingFilter ?? false,
      useAdxFilter: this.config.useAdxFilter ?? false,
      useTrendFilter: this.config.useTrendFilter ?? false,
      minRiskRewardRatio: this.config.minRiskRewardRatio ?? BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO,
      useMtfFilter: this.config.useMtfFilter ?? false,
      useBtcCorrelationFilter: this.config.useBtcCorrelationFilter ?? false,
      useMarketRegimeFilter: this.config.useMarketRegimeFilter ?? false,
      useVolumeFilter: this.config.useVolumeFilter ?? false,
      useFundingFilter: this.config.useFundingFilter ?? false,
      useConfluenceScoring: this.config.useConfluenceScoring ?? false,
      confluenceMinScore: this.config.confluenceMinScore ?? 60,
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
    const closedTrades = trades.filter((t) => t.status === 'CLOSED');
    const metricsTrades = closedTrades.map((t) => ({
      pnl: t.pnl ?? 0,
      netPnl: t.netPnl ?? 0,
      pnlPercent: t.pnlPercent ?? 0,
      commission: t.commission,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
    }));
    const metrics = calculateBacktestMetrics(metricsTrades, this.config.initialCapital, maxDrawdown, maxDrawdownPercent);

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
    const pineLoader = new PineStrategyLoader([strategiesDir]);
    const allPineStrategies = await pineLoader.loadAll();

    const intervalsNeeded = new Set(this.config.watchers.map((w) => w.interval));
    const marketType = this.config.marketType ?? 'FUTURES';

    if (this.config.useBtcCorrelationFilter) {
      console.log('[MultiWatcherBacktest] Fetching BTCUSDT klines for BTC Correlation filter...');
      for (const interval of intervalsNeeded) {
        const btcKlines = await fetchKlinesFromDbWithBackfill(
          'BTCUSDT',
          interval as Interval,
          marketType,
          new Date(this.config.startDate),
          new Date(this.config.endDate),
          this.config.exchange
        );
        this.btcKlinesCache.set(interval, btcKlines);
        console.log(`[MultiWatcherBacktest] Cached ${btcKlines.length} BTCUSDT klines for ${interval}`);
      }
    }

    if (this.config.useMtfFilter) {
      console.log('[MultiWatcherBacktest] Fetching HTF klines for MTF filter...');
      for (const interval of intervalsNeeded) {
        const htfInterval = getHigherTimeframe(interval);
        if (htfInterval && !this.htfKlinesCache.has(`${interval}-htf`)) {
          const htfKlines = await fetchKlinesFromDbWithBackfill(
            'BTCUSDT',
            htfInterval as Interval,
            marketType,
            new Date(this.config.startDate),
            new Date(this.config.endDate),
            this.config.exchange
          );
          this.htfKlinesCache.set(`${interval}-htf`, htfKlines);
          console.log(`[MultiWatcherBacktest] Cached ${htfKlines.length} HTF klines (${htfInterval}) for ${interval}`);
        }
      }
    }

    for (const watcherConfig of this.config.watchers) {
      const watcherId = `${watcherConfig.symbol}-${watcherConfig.interval}`;
      console.log(`[MultiWatcherBacktest] Initializing watcher: ${watcherId}`);

      const klines = await this.fetchKlines(watcherConfig);
      console.log(`[MultiWatcherBacktest] Fetched ${klines.length} klines for ${watcherId}`);

      if (this.config.useMtfFilter) {
        const htfInterval = getHigherTimeframe(watcherConfig.interval);
        if (htfInterval && !this.htfKlinesCache.has(`${watcherId}-htf`)) {
          const htfKlines = await fetchKlinesFromDbWithBackfill(
            watcherConfig.symbol,
            htfInterval as Interval,
            watcherConfig.marketType ?? 'FUTURES',
            new Date(this.config.startDate),
            new Date(this.config.endDate),
            this.config.exchange
          );
          this.htfKlinesCache.set(`${watcherId}-htf`, htfKlines);
          console.log(`[MultiWatcherBacktest] Cached ${htfKlines.length} HTF klines (${htfInterval}) for ${watcherId}`);
        }
      }

      if (this.config.useStochasticHtfFilter || this.config.useStochasticRecoveryHtfFilter) {
        const stochHtfInterval = getOneStepAboveTimeframe(watcherConfig.interval);
        if (stochHtfInterval && !this.stochasticHtfKlinesCache.has(`${watcherId}-stoch-htf`)) {
          const stochHtfKlines = await fetchKlinesFromDbWithBackfill(
            watcherConfig.symbol,
            stochHtfInterval,
            watcherConfig.marketType ?? 'FUTURES',
            new Date(this.config.startDate),
            new Date(this.config.endDate),
            this.config.exchange
          );
          this.stochasticHtfKlinesCache.set(`${watcherId}-stoch-htf`, stochHtfKlines);
          console.log(`[MultiWatcherBacktest] Cached ${stochHtfKlines.length} stochastic HTF klines (${stochHtfInterval}) for ${watcherId}`);
        }
      }

      const setupTypes = watcherConfig.setupTypes ?? this.config.setupTypes ?? [];
      const watcherPineStrategies = allPineStrategies.filter((s) => setupTypes.includes(s.metadata.id));

      const setups = await this.detectSetups(watcherConfig, klines, watcherPineStrategies);
      console.log(`[MultiWatcherBacktest] Detected ${setups.length} setups for ${watcherId}`);

      const klineIndexMap = new Map(klines.map((k, i) => [k.openTime, i]));

      this.watchers.set(watcherId, {
        config: watcherConfig,
        klines,
        klineIndexMap,
        detectedSetups: setups,
        strategies: watcherPineStrategies,
        stats: this.initWatcherStats(watcherConfig),
        filterManager: new FilterManager(this.config as unknown as FilterConfig),
      });
    }
  }

  private async fetchKlines(watcherConfig: WatcherConfig): Promise<Kline[]> {
    const marketType = watcherConfig.marketType ?? 'FUTURES';
    const intervalMs = getIntervalMs(watcherConfig.interval);
    const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
    const startTime = new Date(new Date(this.config.startDate).getTime() - warmupMs);
    const endTime = new Date(this.config.endDate);

    return fetchKlinesFromDbWithBackfill(
      watcherConfig.symbol,
      watcherConfig.interval as Interval,
      marketType,
      startTime,
      endTime,
      this.config.exchange
    );
  }

  private async detectSetups(
    _watcherConfig: WatcherConfig,
    klines: Kline[],
    pineStrategies: import('../pine/types').PineStrategy[]
  ): Promise<TradingSetup[]> {
    if (pineStrategies.length === 0) return [];

    const setupDetectionService = new SetupDetectionService({
      silent: this.config.silent,
      maxFibonacciEntryProgressPercentLong: this.config.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: this.config.maxFibonacciEntryProgressPercentShort,
      fibonacciSwingRange: this.config.fibonacciSwingRange,
    });

    for (const strategy of pineStrategies) {
      setupDetectionService.loadPineStrategy(strategy);
    }

    const warmupPeriod = BACKTEST_ENGINE.EMA200_WARMUP_BARS;
    const userStartTimestamp = new Date(this.config.startDate).getTime();

    const detectedSetups = await setupDetectionService.detectSetupsInRange(
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
        const klineIndex = watcher.klineIndexMap.get(setup.openTime) ?? -1;

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

  private async applyIndicatorFilters(
    klines: Kline[],
    direction: 'LONG' | 'SHORT',
    _strategy: unknown,
    filterManager: FilterManager,
    tradesCount: number,
    context?: {
      symbol: string;
      interval: string;
      setupType: string;
      setupTimestamp: number;
      btcKlines?: Kline[];
      htfKlines?: Kline[];
      htfInterval?: string | null;
      stochasticHtfKlines?: Kline[];
    }
  ): Promise<{ passed: boolean }> {
    const filterResults: FilterResults = {};
    const setupIndex = klines.length - 1;
    const setupType = context?.setupType ?? '';

    const btcResult = await filterManager.checkBtcCorrelationFilter(context?.btcKlines ?? [], direction, context?.symbol ?? '', tradesCount);
    if (!btcResult.passed) return { passed: false };
    if (btcResult.result) filterResults.btcCorrelation = btcResult.result;

    const mtfResult = await filterManager.checkMtfFilter(context?.htfKlines ?? [], direction, context?.htfInterval ?? null, tradesCount);
    if (!mtfResult.passed) return { passed: false };
    if (mtfResult.result) filterResults.mtf = mtfResult.result;

    const regimeResult = await filterManager.checkMarketRegimeFilter(klines, setupIndex, setupType, tradesCount);
    if (!regimeResult.passed) return { passed: false };
    if (regimeResult.result) {
      filterResults.marketRegime = regimeResult.result;
      filterResults.adxValue = regimeResult.result.adx ?? undefined;
    }

    const volumeResult = await filterManager.checkVolumeFilter(klines, setupIndex, direction, setupType, tradesCount);
    if (!volumeResult.passed) return { passed: false };
    if (volumeResult.result) filterResults.volume = volumeResult.result;

    if (!(await filterManager.runValidatorFilters(klines, setupIndex, direction, setupType))) return { passed: false };

    if (!(await filterManager.checkStochasticHtfFilter(context?.stochasticHtfKlines ?? [], context?.setupTimestamp ?? 0, direction, tradesCount))) return { passed: false };
    if (!(await filterManager.checkStochasticRecoveryHtfFilter(context?.stochasticHtfKlines ?? [], context?.setupTimestamp ?? 0, direction, tradesCount))) return { passed: false };

    const shouldApplyTrend = this.config.useTrendFilter === true;
    if (!(await filterManager.checkTrendFilter(klines, setupIndex, direction, shouldApplyTrend, tradesCount))) return { passed: false };
    if (shouldApplyTrend) filterResults.trendAllowed = true;

    if (!filterManager.checkConfluenceScoring(filterResults, tradesCount)) return { passed: false };

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
    const setupStrategy = watcher.strategies.find((s) => s.metadata.id === event.setup.type);

    const btcKlines = this.btcKlinesCache.get(event.watcherInterval);
    const htfKlinesKey = `${watcherId}-htf`;
    const htfKlines = this.htfKlinesCache.get(htfKlinesKey);
    const htfInterval = getHigherTimeframe(event.watcherInterval);
    const stochasticHtfKlines = this.stochasticHtfKlinesCache.get(`${watcherId}-stoch-htf`);

    const filterResult = this.applyIndicatorFilters(
      klinesUpToSetup,
      event.setup.direction,
      setupStrategy,
      watcher.filterManager,
      watcher.stats.tradesExecuted,
      {
        symbol: event.watcherSymbol,
        interval: event.watcherInterval,
        setupType: event.setup.type,
        setupTimestamp: event.timestamp,
        btcKlines: btcKlines?.slice(0, event.klineIndex + 1),
        htfKlines,
        htfInterval,
        stochasticHtfKlines,
      }
    );
    if (!filterResult.passed) {
      watcher.stats.tradesSkipped++;
      return;
    }

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

    const effectiveTakeProfitResult = this.getEffectiveTakeProfit(event.setup);

    if (effectiveTakeProfitResult.rejected) {
      watcher.stats.tradesSkipped++;
      const reasonKey = effectiveTakeProfitResult.reason ?? 'fibonacci-unavailable';
      watcher.stats.skippedReasons[reasonKey] = (watcher.stats.skippedReasons[reasonKey] ?? 0) + 1;
      return;
    }

    const effectiveTakeProfit = effectiveTakeProfitResult.takeProfit;

    const setupWithEffectiveTP: TradingSetup = {
      ...event.setup,
      takeProfit: effectiveTakeProfit ?? event.setup.takeProfit,
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

    for (const position of openPositions) {
      const watcherId = `${position.watcherSymbol}-${position.watcherInterval}`;
      const watcher = this.watchers.get(watcherId);
      if (!watcher) continue;

      const positionKlines = watcher.klines;
      const entryIndex = watcher.klineIndexMap.get(position.entryTime) ?? -1;
      if (entryIndex < 0) continue;

      for (let i = entryIndex + 1; i <= Math.min(currentIndex, positionKlines.length - 1); i++) {
        const kline = positionKlines[i];
        if (!kline || kline.openTime > currentTime) break;

        this.portfolio.incrementBarsInTrade(position.id);

        const high = parseFloat(String(kline.high));
        const low = parseFloat(String(kline.low));

        const exitResult = this.checkExit(position, kline);

        if (exitResult) {
          this.closePositionWithResult(position, exitResult, kline.closeTime);
          break;
        }

        this.portfolio.updatePositionPriceExtremes(position.id, high, low);
      }
    }
  }

  private closePositionWithResult(
    position: ReturnType<typeof this.portfolio.getOpenPositions>[0],
    exitResult: { exitPrice: number; reason: string; exitTime?: number },
    fallbackExitTime: number
  ): void {
    const exitValue = exitResult.exitPrice * position.quantity;
    const { totalFees: commission } = calculateTotalFees(
      position.positionValue,
      exitValue,
      { marketType: this.config.marketType ?? 'FUTURES', useBnbDiscount: this.config.useBnbDiscount, vipLevel: this.config.vipLevel ?? 0 }
    );

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

  private checkExit(
    position: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    kline: Kline
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
      const exitValue = exitPrice * position.quantity;
      const { totalFees: commission } = calculateTotalFees(
        position.positionValue,
        exitValue,
        { marketType: this.config.marketType ?? 'FUTURES', useBnbDiscount: this.config.useBnbDiscount, vipLevel: this.config.vipLevel ?? 0 }
      );

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
    return Array.from(this.watchers.values()).map((w) => {
      const filterStats = w.filterManager.getSkipStats();
      for (const filter of FILTER_REGISTRY) {
        const value = (filterStats as unknown as Record<string, number>)[filter.statsKey] ?? 0;
        if (value > 0) w.stats.skippedReasons[filter.id] = (w.stats.skippedReasons[filter.id] ?? 0) + value;
      }
      return w.stats;
    });
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

  private getEffectiveTakeProfit(setup: TradingSetup): { takeProfit: number | undefined; rejected: boolean; reason?: string } {
    if (this.config.tpCalculationMode === 'fibonacci') {
      if (!setup.fibonacciProjection) {
        return {
          takeProfit: undefined,
          rejected: true,
          reason: 'no-trend-structure',
        };
      }

      const fibTarget = this.getFibonacciTargetPrice(setup.fibonacciProjection, setup.direction, setup.entryPrice);

      if (fibTarget === null) {
        return {
          takeProfit: undefined,
          rejected: true,
          reason: 'fibonacci-invalid',
        };
      }

      const isValidTarget = setup.direction === 'LONG'
        ? fibTarget > setup.entryPrice
        : fibTarget < setup.entryPrice;

      if (!isValidTarget) {
        return {
          takeProfit: undefined,
          rejected: true,
          reason: 'fibonacci-wrong-direction',
        };
      }

      return {
        takeProfit: fibTarget,
        rejected: false,
      };
    }

    return {
      takeProfit: setup.takeProfit,
      rejected: false,
    };
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
