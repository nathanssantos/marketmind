import { calculateADX, calculateATR, calculateStochastic } from '@marketmind/indicators';
import { getThresholdForTimeframe } from '@marketmind/ml';
import type { BacktestConfig, BacktestResult, ComputedIndicators, EvaluationContext, Interval, Kline, OptimizedBacktestParams, StrategyDefinition } from '@marketmind/types';
import { HistoricalMarketContextService } from '../historical-market-context';
import { TRPCError } from '@trpc/server';
import { ADX_FILTER } from '../../constants';
import { randomBytes } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../env';
import { calculateRequiredKlinesForML, DEFAULT_KLINES_FOR_ML } from '../../utils/kline-calculator';
import { fetchHistoricalKlinesFromAPI } from '../binance-historical';
import { mlService } from '../ml';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { ConditionEvaluator, IndicatorEngine, StrategyLoader } from '../setup-detection/dynamic';
import { PositionSizer } from './PositionSizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

interface TradeStats {
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
}

const calculateRollingStats = (trades: any[], lookback: number = 30): TradeStats | null => {
  if (trades.length === 0) return null;
  
  const recentTrades = trades.slice(-lookback);
  const winners = recentTrades.filter(t => t.pnlPercent > 0);
  const losers = recentTrades.filter(t => t.pnlPercent < 0);
  
  if (winners.length === 0 || losers.length === 0) return null;
  
  const winRate = winners.length / recentTrades.length;
  const avgWinPercent = winners.reduce((sum, t) => sum + t.pnlPercent, 0) / winners.length;
  const avgLossPercent = Math.abs(losers.reduce((sum, t) => sum + t.pnlPercent, 0) / losers.length);
  
  return { winRate, avgWinPercent, avgLossPercent };
};

