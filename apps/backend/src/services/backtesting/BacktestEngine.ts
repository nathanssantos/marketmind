import type {
  BacktestConfig,
  BacktestResult,
  ComputedIndicators,
  Interval,
  Kline,
  StrategyDefinition,
} from '@marketmind/types';
import { getDefaultFee } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BACKTEST_ENGINE, TIME_MS, UNIT_MS } from '../../constants';
import { generateEntityId } from '../../utils/id';
import { fetchHistoricalKlinesFromAPI, fetchFuturesKlinesFromAPI } from '../binance-historical';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { ConditionEvaluator, IndicatorEngine, StrategyLoader } from '../setup-detection/dynamic';
import { ExitManager } from './ExitManager';
import { FilterManager } from './FilterManager';
import { IndicatorCache } from './IndicatorCache';
import { TradeExecutor, type TradeResult } from './TradeExecutor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BacktestEngine {
  private getIntervalMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
    const unitMs = UNIT_MS[match[2]];
    if (!unitMs) return 4 * TIME_MS.HOUR;
    return parseInt(match[1]) * unitMs;
  }

  async run(config: BacktestConfig, klines?: any[]): Promise<BacktestResult> {
    const backtestId = generateEntityId();
    const startTime = Date.now();

    try {
      console.log('[Backtest] Starting backtest', backtestId, 'for', config.symbol, config.interval);
      console.log('[Backtest] Date range:', config.startDate, 'to', config.endDate);

      const historicalKlines = await this.fetchKlines(config, klines);
      const { setupDetectionService, loadedStrategies, strategyMap } = await this.initializeStrategies(config, historicalKlines);
      const effectiveConfig = this.buildEffectiveConfig(config, loadedStrategies);

      const indicatorEngine = new IndicatorEngine();
      const conditionEvaluator = new ConditionEvaluator(indicatorEngine);

      const indicatorCache = new IndicatorCache();
      if (loadedStrategies.length > 0) {
        indicatorCache.initialize(historicalKlines as Kline[]);
        indicatorCache.precomputeForStrategies(loadedStrategies, config.strategyParams || {});
      }

      const filterManager = new FilterManager({
        onlyLong: effectiveConfig.onlyLong,
        onlyWithTrend: effectiveConfig.onlyWithTrend,
        trendFilterPeriod: effectiveConfig.trendFilterPeriod,
        useStochasticFilter: effectiveConfig.useStochasticFilter,
        useAdxFilter: effectiveConfig.useAdxFilter,
        useCooldown: effectiveConfig.useCooldown,
        cooldownMinutes: effectiveConfig.cooldownMinutes,
      });

      await filterManager.initialize(
        historicalKlines as Kline[],
        config.startDate,
        config.endDate,
        config.symbol
      );

      const tradeExecutor = new TradeExecutor({
        commission: effectiveConfig.commission,
        marketType: config.marketType,
        minProfitPercent: effectiveConfig.minProfitPercent,
        minRiskRewardRatio: effectiveConfig.minRiskRewardRatio,
        stopLossPercent: effectiveConfig.stopLossPercent,
        takeProfitPercent: effectiveConfig.takeProfitPercent,
        tpCalculationMode: effectiveConfig.tpCalculationMode,
      });

      const exitManager = new ExitManager({
        useTrailingStop: effectiveConfig.useTrailingStop,
        trailingATRMultiplier: effectiveConfig.trailingATRMultiplier,
        slippagePercent: effectiveConfig.slippagePercent,
        marketType: config.marketType,
        useBnbDiscount: config.useBnbDiscount,
      }, conditionEvaluator);

      const detectedSetups = this.detectSetups(
        setupDetectionService,
        historicalKlines,
        loadedStrategies,
        effectiveConfig.trendFilterPeriod
      );

      const tradableSetups = await this.filterSetups(
        detectedSetups,
        historicalKlines,
        config,
        effectiveConfig,
        loadedStrategies
      );

      const { trades, equity, maxDrawdown, equityCurve } = this.executeBacktest(
        tradableSetups,
        historicalKlines,
        config,
        effectiveConfig,
        strategyMap,
        filterManager,
        tradeExecutor,
        exitManager,
        indicatorEngine,
        indicatorCache
      );

      const metrics = this.calculateMetrics(trades, config.initialCapital, maxDrawdown, equity);

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logResults(filterManager, trades, metrics, duration, equity);

      return {
        id: backtestId,
        config,
        trades,
        metrics,
        equityCurve,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        status: 'COMPLETED',
        setupDetections: detectedSetups,
        klines: historicalKlines,
      };
    } catch (error) {
      console.error('[Backtest] Error during backtest:', error);
      console.error('[Backtest] Stack trace:', error instanceof Error ? error.stack : 'N/A');

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      });
    }
  }

  private async fetchKlines(config: BacktestConfig, klines?: any[]): Promise<any[]> {
    if (klines && klines.length > 0) {
      console.log('[Backtest] Using pre-fetched klines:', klines.length);
      return klines;
    }

    const isFutures = config.marketType === 'FUTURES';
    console.log(`[Backtest] Fetching historical klines from Binance ${isFutures ? 'FUTURES' : 'SPOT'} API...`);

    const intervalMs = this.getIntervalMs(config.interval);
    const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
    const warmupStartDate = new Date(new Date(config.startDate).getTime() - warmupMs);

    console.log('[Backtest] Including warmup period for EMA200:', warmupStartDate.toISOString(), 'to', config.startDate);

    const fetchFn = isFutures ? fetchFuturesKlinesFromAPI : fetchHistoricalKlinesFromAPI;
    const historicalKlines = await fetchFn(
      config.symbol,
      config.interval as Interval,
      warmupStartDate,
      new Date(config.endDate)
    );

    const startTimestamp = new Date(config.startDate).getTime();
    const warmupBarsFetched = historicalKlines.filter(k => k.openTime < startTimestamp).length;

    console.log('[Backtest] Fetched', historicalKlines.length, 'klines from API (', warmupBarsFetched, 'warmup bars for EMA200)');

    if (historicalKlines.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No historical data available for the specified period',
      });
    }

    console.log('[Backtest] Sample kline:', historicalKlines[0]);
    return historicalKlines;
  }

  private async initializeStrategies(config: BacktestConfig, _historicalKlines: any[]) {
    const setupsToEnable = config.setupTypes?.length ? config.setupTypes : [];
    const strategyOverrides = config.strategyParams || {};

    console.log('[Backtest] Dynamic setups:', setupsToEnable);

    const setupDetectionService = new SetupDetectionService({});

    const loadedStrategies: StrategyDefinition[] = [];
    const strategyMap = new Map<string, StrategyDefinition>();

    if (setupsToEnable.length > 0) {
      const strategiesDir = resolve(__dirname, '../../../strategies/builtin');
      const loader = new StrategyLoader([strategiesDir]);
      const allStrategies = await loader.loadAll({ includeUnprofitable: true });

      for (const strategyDef of allStrategies) {
        if (setupsToEnable.includes(strategyDef.id)) {
          setupDetectionService.loadStrategy(strategyDef, strategyOverrides);
          loadedStrategies.push(strategyDef);
          strategyMap.set(strategyDef.id, strategyDef);
          console.log(`[Backtest] Loaded dynamic strategy: ${strategyDef.id}`);
        }
      }
    }

    return { setupDetectionService, loadedStrategies, strategyMap };
  }

  private buildEffectiveConfig(config: BacktestConfig, _loadedStrategies: StrategyDefinition[]): BacktestConfig {
    return {
      ...config,
      useAlgorithmicLevels: config.useAlgorithmicLevels ?? true,
      useTrailingStop: config.useTrailingStop ?? false,
      onlyWithTrend: config.onlyWithTrend ?? false,
      commission: config.commission ?? getDefaultFee(config.marketType ?? 'SPOT'),
    };
  }

  private detectSetups(
    setupDetectionService: SetupDetectionService,
    historicalKlines: any[],
    loadedStrategies: StrategyDefinition[],
    trendFilterPeriod?: number
  ): any[] {
    try {
      const warmupPeriod = this.calculateWarmupPeriod(loadedStrategies, trendFilterPeriod);
      const startIndex = warmupPeriod;
      const endIndex = historicalKlines.length - 1;

      console.log(`[Backtest] Scanning from index ${startIndex} to ${endIndex} (${endIndex - startIndex + 1} candles)`);

      const detectedSetups = setupDetectionService.detectSetupsInRange(
        historicalKlines,
        startIndex,
        endIndex
      );

      console.log('[Backtest] Detected', detectedSetups.length, 'setups');

      if (detectedSetups.length > 0) {
        const setupTypes = detectedSetups.reduce((acc: any, s: any) => {
          acc[s.type] = (acc[s.type] || 0) + 1;
          return acc;
        }, {});
        console.log('[Backtest] Setup breakdown:', setupTypes);
      }

      return detectedSetups;
    } catch (error) {
      console.error('[Backtest] Error detecting setups:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Setup detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      });
    }
  }

  private async filterSetups(
    detectedSetups: any[],
    _historicalKlines: any[],
    config: BacktestConfig,
    effectiveConfig: BacktestConfig,
    _loadedStrategies: StrategyDefinition[]
  ): Promise<any[]> {
    const userStartTimestamp = new Date(config.startDate).getTime();
    const setupsInRange = detectedSetups.filter((s: any) => s.openTime >= userStartTimestamp);

    if (detectedSetups.length > setupsInRange.length) {
      console.log(`[Backtest] Excluded ${detectedSetups.length - setupsInRange.length} setups before startDate (warmup period)`);
    }

    const tradableSetups = effectiveConfig.minConfidence && effectiveConfig.minConfidence > 0
      ? setupsInRange.filter((s: any) => s.confidence >= effectiveConfig.minConfidence!)
      : setupsInRange;

    console.log('[Backtest] Filtered to', tradableSetups.length, 'tradable setups by confidence', effectiveConfig.minConfidence ? `(min: ${effectiveConfig.minConfidence}%)` : '(no filter)');

    return tradableSetups;
  }

  private executeBacktest(
    tradableSetups: any[],
    historicalKlines: any[],
    config: BacktestConfig,
    effectiveConfig: BacktestConfig,
    strategyMap: Map<string, StrategyDefinition>,
    filterManager: FilterManager,
    tradeExecutor: TradeExecutor,
    exitManager: ExitManager,
    indicatorEngine: IndicatorEngine,
    indicatorCache: IndicatorCache
  ): { trades: TradeResult[]; equity: number; maxDrawdown: number; equityCurve: any[] } {
    const trades: TradeResult[] = [];
    let equity = config.initialCapital;
    let peakEquity = config.initialCapital;
    let maxDrawdown = 0;

    const equityCurve: any[] = [{
      time: config.startDate,
      equity: config.initialCapital,
      drawdown: 0,
      drawdownPercent: 0,
    }];

    const klineMap = new Map(historicalKlines.map((k) => [k.openTime, k]));
    const sortedSetups = tradableSetups.sort((a: any, b: any) => a.openTime - b.openTime);
    const openPositions: Array<{ exitTime: number; positionValue: number }> = [];

    for (const setup of sortedSetups) {
      openPositions.splice(0, openPositions.length,
        ...openPositions.filter(p => p.exitTime > setup.openTime)
      );

      if (!filterManager.checkMaxPositions(openPositions, setup.openTime)) continue;
      if (!filterManager.checkDailyLossLimit(setup.openTime)) continue;
      if (!filterManager.checkCooldown(setup.type, config.symbol, config.interval, setup.openTime)) continue;
      if (!filterManager.checkDirection(setup.direction)) continue;

      const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);

      if (!filterManager.checkStochasticFilter(historicalKlines as Kline[], setupIndex, setup.direction, trades.length)) continue;
      if (!filterManager.checkAdxFilter(historicalKlines as Kline[], setupIndex, setup.direction, trades.length)) continue;

      const entryKline = klineMap.get(setup.openTime);
      if (!entryKline) {
        console.warn('[Backtest] Entry kline not found for setup', setup.id, 'at', setup.openTime);
        filterManager.incrementKlineNotFound();
        continue;
      }

      const entryResult = tradeExecutor.resolveEntryPrice(setup, entryKline, historicalKlines as Kline[], setupIndex, trades.length);
      if (entryResult.skipped === 'limitExpired') {
        filterManager.incrementLimitExpired();
        continue;
      }

      const { entryPrice, actualEntryKlineIndex } = entryResult;

      const setupStrategy = strategyMap.get(setup.type);
      const globalTrendFilterEnabled = effectiveConfig.onlyWithTrend === true;
      const strategyTrendFilterEnabled = setupStrategy?.filters?.trendFilter?.enabled === true;
      const useTrendFilter = globalTrendFilterEnabled || strategyTrendFilterEnabled;

      if (!filterManager.checkTrendFilter(historicalKlines as Kline[], setupIndex, setup.direction, useTrendFilter, trades.length)) continue;

      const { stopLoss, takeProfit } = tradeExecutor.resolveStopLossAndTakeProfit(setup, entryPrice, trades.length);

      let { positionSize, positionValue } = tradeExecutor.calculatePositionSize(
        equity,
        entryPrice,
        stopLoss,
        trades,
        trades.length
      );

      const volatilityAdjusted = tradeExecutor.applyVolatilityAdjustment(
        positionSize,
        entryPrice,
        historicalKlines as Kline[],
        setupIndex,
        trades.length
      );
      positionSize = volatilityAdjusted.positionSize;
      positionValue = volatilityAdjusted.positionValue;

      const currentExposure = openPositions.reduce((sum, p) => sum + p.positionValue, 0);
      if (!filterManager.checkMaxExposure(currentExposure, positionValue, equity)) continue;

      if (!tradeExecutor.checkMinNotional(positionValue)) {
        filterManager.incrementMinNotional();
        continue;
      }

      if (!tradeExecutor.checkMinProfit(entryPrice, takeProfit, setup.direction, effectiveConfig.minProfitPercent, effectiveConfig.commission ?? getDefaultFee(config.marketType ?? 'SPOT'))) {
        filterManager.incrementMinProfit();
        continue;
      }

      if (!tradeExecutor.checkRiskReward(entryPrice, stopLoss, takeProfit, setup.direction, trades.length)) {
        filterManager.incrementRiskReward();
        continue;
      }

      let computedIndicators: ComputedIndicators | null = null;
      let resolvedParams: Record<string, number> = {};

      if (setupStrategy) {
        const exitConditions = setupStrategy.exit?.conditions;
        const exitConditionForDirection = setup.direction === 'LONG'
          ? exitConditions?.long
          : exitConditions?.short;

        if (exitConditionForDirection) {
          resolvedParams = Object.entries(setupStrategy.parameters).reduce(
            (acc, [key, param]) => {
              acc[key] = (config.strategyParams || {})[key] ?? param.default;
              return acc;
            },
            {} as Record<string, number>
          );

          if (setupStrategy.indicators && indicatorCache.getStats().cacheSize > 0) {
            computedIndicators = {};
            let allCached = true;

            for (const [id, definition] of Object.entries(setupStrategy.indicators)) {
              const cached = indicatorCache.getForDefinition(definition, resolvedParams, setupStrategy.parameters);
              if (cached) {
                computedIndicators[id] = cached;
              } else {
                allCached = false;
                break;
              }
            }

            if (allCached) {
              const priceData = indicatorCache.getPriceData();
              if (priceData) {
                computedIndicators['_price'] = {
                  type: 'sma',
                  values: priceData,
                };
              }
            } else {
              computedIndicators = indicatorEngine.computeIndicators(
                historicalKlines as Kline[],
                setupStrategy.indicators,
                resolvedParams
              );
            }
          } else {
            computedIndicators = indicatorEngine.computeIndicators(
              historicalKlines as Kline[],
              setupStrategy.indicators,
              resolvedParams
            );
          }
        }
      }

      const exitResult = exitManager.findExit(
        setup,
        historicalKlines as Kline[],
        actualEntryKlineIndex,
        entryPrice,
        stopLoss,
        takeProfit,
        setupStrategy,
        computedIndicators,
        resolvedParams
      );

      if (!exitResult) continue;

      const actualEntryKline = historicalKlines[actualEntryKlineIndex];
      const actualEntryTime = actualEntryKline?.openTime ?? setup.openTime;

      const trade = tradeExecutor.createTrade(
        setup,
        actualEntryTime,
        entryPrice,
        exitResult.exitTime,
        exitResult.exitPrice,
        positionSize,
        stopLoss,
        takeProfit,
        exitResult.exitReason
      );

      trades.push(trade);
      equity += trade.netPnl;

      if (equity > peakEquity) peakEquity = equity;

      const currentDrawdown = peakEquity - equity;
      const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;

      filterManager.updateCooldown(setup.type, config.symbol, config.interval, setup.openTime);
      filterManager.updateDailyPnl(trade.netPnl, config.initialCapital);

      openPositions.push({
        exitTime: new Date(exitResult.exitTime).getTime(),
        positionValue,
      });

      equityCurve.push({
        time: exitResult.exitTime,
        equity,
        drawdown: currentDrawdown,
        drawdownPercent: currentDrawdownPercent,
      });
    }

    return { trades, equity, maxDrawdown, equityCurve };
  }

  private calculateMetrics(
    trades: TradeResult[],
    initialCapital: number,
    maxDrawdown: number,
    _finalEquity: number
  ): any {
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl < 0);

    const totalPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
    const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

    const totalGrossPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const grossProfitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const calculateDuration = (trade: TradeResult) => {
      if (!trade.exitTime) return 0;
      const entry = new Date(trade.entryTime).getTime();
      const exit = new Date(trade.exitTime).getTime();
      return (exit - entry) / (1000 * 60);
    };

    const avgTradeDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + calculateDuration(t), 0) / trades.length
      : 0;

    const avgWinDuration = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / winningTrades.length
      : 0;

    const avgLossDuration = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / losingTrades.length
      : 0;

    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const peakEquity = initialCapital + Math.max(0, ...trades.map((_, i) =>
      trades.slice(0, i + 1).reduce((sum, t) => sum + t.netPnl, 0)
    ));

    const metrics = {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnl,
      totalPnlPercent: (totalPnl / initialCapital) * 100,
      avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
      avgPnlPercent: trades.length > 0
        ? trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length
        : 0,
      grossWinRate: winRate,
      grossProfitFactor,
      totalGrossPnl,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl)) : 0,
      profitFactor: grossProfitFactor,
      maxDrawdown,
      maxDrawdownPercent: (maxDrawdown / peakEquity) * 100,
      totalCommission,
      avgTradeDuration,
      avgWinDuration,
      avgLossDuration,
      sharpeRatio: 0,
    };

    if (trades.length > 1) {
      const returns = trades.map((t) => t.pnlPercent);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    }

    return metrics;
  }

  private logResults(
    filterManager: FilterManager,
    trades: TradeResult[],
    metrics: any,
    duration: number,
    equity: number
  ): void {
    const skipStats = filterManager.getSkipStats();

    console.log('[Backtest] Completed in', (duration / 1000).toFixed(2), 'seconds');
    console.log('[Backtest] Skip reasons:', {
      ...skipStats,
      total: filterManager.getTotalSkipped(),
    });
    console.log('[Backtest] Results:', {
      trades: trades.length,
      winRate: `${metrics.winRate.toFixed(2)}%`,
      totalPnl: `${metrics.totalPnl.toFixed(2)} USDT (${metrics.totalPnlPercent.toFixed(2)}%)`,
      finalEquity: `${equity.toFixed(2)} USDT`,
      maxDrawdown: `${metrics.maxDrawdown.toFixed(2)} USDT (${metrics.maxDrawdownPercent.toFixed(2)}%)`,
      profitFactor: metrics.profitFactor.toFixed(2),
    });
  }

  private calculateWarmupPeriod(strategies: StrategyDefinition[], trendFilterPeriod?: number): number {
    const MIN_WARMUP = 50;
    let maxPeriod = trendFilterPeriod ? Math.max(MIN_WARMUP, trendFilterPeriod) : MIN_WARMUP;

    for (const strategy of strategies) {
      if (strategy.indicators) {
        for (const [, indicator] of Object.entries(strategy.indicators)) {
          const params = indicator.params || {};

          const period = params['period'] || params['emaPeriod'] || params['smaPeriod'] ||
                        params['lookback'] || params['kPeriod'] || params['slowPeriod'] || 0;

          const periodValue = typeof period === 'string' && period.startsWith('$')
            ? strategy.parameters?.[period.slice(1)]?.default || 0
            : period;

          if (typeof periodValue === 'number' && periodValue > maxPeriod) {
            maxPeriod = periodValue;
          }
        }
      }

      if (strategy.parameters) {
        for (const [paramName, paramDef] of Object.entries(strategy.parameters)) {
          if (paramName.toLowerCase().includes('trend') ||
              paramName.toLowerCase().includes('ema') ||
              paramName.toLowerCase().includes('sma')) {
            const defaultValue = paramDef.default;
            if (typeof defaultValue === 'number' && defaultValue > maxPeriod) {
              maxPeriod = defaultValue;
            }
          }
        }
      }

      if (strategy.filters?.trendFilter?.period) {
        const trendPeriod = strategy.filters.trendFilter.period;
        if (typeof trendPeriod === 'number' && trendPeriod > maxPeriod) {
          maxPeriod = trendPeriod;
        }
      }

    }

    const warmupWithBuffer = Math.ceil(maxPeriod * 1.5);
    console.log(`[Backtest] Calculated warmup period: ${warmupWithBuffer} (max indicator period: ${maxPeriod})`);

    return warmupWithBuffer;
  }
}
