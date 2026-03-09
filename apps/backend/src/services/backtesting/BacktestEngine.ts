import type {
  BacktestConfig,
  BacktestResult,
  ComputedIndicators,
  Interval,
  Kline,
  StrategyDefinition,
} from '@marketmind/types';
import { getDefaultFee, FILTER_DEFAULTS } from '@marketmind/types';
import { calculateEMA } from '@marketmind/indicators';
import { TRPCError } from '@trpc/server';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BACKTEST_DEFAULTS, BACKTEST_ENGINE } from '../../constants';
import { generateEntityId } from '../../utils/id';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { ConditionEvaluator, IndicatorEngine, StrategyLoader } from '../setup-detection/dynamic';
import { getHigherTimeframe, getOneStepAboveTimeframe } from '../../utils/filters';
import { applyFilterDefaults } from '../../utils/filters/filter-registry';
import { ExitManager } from './ExitManager';
import { FilterManager, type FilterConfig } from './FilterManager';
import { IndicatorCache } from './IndicatorCache';
import { getIntervalMs, fetchKlinesFromDbWithBackfill } from './kline-fetcher';
import { calculateBacktestMetrics } from './metrics-calculator';
import { TradeExecutor, type TradeResult } from './TradeExecutor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BacktestEngine {
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

      const resolvedDirectionMode = effectiveConfig.directionMode
        ?? (effectiveConfig.onlyLong ? 'long_only' as const : undefined);

      const filterManager = new FilterManager({
        ...effectiveConfig,
        directionMode: resolvedDirectionMode,
      } as FilterConfig);

      await filterManager.initialize(
        historicalKlines as Kline[],
        config.startDate,
        config.endDate,
        config.symbol
      );

      let stochasticHtfKlines: Kline[] = [];
      if (effectiveConfig.useStochasticHtfFilter || effectiveConfig.useStochasticRecoveryHtfFilter) {
        const htfInterval = getOneStepAboveTimeframe(config.interval);
        if (htfInterval) {
          const marketType = config.marketType ?? 'FUTURES';
          const intervalMs = getIntervalMs(config.interval);
          const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
          const startTime = new Date(new Date(config.startDate).getTime() - warmupMs);
          const endTime = new Date(config.endDate);
          stochasticHtfKlines = await fetchKlinesFromDbWithBackfill(
            config.symbol,
            htfInterval,
            marketType,
            startTime,
            endTime,
            config.exchange
          );
          console.log(`[Backtest] Fetched ${stochasticHtfKlines.length} HTF stochastic klines (${htfInterval}) for ${config.symbol}`);
        }
      }

      let mtfHtfKlines: Kline[] = [];
      let mtfHtfInterval: string | null = null;
      if (effectiveConfig.useMtfFilter) {
        mtfHtfInterval = getHigherTimeframe(config.interval);
        if (mtfHtfInterval) {
          const marketType = config.marketType ?? 'FUTURES';
          const intervalMs = getIntervalMs(config.interval);
          const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
          const startTime = new Date(new Date(config.startDate).getTime() - warmupMs);
          const endTime = new Date(config.endDate);
          mtfHtfKlines = await fetchKlinesFromDbWithBackfill(
            config.symbol,
            mtfHtfInterval as Interval,
            marketType,
            startTime,
            endTime,
            config.exchange
          );
          console.log(`[Backtest] Fetched ${mtfHtfKlines.length} MTF HTF klines (${mtfHtfInterval}) for ${config.symbol}`);
        }
      }

      const tradeExecutor = new TradeExecutor({
        commission: effectiveConfig.commission,
        marketType: config.marketType,
        minProfitPercent: effectiveConfig.minProfitPercent,
        minRiskRewardRatio: effectiveConfig.minRiskRewardRatio,
        minRiskRewardRatioLong: effectiveConfig.minRiskRewardRatioLong,
        minRiskRewardRatioShort: effectiveConfig.minRiskRewardRatioShort,
        stopLossPercent: effectiveConfig.stopLossPercent,
        takeProfitPercent: effectiveConfig.takeProfitPercent,
        tpCalculationMode: effectiveConfig.tpCalculationMode,
        fibonacciTargetLevel: effectiveConfig.fibonacciTargetLevel,
        fibonacciTargetLevelLong: effectiveConfig.fibonacciTargetLevelLong,
        fibonacciTargetLevelShort: effectiveConfig.fibonacciTargetLevelShort,
      });

      const exitManager = new ExitManager({
        slippagePercent: effectiveConfig.slippagePercent,
        marketType: config.marketType,
        useBnbDiscount: config.useBnbDiscount,
      }, conditionEvaluator);

      const detectedSetups = await this.detectSetups(
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
        indicatorCache,
        stochasticHtfKlines,
        mtfHtfKlines,
        mtfHtfInterval
      );

      const metrics = calculateBacktestMetrics(trades, config.initialCapital, maxDrawdown);

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

    const marketType = config.marketType ?? 'FUTURES';
    const intervalMs = getIntervalMs(config.interval);
    const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
    const startTime = new Date(new Date(config.startDate).getTime() - warmupMs);
    const endTime = new Date(config.endDate);

    console.log('[Backtest] Including warmup period for EMA200:', startTime.toISOString(), 'to', config.startDate);

    const historicalKlines = await fetchKlinesFromDbWithBackfill(
      config.symbol,
      config.interval as Interval,
      marketType,
      startTime,
      endTime,
      config.exchange
    );

    const startTimestamp = new Date(config.startDate).getTime();
    const warmupBarsFetched = historicalKlines.filter(k => k.openTime < startTimestamp).length;

    console.log('[Backtest] Fetched', historicalKlines.length, 'klines (', warmupBarsFetched, 'warmup bars for EMA200)');

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
    if (config.maxFibonacciEntryProgressPercentLong !== undefined || config.maxFibonacciEntryProgressPercentShort !== undefined) {
      console.log(`[Backtest] Max Fibonacci entry progress: LONG=${config.maxFibonacciEntryProgressPercentLong}% SHORT=${config.maxFibonacciEntryProgressPercentShort}%`);
    }

    const setupDetectionService = new SetupDetectionService({
      maxFibonacciEntryProgressPercentLong: config.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: config.maxFibonacciEntryProgressPercentShort,
      fibonacciSwingRange: config.fibonacciSwingRange,
      initialStopMode: config.initialStopMode,
    });

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
    const isFutures = config.marketType === 'FUTURES';
    return {
      ...applyFilterDefaults(
        config as unknown as Record<string, unknown>,
        FILTER_DEFAULTS as unknown as Record<string, unknown>,
      ) as unknown as BacktestConfig,
      useAlgorithmicLevels: config.useAlgorithmicLevels ?? true,
      commission: config.commission ?? getDefaultFee(config.marketType ?? 'FUTURES'),
      useFundingFilter: config.useFundingFilter ?? (isFutures && FILTER_DEFAULTS.useFundingFilter),
      minRiskRewardRatio: config.minRiskRewardRatio ?? BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO,
      minRiskRewardRatioLong: config.minRiskRewardRatioLong ?? FILTER_DEFAULTS.minRiskRewardRatioLong,
      minRiskRewardRatioShort: config.minRiskRewardRatioShort ?? FILTER_DEFAULTS.minRiskRewardRatioShort,
      positionSizePercent: config.positionSizePercent ?? FILTER_DEFAULTS.positionSizePercent,
      useCooldown: config.useCooldown ?? FILTER_DEFAULTS.useCooldown,
      cooldownMinutes: config.cooldownMinutes ?? FILTER_DEFAULTS.cooldownMinutes,
      leverage: config.leverage ?? 1,
      tpCalculationMode: config.tpCalculationMode ?? 'default',
      fibonacciTargetLevel: config.fibonacciTargetLevel ?? 'auto',
    };
  }

  private async detectSetups(
    setupDetectionService: SetupDetectionService,
    historicalKlines: any[],
    loadedStrategies: StrategyDefinition[],
    trendFilterPeriod?: number
  ): Promise<any[]> {
    try {
      const warmupPeriod = this.calculateWarmupPeriod(loadedStrategies, trendFilterPeriod);
      const startIndex = warmupPeriod;
      const endIndex = historicalKlines.length - 1;

      console.log(`[Backtest] Scanning from index ${startIndex} to ${endIndex} (${endIndex - startIndex + 1} candles)`);

      const detectedSetups = await setupDetectionService.detectSetupsInRange(
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
    indicatorCache: IndicatorCache,
    stochasticHtfKlines: Kline[] = [],
    mtfHtfKlines: Kline[] = [],
    mtfHtfInterval: string | null = null
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
    const klineIndexMap = new Map(historicalKlines.map((k: any, i: number) => [k.openTime, i]));
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

      const setupIndex = klineIndexMap.get(setup.openTime) ?? -1;

      if (!filterManager.runRegisteredFilters(historicalKlines as Kline[], setupIndex, setup.direction, setup.type)) continue;
      if (!filterManager.checkStochasticHtfFilter(stochasticHtfKlines, setup.openTime, setup.direction, trades.length)) continue;
      if (!filterManager.checkStochasticRecoveryHtfFilter(stochasticHtfKlines, setup.openTime, setup.direction, trades.length)) continue;
      if (!filterManager.checkMtfFilter(mtfHtfKlines, setup.direction, mtfHtfInterval, trades.length).passed) continue;

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
      const globalTrendFilterEnabled = effectiveConfig.useTrendFilter === true;
      const strategyTrendFilterEnabled = setupStrategy?.filters?.trendFilter?.enabled === true;
      const shouldUseTrendFilter = globalTrendFilterEnabled || strategyTrendFilterEnabled;

      if (!filterManager.checkTrendFilter(historicalKlines as Kline[], setupIndex, setup.direction, shouldUseTrendFilter, trades.length)) continue;
      if (!filterManager.checkFvgFilter(historicalKlines as Kline[], setupIndex, entryPrice, setup.direction, trades.length)) continue;

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

      if (!tradeExecutor.checkMinProfit(entryPrice, takeProfit, setup.direction, effectiveConfig.minProfitPercent, effectiveConfig.commission ?? getDefaultFee(config.marketType ?? 'FUTURES'))) {
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

  async runBatch(
    configs: BacktestConfig[],
    klines: Kline[]
  ): Promise<Array<{ config: BacktestConfig; result: BacktestResult }>> {
    if (configs.length === 0) return [];

    const baseConfig = configs[0]!;
    const historicalKlines = klines as any[];

    const { setupDetectionService, loadedStrategies, strategyMap } = await this.initializeStrategies(baseConfig, historicalKlines);
    const baseEffective = this.buildEffectiveConfig(baseConfig, loadedStrategies);

    const indicatorEngine = new IndicatorEngine();
    const conditionEvaluator = new ConditionEvaluator(indicatorEngine);

    const indicatorCache = new IndicatorCache();
    if (loadedStrategies.length > 0) {
      indicatorCache.initialize(klines);
      indicatorCache.precomputeForStrategies(loadedStrategies, baseConfig.strategyParams || {});
    }

    const detectedSetups = await this.detectSetups(
      setupDetectionService,
      historicalKlines,
      loadedStrategies,
      baseEffective.trendFilterPeriod
    );

    const baseFilteredSetups = await this.filterSetups(
      detectedSetups,
      historicalKlines,
      baseConfig,
      baseEffective,
      loadedStrategies
    );

    const emaTrendPeriod = baseEffective.trendFilterPeriod ?? 21;
    const emaTrend = calculateEMA(klines, emaTrendPeriod).map(v => v ?? 0);

    const anyHtfStochastic = configs.some(c => c.useStochasticHtfFilter || c.useStochasticRecoveryHtfFilter);
    let batchStochasticHtfKlines: Kline[] = [];
    if (anyHtfStochastic) {
      const htfInterval = getOneStepAboveTimeframe(baseConfig.interval);
      if (htfInterval) {
        const marketType = baseConfig.marketType ?? 'FUTURES';
        const intervalMs = getIntervalMs(baseConfig.interval);
        const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
        const startTime = new Date(new Date(baseConfig.startDate).getTime() - warmupMs);
        const endTime = new Date(baseConfig.endDate);
        batchStochasticHtfKlines = await fetchKlinesFromDbWithBackfill(
          baseConfig.symbol,
          htfInterval,
          marketType,
          startTime,
          endTime,
          baseConfig.exchange
        );
      }
    }

    const anyMtf = configs.some(c => c.useMtfFilter);
    let batchMtfHtfKlines: Kline[] = [];
    let batchMtfHtfInterval: string | null = null;
    if (anyMtf) {
      batchMtfHtfInterval = getHigherTimeframe(baseConfig.interval);
      if (batchMtfHtfInterval) {
        const marketType = baseConfig.marketType ?? 'FUTURES';
        const intervalMs = getIntervalMs(baseConfig.interval);
        const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
        const startTime = new Date(new Date(baseConfig.startDate).getTime() - warmupMs);
        const endTime = new Date(baseConfig.endDate);
        batchMtfHtfKlines = await fetchKlinesFromDbWithBackfill(
          baseConfig.symbol,
          batchMtfHtfInterval as Interval,
          marketType,
          startTime,
          endTime,
          baseConfig.exchange
        );
      }
    }

    const results: Array<{ config: BacktestConfig; result: BacktestResult }> = [];

    for (const config of configs) {
      const backtestId = generateEntityId();
      const startTime = Date.now();

      try {
        const effectiveConfig = this.buildEffectiveConfig(config, loadedStrategies);

        const batchDirectionMode = effectiveConfig.directionMode
          ?? (effectiveConfig.onlyLong ? 'long_only' as const : undefined);

        const filterManager = new FilterManager({
          ...effectiveConfig,
          directionMode: batchDirectionMode,
        } as FilterConfig);
        filterManager.setEmaTrend(emaTrend);

        const tradeExecutor = new TradeExecutor({
          commission: effectiveConfig.commission,
          marketType: config.marketType,
          minProfitPercent: effectiveConfig.minProfitPercent,
          minRiskRewardRatio: effectiveConfig.minRiskRewardRatio,
          minRiskRewardRatioLong: effectiveConfig.minRiskRewardRatioLong,
          minRiskRewardRatioShort: effectiveConfig.minRiskRewardRatioShort,
          stopLossPercent: effectiveConfig.stopLossPercent,
          takeProfitPercent: effectiveConfig.takeProfitPercent,
          tpCalculationMode: effectiveConfig.tpCalculationMode,
          fibonacciTargetLevel: effectiveConfig.fibonacciTargetLevel,
          fibonacciTargetLevelLong: effectiveConfig.fibonacciTargetLevelLong,
          fibonacciTargetLevelShort: effectiveConfig.fibonacciTargetLevelShort,
        });

        const exitManager = new ExitManager({
          slippagePercent: effectiveConfig.slippagePercent,
          marketType: config.marketType,
          useBnbDiscount: config.useBnbDiscount,
        }, conditionEvaluator);

        const { trades, maxDrawdown, equityCurve } = this.executeBacktest(
          baseFilteredSetups,
          historicalKlines,
          config,
          effectiveConfig,
          strategyMap,
          filterManager,
          tradeExecutor,
          exitManager,
          indicatorEngine,
          indicatorCache,
          batchStochasticHtfKlines,
          batchMtfHtfKlines,
          batchMtfHtfInterval
        );

        const metrics = calculateBacktestMetrics(trades, config.initialCapital, maxDrawdown);
        const endTime = Date.now();

        results.push({
          config,
          result: {
            id: backtestId,
            config,
            trades,
            metrics,
            equityCurve,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            duration: endTime - startTime,
            status: 'COMPLETED',
            setupDetections: detectedSetups,
            klines: historicalKlines,
          },
        });
      } catch (_error) {
        continue;
      }
    }

    return results;
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