export class BacktestEngine {
  private getIntervalMs(interval: string): number {
    const units: Record<string, number> = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
    };
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * 60 * 60 * 1000;
    const unitMs = units[match[2]];
    if (!unitMs) return 4 * 60 * 60 * 1000;
    return parseInt(match[1]) * unitMs;
  }

  /**
   * Merge optimizedParams from multiple strategies.
   * When multiple strategies are tested together:
   * - Uses the most conservative (lowest) maxPositionSize
   * - onlyWithTrend is DISABLED here (applied per-strategy instead)
   * - useAlgorithmicLevels is true if ANY strategy uses it
   * - useTrailingStop is true if ANY strategy uses it
   * - minConfidence is the highest of all strategies
   * - commission uses the highest value
   * - trailingATRMultiplier uses the average
   * - breakEvenAfterR uses the lowest (most conservative)
   */
  private mergeOptimizedParams(strategies: StrategyDefinition[]): OptimizedBacktestParams | null {
    const strategiesWithParams = strategies.filter(s => s.optimizedParams);
    if (strategiesWithParams.length === 0) return null;

    const allParams = strategiesWithParams.map(s => s.optimizedParams!);

    const trailingMultipliers = allParams.filter(p => p.trailingATRMultiplier).map(p => p.trailingATRMultiplier!);
    const breakEvenValues = allParams.filter(p => p.breakEvenAfterR).map(p => p.breakEvenAfterR!);
    const maxConcurrentValues = allParams.filter(p => p.maxConcurrentPositions).map(p => p.maxConcurrentPositions!);
    const maxExposureValues = allParams.filter(p => p.maxTotalExposure).map(p => p.maxTotalExposure!);

    return {
      maxPositionSize: Math.min(...allParams.map(p => p.maxPositionSize)),
      maxConcurrentPositions: maxConcurrentValues.length > 0 ? Math.min(...maxConcurrentValues) : undefined,
      maxTotalExposure: maxExposureValues.length > 0 ? Math.min(...maxExposureValues) : undefined,
      useAlgorithmicLevels: allParams.some(p => p.useAlgorithmicLevels),
      useTrailingStop: allParams.some(p => p.useTrailingStop),
      trailingATRMultiplier: trailingMultipliers.length > 0
        ? trailingMultipliers.reduce((a, b) => a + b, 0) / trailingMultipliers.length
        : undefined,
      breakEvenAfterR: breakEvenValues.length > 0 ? Math.min(...breakEvenValues) : undefined,
      onlyWithTrend: false, // FIXED: Don't apply globally, check per-strategy instead
      minConfidence: Math.max(...allParams.map(p => p.minConfidence ?? 0)) || undefined,
      commission: Math.max(...allParams.map(p => p.commission ?? 0.001)),
      stopLossPercent: allParams[0]?.stopLossPercent,
      takeProfitPercent: allParams[0]?.takeProfitPercent,
    };
  }

  /**
   * Run a backtest with the given configuration
   * @param config Backtest configuration
   * @param klines Optional pre-fetched klines (for optimization - reuse data)
   * @returns Backtest result with trades, metrics, and equity curve
   */
  async run(config: BacktestConfig, klines?: any[]): Promise<BacktestResult> {
    const backtestId = generateId(21);
    const startTime = Date.now();

    try {
      console.log('[Backtest] Starting backtest', backtestId, 'for', config.symbol, config.interval);
      console.log('[Backtest] Date range:', config.startDate, 'to', config.endDate);

      const EMA200_WARMUP_BARS = 250; // Extra bars needed for EMA200 warmup
      let historicalKlines: any[];
      let warmupBarsFetched = 0;

      if (klines && klines.length > 0) {
        console.log('[Backtest] Using pre-fetched klines:', klines.length);
        historicalKlines = klines;
      } else {
        console.log('[Backtest] Fetching historical klines from Binance API...');

        const intervalMs = this.getIntervalMs(config.interval);
        const warmupMs = EMA200_WARMUP_BARS * intervalMs;
        const warmupStartDate = new Date(new Date(config.startDate).getTime() - warmupMs);

        console.log('[Backtest] Including warmup period for EMA200:', warmupStartDate.toISOString(), 'to', config.startDate);

        historicalKlines = await fetchHistoricalKlinesFromAPI(
          config.symbol,
          config.interval as Interval,
          warmupStartDate,
          new Date(config.endDate)
        );

        const startTimestamp = new Date(config.startDate).getTime();
        warmupBarsFetched = historicalKlines.filter(k => k.openTime < startTimestamp).length;

        console.log('[Backtest] Fetched', historicalKlines.length, 'klines from API (', warmupBarsFetched, 'warmup bars for EMA200)');
      }

      if (historicalKlines.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No historical data available for the specified period',
        });
      }

      console.log('[Backtest] Sample kline:', historicalKlines[0]);

      const setupsToEnable = config.setupTypes?.length ? config.setupTypes : [
        'pattern123', 'bearTrap', 'meanReversion'
      ];

      const legacyStrategies = ['pattern123', 'bearTrap', 'meanReversion'];
      const requestedLegacy = setupsToEnable.filter(s => legacyStrategies.includes(s));
      const requestedDynamic = setupsToEnable.filter(s => !legacyStrategies.includes(s));

      const { createDefault123Config } = await import('../setup-detection/Pattern123Detector');
      const { createDefaultBearTrapConfig } = await import('../setup-detection/BearTrapDetector');
      const { createDefaultMeanReversionConfig } = await import('../setup-detection/MeanReversionDetector');

      const strategyOverrides = config.strategyParams || {};

      const applyOverrides = (strategyKey: string, defaultConfig: any) => {
        const isEnabledStrategy = setupsToEnable.includes(strategyKey);
        const shouldApplyOverrides = isEnabledStrategy && Object.keys(strategyOverrides).length > 0;
        return shouldApplyOverrides ? { ...defaultConfig, ...strategyOverrides } : defaultConfig;
      };

      const buildSetupConfig = (key: string, createDefault: () => any) => {
        const defaults = createDefault();
        const overrides = applyOverrides(key, defaults);
        return {
          ...overrides,
          enabled: requestedLegacy.includes(key),
          minConfidence: config.minConfidence && config.minConfidence > 0
            ? Math.max(config.minConfidence, defaults.minConfidence)
            : defaults.minConfidence,
          minRiskReward: 0,
        };
      };

      const setupConfig: any = {
        pattern123: buildSetupConfig('pattern123', createDefault123Config),
        bearTrap: buildSetupConfig('bearTrap', createDefaultBearTrapConfig),
        meanReversion: buildSetupConfig('meanReversion', createDefaultMeanReversionConfig),
        enableLegacyDetectors: requestedLegacy.length > 0,
      };

      console.log('[Backtest] Legacy setups:', requestedLegacy);
      console.log('[Backtest] Dynamic setups:', requestedDynamic);

      const setupDetectionService = new SetupDetectionService(setupConfig);

      const loadedStrategies: StrategyDefinition[] = [];
      const strategyMap = new Map<string, StrategyDefinition>();
      if (requestedDynamic.length > 0) {
        const strategiesDir = resolve(__dirname, '../../../strategies/builtin');
        const loader = new StrategyLoader([strategiesDir]);
        const allStrategies = await loader.loadAll({ includeUnprofitable: true });

        for (const strategyDef of allStrategies) {
          if (requestedDynamic.includes(strategyDef.id)) {
            setupDetectionService.loadStrategy(strategyDef, strategyOverrides);
            loadedStrategies.push(strategyDef);
            strategyMap.set(strategyDef.id, strategyDef);
            console.log(`[Backtest] Loaded dynamic strategy: ${strategyDef.id}`);
          }
        }
      }

      const indicatorEngine = new IndicatorEngine();
      const conditionEvaluator = new ConditionEvaluator(indicatorEngine);

      let effectiveConfig = { ...config };
      
      if (loadedStrategies.length > 0) {
        const mergedParams = this.mergeOptimizedParams(loadedStrategies);
        if (mergedParams) {
          const useOptimized = config.useOptimizedSettings ?? false;

          effectiveConfig = {
            ...effectiveConfig,
            maxPositionSize: effectiveConfig.maxPositionSize ?? (
              useOptimized
                ? mergedParams.maxPositionSize  // Use strategy's optimized value
                : (effectiveConfig.positionSizingMethod === 'fixed-fractional' ? 10 : mergedParams.maxPositionSize)
            ),
            maxConcurrentPositions: effectiveConfig.maxConcurrentPositions ?? mergedParams.maxConcurrentPositions,
            maxTotalExposure: effectiveConfig.maxTotalExposure ?? mergedParams.maxTotalExposure,
            useAlgorithmicLevels: effectiveConfig.useAlgorithmicLevels ?? true,  // Default true for dynamic strategies
            useTrailingStop: effectiveConfig.useTrailingStop ?? mergedParams.useTrailingStop ?? false,
            trailingATRMultiplier: effectiveConfig.trailingATRMultiplier ?? mergedParams.trailingATRMultiplier,
            breakEvenAfterR: effectiveConfig.breakEvenAfterR ?? mergedParams.breakEvenAfterR,
            onlyWithTrend: effectiveConfig.onlyWithTrend ?? false,  // Applied per-strategy, not globally
            minConfidence: effectiveConfig.minConfidence ?? mergedParams.minConfidence,
            commission: effectiveConfig.commission ?? (mergedParams.commission !== undefined ? mergedParams.commission / 100 : 0.001),
            stopLossPercent: effectiveConfig.stopLossPercent,  // Will be ignored if setup provides stopLoss
            takeProfitPercent: effectiveConfig.takeProfitPercent,  // Will be ignored if setup provides takeProfit
            useMlFilter: effectiveConfig.useMlFilter ?? config.useMlFilter ?? false,
          };
        }
      }

      let detectedSetups: any[] = [];
      try {
        const warmupPeriod = this.calculateWarmupPeriod(loadedStrategies, effectiveConfig.trendFilterPeriod);
        const startIndex = warmupPeriod;
        const endIndex = historicalKlines.length - 1;

        console.log(`[Backtest] Scanning from index ${startIndex} to ${endIndex} (${endIndex - startIndex + 1} candles)`);

        detectedSetups = setupDetectionService.detectSetupsInRange(
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
      } catch (error) {
        console.error('[Backtest] Error detecting setups:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Setup detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          cause: error,
        });
      }

      const userStartTimestamp = new Date(config.startDate).getTime();
      const setupsInRange = detectedSetups.filter((s: any) => s.openTime >= userStartTimestamp);

      if (detectedSetups.length > setupsInRange.length) {
        console.log(`[Backtest] Excluded ${detectedSetups.length - setupsInRange.length} setups before startDate (warmup period)`);
      }

      let tradableSetups = effectiveConfig.minConfidence && effectiveConfig.minConfidence > 0
        ? setupsInRange.filter((s: any) => s.confidence >= effectiveConfig.minConfidence!)
        : setupsInRange;

      console.log('[Backtest] Filtered to', tradableSetups.length, 'tradable setups by confidence', effectiveConfig.minConfidence ? `(min: ${effectiveConfig.minConfidence}%)` : '(no filter)');

      if (effectiveConfig.useMlFilter) {
        try {
          await mlService.initialize();
          console.log('[Backtest] ML Service initialized, filtering setups...');

          const threshold = getThresholdForTimeframe(config.interval);
          const mlFilteredSetups: any[] = [];

          for (const setup of tradableSetups) {
            try {
              const requiredKlines = calculateRequiredKlinesForML(loadedStrategies as any) || DEFAULT_KLINES_FOR_ML;
              const setupKlines = historicalKlines.filter(k => k.openTime <= setup.openTime).slice(-requiredKlines);

              const prediction = await mlService.predictSetup(
                setupKlines,
                setup,
                undefined,
                config.symbol,
                config.interval
              );

              if (prediction.probability >= threshold.minProbability) {
                const blendedConfidence = Math.round((setup.confidence + prediction.confidence) / 2);

                mlFilteredSetups.push({
                  ...setup,
                  mlConfidence: prediction.confidence,
                  blendedConfidence,
                  mlPrediction: prediction.label === 1,
                });
              }
            } catch (error) {
              console.error('[Backtest] ML prediction failed for setup:', error);
            }
          }

          console.log(`[Backtest] ML filter: ${tradableSetups.length} → ${mlFilteredSetups.length} setups (min probability: ${threshold.minProbability})`);
          tradableSetups = mlFilteredSetups;
        } catch (error) {
          console.error('[Backtest] ML initialization failed, continuing without ML filter:', error);
        }
      }

      const trades: any[] = [];
      let equity = config.initialCapital;
      let peakEquity = config.initialCapital;
      let maxDrawdown = 0;
      const MIN_NOTIONAL_VALUE = 10;

      const equityCurve: any[] = [
        {
          time: config.startDate,
          equity: config.initialCapital,
          drawdown: 0,
          drawdownPercent: 0,
        },
      ];

      const klineMap = new Map(
        historicalKlines.map((k) => [k.openTime, k])
      );

      const { calculateEMA } = await import('@marketmind/indicators');
      const trendPeriod = effectiveConfig.trendFilterPeriod ?? 200;
      const emaTrend = calculateEMA(historicalKlines, trendPeriod);

      const sortedSetups = tradableSetups.sort(
        (a: any, b: any) => a.openTime - b.openTime
      );

      const MAX_CONCURRENT_POSITIONS = effectiveConfig.maxConcurrentPositions ?? 10;
      const MAX_TOTAL_EXPOSURE = effectiveConfig.maxTotalExposure ?? 1.0;
      const openPositions: Array<{ exitTime: number; positionValue: number }> = [];

      let skippedKlineNotFound = 0;
      let skippedTrend = 0;
      let skippedMinNotional = 0;
      let skippedMinProfit = 0;
      let skippedMaxPositions = 0;
      let skippedMaxExposure = 0;
      let skippedMarketContext = 0;
      let skippedCooldown = 0;
      let skippedDailyLossLimit = 0;
      let skippedVolatility = 0;
      let skippedRiskReward = 0;
      let skippedLimitExpired = 0;
      let skippedStochastic = 0;
      let skippedAdx = 0;

      const cooldownMap = new Map<string, number>();
      const cooldownMinutes = effectiveConfig.cooldownMinutes ?? 15;
      const cooldownMs = cooldownMinutes * 60 * 1000;

      let dailyPnl = 0;
      let currentDay = '';
      const dailyLossLimitPercent = effectiveConfig.dailyLossLimit ?? 5;
      let dailyLossLimitReached = false;

      let marketContextService: HistoricalMarketContextService | null = null;
      if (env.MARKET_CONTEXT_FILTER_ENABLED && effectiveConfig.useMarketContextFilter) {
        console.log('[Backtest] Initializing historical market context data...');
        marketContextService = new HistoricalMarketContextService({
          fearGreed: {
            enabled: effectiveConfig.marketContextConfig?.fearGreed?.enabled ?? true,
            thresholdLow: effectiveConfig.marketContextConfig?.fearGreed?.thresholdLow ?? 20,
            thresholdHigh: effectiveConfig.marketContextConfig?.fearGreed?.thresholdHigh ?? 80,
            action: effectiveConfig.marketContextConfig?.fearGreed?.action ?? 'reduce_size',
            sizeReduction: effectiveConfig.marketContextConfig?.fearGreed?.sizeReduction ?? 50,
          },
          fundingRate: {
            enabled: effectiveConfig.marketContextConfig?.fundingRate?.enabled ?? true,
            threshold: effectiveConfig.marketContextConfig?.fundingRate?.threshold ?? 0.05,
            action: effectiveConfig.marketContextConfig?.fundingRate?.action ?? 'penalize',
            penalty: effectiveConfig.marketContextConfig?.fundingRate?.penalty ?? 20,
          },
        });
        await marketContextService.initialize(
          new Date(config.startDate),
          new Date(config.endDate),
          [config.symbol]
        );
        console.log('[Backtest] Market context data loaded:', marketContextService.getStats());
      }

      for (const setup of sortedSetups) {
        openPositions.splice(0, openPositions.length, 
          ...openPositions.filter(p => p.exitTime > setup.openTime)
        );

        if (openPositions.length >= MAX_CONCURRENT_POSITIONS) {
          skippedMaxPositions++;
          continue;
        }

        const setupDate = new Date(setup.openTime);
        const setupDay = setupDate.toISOString().slice(0, 10);
        if (setupDay !== currentDay) {
          currentDay = setupDay;
          dailyPnl = 0;
          dailyLossLimitReached = false;
        }

        if (effectiveConfig.dailyLossLimit && dailyLossLimitReached) {
          skippedDailyLossLimit++;
          continue;
        }

        if (effectiveConfig.useCooldown) {
          const cooldownKey = `${setup.type}-${config.symbol}-${config.interval}`;
          const lastTradeTime = cooldownMap.get(cooldownKey);
          if (lastTradeTime && setup.openTime - lastTradeTime < cooldownMs) {
            skippedCooldown++;
            continue;
          }
        }

        if (effectiveConfig.onlyLong && setup.direction === 'SHORT') {
          continue;
        }

        if (effectiveConfig.useStochasticFilter) {
          const stochasticPeriod = 14;
          const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);

          if (setupIndex >= stochasticPeriod + 1) {
            const stochasticKlines = historicalKlines.slice(setupIndex - stochasticPeriod - 10, setupIndex + 1);
            const stochResult = calculateStochastic(stochasticKlines as Kline[], stochasticPeriod, 3);
            const currentStochK = stochResult.k[stochResult.k.length - 1];

            if (currentStochK !== null && currentStochK !== undefined) {
              let hadOversold = false;
              let hadOverbought = false;

              for (let i = stochResult.k.length - 1; i >= 0; i -= 1) {
                const k = stochResult.k[i];
                if (k === null || k === undefined) continue;

                if (!hadOversold && k < 20) hadOversold = true;
                if (!hadOverbought && k > 80) hadOverbought = true;

                if (hadOversold && hadOverbought) break;
              }

              const isLongAllowed = setup.direction === 'LONG' && hadOversold && currentStochK < 50;
              const isShortAllowed = setup.direction === 'SHORT' && hadOverbought && currentStochK > 50;

              if (!isLongAllowed && !isShortAllowed) {
                skippedStochastic++;
                if (trades.length < 3) {
                  console.log(`[Backtest] Stochastic filter blocked ${setup.direction} trade - currK=${currentStochK.toFixed(2)}, hadOversold=${hadOversold}, hadOverbought=${hadOverbought} (LONG: K was oversold AND K < 50, SHORT: K was overbought AND K > 50)`);
                }
                continue;
              }

              if (trades.length < 3) {
                const longReason = `K was in oversold and hasn't crossed 50 yet (current K: ${currentStochK.toFixed(2)})`;
                const shortReason = `K was in overbought and hasn't crossed 50 yet (current K: ${currentStochK.toFixed(2)})`;
                const reason = setup.direction === 'LONG' ? longReason : shortReason;
                console.log(`[Backtest] Stochastic filter passed ${setup.direction} trade - ${reason}`);
              }
            }
          }
        }

        if (effectiveConfig.useAdxFilter) {
          const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);

          if (setupIndex >= ADX_FILTER.MIN_KLINES_REQUIRED) {
            const adxKlines = historicalKlines.slice(
              setupIndex - ADX_FILTER.MIN_KLINES_REQUIRED,
              setupIndex + 1
            );
            const adxResult = calculateADX(adxKlines as Kline[], ADX_FILTER.PERIOD);
            const currentAdx = adxResult.adx[adxResult.adx.length - 1];
            const currentPlusDI = adxResult.plusDI[adxResult.plusDI.length - 1];
            const currentMinusDI = adxResult.minusDI[adxResult.minusDI.length - 1];

            if (currentAdx !== null && currentPlusDI !== null && currentMinusDI !== null) {
              const isBullish = currentPlusDI > currentMinusDI;
              const isBearish = currentMinusDI > currentPlusDI;
              const isStrongTrend = currentAdx >= ADX_FILTER.TREND_THRESHOLD;

              const isLongAllowed = setup.direction === 'LONG' && isBullish && isStrongTrend;
              const isShortAllowed = setup.direction === 'SHORT' && isBearish && isStrongTrend;

              if (!isLongAllowed && !isShortAllowed) {
                skippedAdx++;
                if (trades.length < 3) {
                  const reason = !isStrongTrend
                    ? `ADX (${currentAdx.toFixed(2)}) below threshold (${ADX_FILTER.TREND_THRESHOLD})`
                    : setup.direction === 'LONG'
                      ? `+DI (${currentPlusDI.toFixed(2)}) <= -DI (${currentMinusDI.toFixed(2)})`
                      : `-DI (${currentMinusDI.toFixed(2)}) <= +DI (${currentPlusDI.toFixed(2)})`;
                  console.log(`[Backtest] ADX filter blocked ${setup.direction} trade - ${reason}`);
                }
                continue;
              }

              if (trades.length < 3) {
                const condition = setup.direction === 'LONG'
                  ? `+DI (${currentPlusDI.toFixed(2)}) > -DI (${currentMinusDI.toFixed(2)}) with ADX (${currentAdx.toFixed(2)}) >= ${ADX_FILTER.TREND_THRESHOLD}`
                  : `-DI (${currentMinusDI.toFixed(2)}) > +DI (${currentPlusDI.toFixed(2)}) with ADX (${currentAdx.toFixed(2)}) >= ${ADX_FILTER.TREND_THRESHOLD}`;
                console.log(`[Backtest] ADX filter passed ${setup.direction} trade - ${condition}`);
              }
            }
          }
        }

        let marketContextMultiplier = 1.0;
        if (marketContextService) {
          const contextResult = marketContextService.evaluateSetup(
            setup.openTime,
            config.symbol,
            setup.direction
          );

          if (!contextResult.shouldTrade) {
            skippedMarketContext++;
            continue;
          }

          marketContextMultiplier = contextResult.positionSizeMultiplier;

          if (contextResult.warnings.length > 0 && trades.length < 5) {
            console.log(`[Backtest] Market context warnings for setup ${setup.type}:`, contextResult.warnings);
          }
        }

        const entryKline = klineMap.get(setup.openTime);

        if (!entryKline) {
          console.warn('[Backtest] Entry kline not found for setup', setup.id, 'at', setup.openTime);
          skippedKlineNotFound++;
          continue;
        }

        let entryPrice: number;
        let actualEntryKlineIndex: number = historicalKlines.findIndex(k => k.openTime === setup.openTime);

        if (setup.entryOrderType === 'LIMIT' && setup.limitEntryPrice !== undefined) {
          const limitPrice = setup.limitEntryPrice;
          const expirationBars = setup.expirationBars ?? 3;

          let limitFilled = false;
          let filledAtIndex = actualEntryKlineIndex;

          for (let i = actualEntryKlineIndex + 1; i <= actualEntryKlineIndex + expirationBars && i < historicalKlines.length; i++) {
            const kline = historicalKlines[i];
            if (!kline) continue;

            const high = parseFloat(kline.high);
            const low = parseFloat(kline.low);

            if (setup.direction === 'LONG' && low <= limitPrice) {
              limitFilled = true;
              filledAtIndex = i;
              break;
            } else if (setup.direction === 'SHORT' && high >= limitPrice) {
              limitFilled = true;
              filledAtIndex = i;
              break;
            }
          }

          if (!limitFilled) {
            if (trades.length < 3) {
              console.log(`[Backtest] Limit order expired - ${setup.direction} at ${limitPrice.toFixed(4)} not filled within ${expirationBars} bars`);
            }
            skippedLimitExpired++;
            continue;
          }

          entryPrice = limitPrice;
          actualEntryKlineIndex = filledAtIndex;

          if (trades.length < 3) {
            console.log(`[Backtest] Limit order filled - ${setup.direction} at ${limitPrice.toFixed(4)} (bar ${filledAtIndex - historicalKlines.findIndex(k => k.openTime === setup.openTime)})`);
          }
        } else {
          entryPrice = parseFloat(entryKline.close);
        }

        const setupStrategy = strategyMap.get(setup.type);
        const strategyOnlyWithTrend = setupStrategy?.optimizedParams?.onlyWithTrend ?? false;
        const configExplicitlyDisablesTrend = config.onlyWithTrend === false;
        const useTrendFilter = configExplicitlyDisablesTrend
          ? false
          : (effectiveConfig.onlyWithTrend || strategyOnlyWithTrend || effectiveConfig.trendFilterPeriod !== undefined);

        if (useTrendFilter && emaTrend.length > 0) {
          const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);
          const emaTrendValue = emaTrend[setupIndex];

          if (emaTrendValue !== null && emaTrendValue !== undefined) {
            const isBullishTrend = entryPrice > emaTrendValue;
            const isBearishTrend = entryPrice < emaTrendValue;

            if (setup.direction === 'LONG' && !isBullishTrend) {
              if (trades.length < 3) console.warn(`[Backtest] Skipping LONG setup - price below EMA${trendPeriod} (counter-trend)`);
              skippedTrend++;
              continue;
            }
            if (setup.direction === 'SHORT' && !isBearishTrend) {
              if (trades.length < 3) console.warn(`[Backtest] Skipping SHORT setup - price above EMA${trendPeriod} (counter-trend)`);
              skippedTrend++;
              continue;
            }
          }
        }

        const stopLoss = setup.stopLoss
          ? setup.stopLoss  // Priority 1: Use setup's calculated value
          : effectiveConfig.stopLossPercent
          ? setup.direction === 'LONG'
            ? entryPrice * (1 - effectiveConfig.stopLossPercent / 100)
            : entryPrice * (1 + effectiveConfig.stopLossPercent / 100)
          : undefined;  // No SL defined

        const takeProfit = setup.takeProfit
          ? setup.takeProfit  // Priority 1: Use setup's calculated value
          : effectiveConfig.takeProfitPercent
          ? setup.direction === 'LONG'
            ? entryPrice * (1 + effectiveConfig.takeProfitPercent / 100)
            : entryPrice * (1 - effectiveConfig.takeProfitPercent / 100)
          : undefined;  // No TP defined

        if (trades.length === 0) {
          const slSource = setup.stopLoss ? '✓ setup-ATR' : '⚠ config-fixed';
          const tpSource = setup.takeProfit ? '✓ setup-ATR' : '⚠ config-fixed';
          const slPercent = stopLoss ? (Math.abs((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
          const tpPercent = takeProfit ? (Math.abs((takeProfit - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
          console.log(`[Backtest] First Trade SL/TP: ${slSource} ${slPercent}% | ${tpSource} ${tpPercent}%`);
        }

        const positionSizingMethod = effectiveConfig.positionSizingMethod ?? 'fixed-fractional';
        let positionSize: number;
        let positionValue: number;

        if (positionSizingMethod === 'fixed-fractional') {
          positionSize = (equity * ((effectiveConfig.maxPositionSize ?? 10) / 100)) / entryPrice;
          positionValue = positionSize * entryPrice;
        } else {
          const rollingStats = calculateRollingStats(trades, 30);
          const kellyConfig = rollingStats ? {
            winRate: rollingStats.winRate,
            avgWinPercent: rollingStats.avgWinPercent,
            avgLossPercent: rollingStats.avgLossPercent,
          } : {};
          
          const sizingResult = PositionSizer.calculatePositionSize(
            equity,
            entryPrice,
            stopLoss,
            {
              method: positionSizingMethod,
              riskPerTrade: effectiveConfig.riskPerTrade ?? 2,
              kellyFraction: effectiveConfig.kellyFraction ?? 0.25,
              ...kellyConfig,
              minPositionPercent: 1,
              maxPositionPercent: effectiveConfig.maxPositionSize ?? 100,
            }
          );

          positionSize = sizingResult.positionSize;
          positionValue = sizingResult.positionValue;

          if (effectiveConfig.minConfidence !== undefined) {
            console.log(`[Position Sizing] ${sizingResult.rationale}`);
          }
        }

        const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);
        if (setupIndex >= 14) {
          const recentKlines = historicalKlines.slice(setupIndex - 13, setupIndex + 1);
          const atrValues = calculateATR(recentKlines, 14);
          if (atrValues.length > 0) {
            const currentATR = atrValues[atrValues.length - 1];
            if (currentATR !== null && currentATR !== undefined) {
              const atrPercent = (currentATR / entryPrice) * 100;
              const HIGH_VOLATILITY_THRESHOLD = 3.0;
              const VOLATILITY_REDUCTION_FACTOR = 0.7;

              if (atrPercent > HIGH_VOLATILITY_THRESHOLD) {
                const originalSize = positionSize;
                positionSize *= VOLATILITY_REDUCTION_FACTOR;
                positionValue = positionSize * entryPrice;
                if (trades.length < 3) {
                  console.log(`[Backtest] High volatility adjustment: ATR=${atrPercent.toFixed(2)}% > ${HIGH_VOLATILITY_THRESHOLD}%, size reduced from ${originalSize.toFixed(6)} to ${positionSize.toFixed(6)}`);
                }
              }
            }
          }
        }

        if (marketContextMultiplier < 1.0) {
          positionSize *= marketContextMultiplier;
          positionValue = positionSize * entryPrice;
        }

        const currentExposure = openPositions.reduce((sum, p) => sum + p.positionValue, 0);
        const totalExposure = (currentExposure + positionValue) / equity;
        
        if (totalExposure > MAX_TOTAL_EXPOSURE) {
          skippedMaxExposure++;
          continue;
        }

        if (positionValue < MIN_NOTIONAL_VALUE) {
          console.warn('[Backtest] Position value', positionValue.toFixed(2), 'below MIN_NOTIONAL (', MIN_NOTIONAL_VALUE, '), skipping trade');
          skippedMinNotional++;
          continue;
        }

        if (effectiveConfig.minProfitPercent && takeProfit) {
          const expectedProfitPercent = setup.direction === 'LONG'
            ? ((takeProfit - entryPrice) / entryPrice) * 100
            : ((entryPrice - takeProfit) / entryPrice) * 100;

          const profitAfterFees = expectedProfitPercent - ((effectiveConfig.commission ?? 0.001) * 200);

          if (profitAfterFees < effectiveConfig.minProfitPercent) {
            console.warn(
              '[Backtest] Skipping setup - expected profit after fees',
              `${profitAfterFees.toFixed(2)}%`,
              'is below minimum',
              `${effectiveConfig.minProfitPercent}%`
            );
            skippedMinProfit++;
            continue;
          }
        }

        const MIN_RISK_REWARD_RATIO = effectiveConfig.minRiskRewardRatio ?? 1.25;

        if (stopLoss && takeProfit) {
          let risk: number;
          let reward: number;

          if (setup.direction === 'LONG') {
            risk = entryPrice - stopLoss;
            reward = takeProfit - entryPrice;
          } else {
            risk = stopLoss - entryPrice;
            reward = entryPrice - takeProfit;
          }

          if (risk > 0) {
            const riskRewardRatio = reward / risk;

            if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
              if (trades.length < 3) {
                console.warn(
                  `[Backtest] Skipping setup - R:R ${riskRewardRatio.toFixed(2)}:1 below minimum ${MIN_RISK_REWARD_RATIO}:1`
                );
              }
              skippedRiskReward++;
              continue;
            }
          }
        }

        let exitPrice: number | undefined;
        let exitTime: string | undefined;
        let exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EXIT_CONDITION' | 'MAX_BARS' | 'END_OF_PERIOD' | undefined;

        const strategy = strategyMap.get(setup.type);
        const exitConditions = strategy?.exit?.conditions;
        const maxBarsInTrade = strategy?.exit?.maxBarsInTrade;
        const exitConditionForDirection = setup.direction === 'LONG'
          ? exitConditions?.long
          : exitConditions?.short;

        let computedIndicators: ComputedIndicators | null = null;
        let resolvedParams: Record<string, number> = {};

        if (exitConditionForDirection && strategy) {
          resolvedParams = Object.entries(strategy.parameters).reduce(
            (acc, [key, param]) => {
              acc[key] = strategyOverrides[key] ?? param.default;
              return acc;
            },
            {} as Record<string, number>
          );
          computedIndicators = indicatorEngine.computeIndicators(
            historicalKlines as Kline[],
            strategy.indicators,
            resolvedParams
          );
        }

        let barsInTrade = 0;

        const actualEntryKline = historicalKlines[actualEntryKlineIndex];
        const actualEntryTime = actualEntryKline?.openTime ?? setup.openTime;

        const futureKlines = historicalKlines.filter(
          (k) => k.openTime > actualEntryTime
        );

        const trailingStopConfig = strategy?.exit?.trailingStop;
        const useTrailingStop = trailingStopConfig?.enabled ?? effectiveConfig.useTrailingStop ?? false;
        let trailingStop = stopLoss;
        let highestHigh = entryPrice;
        let lowestLow = entryPrice;
        let breakEvenReached = false;
        const trailMultiplier = effectiveConfig.trailingATRMultiplier ?? trailingStopConfig?.trailMultiplier ?? 2;
        const atrAtEntry = setup.atr ?? (stopLoss ? Math.abs(entryPrice - stopLoss) / 1.5 : entryPrice * 0.02);

        const BREAKEVEN_THRESHOLD = 0.0075; // 0.75% profit for breakeven (consistent with auto-trading)
        const FEES_COVERED_THRESHOLD = 0.01; // 1% profit for fees covered
        const FEE_PERCENT = 0.002; // 0.2% total fees (entry + exit)
        const TRAILING_DISTANCE_PERCENT = 0.5; // Keep 50% of peak profit

        for (const futureKline of futureKlines) {
          barsInTrade++;
          const futureIndex = historicalKlines.findIndex(k => k.openTime === futureKline.openTime);
          const high = parseFloat(futureKline.high);
          const low = parseFloat(futureKline.low);
          const open = parseFloat(futureKline.open);
          const close = parseFloat(futureKline.close);

          if (useTrailingStop && stopLoss && barsInTrade > 1) {
            if (setup.direction === 'LONG') {
              if (high > highestHigh) highestHigh = high;

              const profitPercent = (close - entryPrice) / entryPrice;

              if (profitPercent >= BREAKEVEN_THRESHOLD && !breakEvenReached) {
                const breakevenPrice = entryPrice;
                if (breakevenPrice > trailingStop!) {
                  trailingStop = breakevenPrice;
                  breakEvenReached = true;
                }
              }

              if (profitPercent >= FEES_COVERED_THRESHOLD && breakEvenReached) {
                const candidates: number[] = [];

                const feesCoveredPrice = entryPrice * (1 + FEE_PERCENT);
                candidates.push(feesCoveredPrice);

                const peakProfit = (highestHigh - entryPrice) / entryPrice;
                const floorProfit = peakProfit * (1 - TRAILING_DISTANCE_PERCENT);
                const progressiveFloor = entryPrice * (1 + floorProfit);
                if (progressiveFloor > entryPrice) candidates.push(progressiveFloor);

                const atrTrail = highestHigh - (atrAtEntry * trailMultiplier);
                if (atrTrail > entryPrice) candidates.push(atrTrail);

                const bestCandidate = Math.max(...candidates);
                if (bestCandidate > trailingStop!) {
                  trailingStop = bestCandidate;
                }
              }
            } else {
              if (low < lowestLow) lowestLow = low;

              const profitPercent = (entryPrice - close) / entryPrice;

              if (profitPercent >= BREAKEVEN_THRESHOLD && !breakEvenReached) {
                const breakevenPrice = entryPrice;
                if (breakevenPrice < trailingStop!) {
                  trailingStop = breakevenPrice;
                  breakEvenReached = true;
                }
              }

              if (profitPercent >= FEES_COVERED_THRESHOLD && breakEvenReached) {
                const candidates: number[] = [];

                const feesCoveredPrice = entryPrice * (1 - FEE_PERCENT);
                candidates.push(feesCoveredPrice);

                const peakProfit = (entryPrice - lowestLow) / entryPrice;
                const floorProfit = peakProfit * (1 - TRAILING_DISTANCE_PERCENT);
                const progressiveFloor = entryPrice * (1 - floorProfit);
                if (progressiveFloor < entryPrice) candidates.push(progressiveFloor);

                const atrTrail = lowestLow + (atrAtEntry * trailMultiplier);
                if (atrTrail < entryPrice) candidates.push(atrTrail);

                const bestCandidate = Math.min(...candidates);
                if (bestCandidate < trailingStop!) {
                  trailingStop = bestCandidate;
                }
              }
            }
          }

          if (exitConditionForDirection && computedIndicators && futureIndex >= 0) {
            const context: EvaluationContext = {
              klines: historicalKlines,
              currentIndex: futureIndex,
              indicators: computedIndicators,
              params: resolvedParams,
            };

            const exitConditionMet = conditionEvaluator.evaluate(exitConditionForDirection, context);
            if (exitConditionMet) {
              exitPrice = close;
              exitTime = new Date(futureKline.openTime).toISOString();
              exitReason = 'EXIT_CONDITION';
              break;
            }
          }

          if (maxBarsInTrade && barsInTrade >= maxBarsInTrade) {
            exitPrice = close;
            exitTime = new Date(futureKline.openTime).toISOString();
            exitReason = 'MAX_BARS';
            break;
          }

          const effectiveSL = useTrailingStop ? trailingStop : stopLoss;
          const slHit = effectiveSL && (
            (setup.direction === 'LONG' && low <= effectiveSL) ||
            (setup.direction === 'SHORT' && high >= effectiveSL)
          );
          const effectiveTP = useTrailingStop ? undefined : takeProfit;
          const tpHit = effectiveTP && (
            (setup.direction === 'LONG' && high >= effectiveTP) ||
            (setup.direction === 'SHORT' && low <= effectiveTP)
          );

          if (slHit && tpHit) {
            const isBullishCandle = close > open;
            if (setup.direction === 'LONG') {
              exitReason = isBullishCandle ? 'TAKE_PROFIT' : 'STOP_LOSS';
              exitPrice = isBullishCandle ? effectiveTP : effectiveSL;
            } else {
              exitReason = isBullishCandle ? 'STOP_LOSS' : 'TAKE_PROFIT';
              exitPrice = isBullishCandle ? effectiveSL : effectiveTP;
            }
            exitTime = new Date(futureKline.openTime).toISOString();
            break;
          } else if (slHit) {
            exitPrice = effectiveSL;
            exitTime = new Date(futureKline.openTime).toISOString();
            exitReason = useTrailingStop && breakEvenReached ? 'STOP_LOSS' : 'STOP_LOSS';
            break;
          } else if (tpHit) {
            exitPrice = effectiveTP;
            exitTime = new Date(futureKline.openTime).toISOString();
            exitReason = 'TAKE_PROFIT';
            break;
          }
        }

        if (!exitPrice) {
          const lastKline = historicalKlines[historicalKlines.length - 1];
          exitPrice = parseFloat(lastKline!.close);
          exitTime = new Date(lastKline!.openTime).toISOString();
          exitReason = 'END_OF_PERIOD';
        }

        if (exitReason === 'STOP_LOSS' || exitReason === 'TAKE_PROFIT') {
          const slippagePercent = effectiveConfig.slippagePercent ?? 0.1; // 0.1% default (consistent with auto-trading)
          const slippageAmount = exitPrice * (slippagePercent / 100);
          if (exitReason === 'STOP_LOSS') {
            exitPrice = setup.direction === 'LONG'
              ? exitPrice - slippageAmount
              : exitPrice + slippageAmount;
          } else {
            exitPrice = setup.direction === 'LONG'
              ? exitPrice - slippageAmount
              : exitPrice + slippageAmount;
          }
        }

        const priceDiff =
          setup.direction === 'LONG'
            ? exitPrice - entryPrice
            : entryPrice - exitPrice;

        const pnl = priceDiff * positionSize;
        const commissionRate = effectiveConfig.commission ?? 0.001;
        const entryCommission = positionSize * entryPrice * commissionRate;
        const exitCommission = positionSize * exitPrice * commissionRate;
        const commission = entryCommission + exitCommission;
        const netPnl = pnl - commission;
        const pnlPercent = (netPnl / positionValue) * 100;

        equity += netPnl;

        if (equity > peakEquity) {
          peakEquity = equity;
        }
        const currentDrawdown = peakEquity - equity;
        const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }

        const trade = {
          id: generateId(16),
          setupId: setup.id,
          setupType: setup.type,
          setupConfidence: setup.confidence,
          entryTime: new Date(actualEntryTime).toISOString(),
          entryPrice,
          exitTime,
          exitPrice,
          side: setup.direction,
          quantity: positionSize,
          stopLoss,
          takeProfit,
          pnl,
          pnlPercent,
          commission,
          netPnl,
          exitReason,
          status: 'CLOSED' as const,
          entryOrderType: setup.entryOrderType,
        };

        trades.push(trade);

        if (effectiveConfig.useCooldown) {
          const cooldownKey = `${setup.type}-${config.symbol}-${config.interval}`;
          cooldownMap.set(cooldownKey, setup.openTime);
        }

        if (effectiveConfig.dailyLossLimit) {
          dailyPnl += netPnl;
          const dailyLossLimitAmount = (config.initialCapital * dailyLossLimitPercent) / 100;
          if (dailyPnl < -dailyLossLimitAmount) {
            dailyLossLimitReached = true;
            console.log(`[Backtest] Daily loss limit reached on ${currentDay}: ${dailyPnl.toFixed(2)} < -${dailyLossLimitAmount.toFixed(2)}`);
          }
        }

        if (exitTime) {
          openPositions.push({
            exitTime: new Date(exitTime).getTime(),
            positionValue: positionValue,
          });
        }

        if (exitTime) {
          equityCurve.push({
            time: exitTime,
            equity,
            drawdown: currentDrawdown,
            drawdownPercent: currentDrawdownPercent,
          });
        }
      }

      const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
      const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);

      const totalPnl = trades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
      const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

      const totalGrossPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const totalLosses = Math.abs(
        losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      );
      const grossProfitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

      const calculateDuration = (trade: any) => {
        if (!trade.exitTime) return 0;
        const entry = new Date(trade.entryTime).getTime();
        const exit = new Date(trade.exitTime).getTime();
        return (exit - entry) / (1000 * 60); // minutes
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

      const metrics = {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,

        totalPnl,
        totalPnlPercent: (totalPnl / config.initialCapital) * 100,
        avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
        avgPnlPercent:
          trades.length > 0
            ? trades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / trades.length
            : 0,

        grossWinRate: winRate,
        grossProfitFactor,
        totalGrossPnl,

        avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
        largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.pnl ?? 0)) : 0,
        largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl ?? 0)) : 0,
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
        const returns = trades.map((t) => t.pnlPercent ?? 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance =
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
          (returns.length - 1);
        const stdDev = Math.sqrt(variance);
        metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('[Backtest] Completed in', (duration / 1000).toFixed(2), 'seconds');
      console.log('[Backtest] Skip reasons:', {
        maxPositions: skippedMaxPositions,
        maxExposure: skippedMaxExposure,
        klineNotFound: skippedKlineNotFound,
        trendFilter: skippedTrend,
        minNotional: skippedMinNotional,
        minProfit: skippedMinProfit,
        riskReward: skippedRiskReward,
        stochastic: skippedStochastic,
        adx: skippedAdx,
        marketContext: skippedMarketContext,
        cooldown: skippedCooldown,
        dailyLossLimit: skippedDailyLossLimit,
        volatility: skippedVolatility,
        limitExpired: skippedLimitExpired,
        total: skippedMaxPositions + skippedMaxExposure + skippedKlineNotFound + skippedTrend + skippedMinNotional + skippedMinProfit + skippedRiskReward + skippedStochastic + skippedAdx + skippedMarketContext + skippedCooldown + skippedDailyLossLimit + skippedVolatility + skippedLimitExpired,
      });
      console.log('[Backtest] Results:', {
        trades: trades.length,
        winRate: `${metrics.winRate.toFixed(2)}%`,
        totalPnl: `${metrics.totalPnl.toFixed(2)} USDT (${metrics.totalPnlPercent.toFixed(2)}%)`,
        finalEquity: `${equity.toFixed(2)} USDT`,
        maxDrawdown: `${metrics.maxDrawdown.toFixed(2)} USDT (${metrics.maxDrawdownPercent.toFixed(2)}%)`,
        profitFactor: metrics.profitFactor.toFixed(2),
      });

      const result: BacktestResult = {
        id: backtestId,
        config,
        trades,
        metrics,
        equityCurve,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        status: 'COMPLETED' as const,
        setupDetections: detectedSetups,
        klines: historicalKlines,
      };

      return result;
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

  /**
   * Calculate the warmup period needed for indicators in the strategies.
   * This ensures we have enough historical data for all indicators to produce valid values.
   */
  private calculateWarmupPeriod(strategies: StrategyDefinition[], trendFilterPeriod?: number): number {
    const MIN_WARMUP = 50; // Minimum warmup for basic indicators
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

      if (strategy.optimizedParams?.onlyWithTrend && !trendFilterPeriod) {
        maxPeriod = Math.max(maxPeriod, 200);
      }
    }

    const warmupWithBuffer = Math.ceil(maxPeriod * 1.5);
    console.log(`[Backtest] Calculated warmup period: ${warmupWithBuffer} (max indicator period: ${maxPeriod})`);

    return warmupWithBuffer;
  }
}
