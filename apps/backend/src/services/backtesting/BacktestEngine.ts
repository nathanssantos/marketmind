import type { BacktestConfig, BacktestResult, ComputedIndicators, EvaluationContext, Interval, Kline, OptimizedBacktestParams, StrategyDefinition } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { fetchHistoricalKlinesFromAPI } from '../binance-historical';
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
    if (!match || !match[1] || !match[2]) return 4 * 60 * 60 * 1000;
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

      // 1. Fetch historical klines (or use provided ones)
      // IMPORTANT: We need extra historical data for EMA200 calculation
      // Without this, EMA200 will be null for the first ~200 bars, causing
      // the trend filter (onlyWithTrend) to be bypassed!
      const EMA200_WARMUP_BARS = 250; // Extra bars needed for EMA200 warmup
      let historicalKlines: any[];
      let warmupBarsFetched = 0;

      if (klines && klines.length > 0) {
        console.log('[Backtest] Using pre-fetched klines:', klines.length);
        historicalKlines = klines;
      } else {
        console.log('[Backtest] Fetching historical klines from Binance API...');

        // Calculate warmup start date based on interval
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

        // Count how many warmup bars we got
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

      // 2. Setup detection configuration
      const setupsToEnable = config.setupTypes?.length ? config.setupTypes : [
        'pattern123', 'bearTrap', 'meanReversion'
      ];

      // Legacy strategy IDs
      const legacyStrategies = ['pattern123', 'bearTrap', 'meanReversion'];
      const requestedLegacy = setupsToEnable.filter(s => legacyStrategies.includes(s));
      const requestedDynamic = setupsToEnable.filter(s => !legacyStrategies.includes(s));

      // Import default configs from individual files
      const { createDefault123Config } = await import('../setup-detection/Pattern123Detector');
      const { createDefaultBearTrapConfig } = await import('../setup-detection/BearTrapDetector');
      const { createDefaultMeanReversionConfig } = await import('../setup-detection/MeanReversionDetector');

      // Create setup config with defaults + relaxed settings for backtesting
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

      // Load dynamic strategies if requested
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

      // CRITICAL: Apply strategy's optimizedParams as defaults (fallback when CLI doesn't provide)
      // PRIORITY: CLI parameters > Strategy optimizedParams > System defaults
      // This allows CLI to override when needed, but uses optimized values when not specified
      let effectiveConfig = { ...config };
      
      if (loadedStrategies.length > 0) {
        const mergedParams = this.mergeOptimizedParams(loadedStrategies);
        if (mergedParams) {
          // When useOptimizedSettings is true, use strategy's optimized values
          // When false (default), use safe defaults for fixed-fractional
          const useOptimized = config.useOptimizedSettings ?? false;

          effectiveConfig = {
            ...effectiveConfig,
            // CRITICAL: When --optimized flag is set, use strategy's maxPositionSize
            // Otherwise, use safe default (10%) for fixed-fractional to prevent over-leveraging
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
            // For SL/TP: only use config values if explicitly provided AND setup doesn't calculate them
            // Setup-calculated values (from ATR, etc.) always take priority in BacktestEngine execution
            stopLossPercent: effectiveConfig.stopLossPercent,  // Will be ignored if setup provides stopLoss
            takeProfitPercent: effectiveConfig.takeProfitPercent,  // Will be ignored if setup provides takeProfit
          };
        }
      }

      // 3. Detect setups
      let detectedSetups: any[] = [];
      try {
        // Calculate warmup period based on indicators used in strategies
        const warmupPeriod = this.calculateWarmupPeriod(loadedStrategies);
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

      // Filter setups that are before the user's requested startDate
      // (warmup data is only for indicator calculation, not for trading)
      const userStartTimestamp = new Date(config.startDate).getTime();
      const setupsInRange = detectedSetups.filter((s: any) => s.openTime >= userStartTimestamp);

      if (detectedSetups.length > setupsInRange.length) {
        console.log(`[Backtest] Excluded ${detectedSetups.length - setupsInRange.length} setups before startDate (warmup period)`);
      }

      // Filter by minimum confidence if specified
      const tradableSetups = effectiveConfig.minConfidence && effectiveConfig.minConfidence > 0
        ? setupsInRange.filter((s: any) => s.confidence >= effectiveConfig.minConfidence!)
        : setupsInRange;

      console.log('[Backtest] Filtered to', tradableSetups.length, 'tradable setups by confidence', effectiveConfig.minConfidence ? `(min: ${effectiveConfig.minConfidence}%)` : '(no filter)');

      // 4. Simulate trading
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

      // Calculate EMA200 for trend detection (always calculate - used per-strategy)
      const { calculateEMA } = await import('@marketmind/indicators');
      const ema200 = calculateEMA(historicalKlines, 200);

      // Sort setups by openTime
      const sortedSetups = tradableSetups.sort(
        (a: any, b: any) => a.openTime - b.openTime
      );

      // Track open positions to manage multiple concurrent trades
      const MAX_CONCURRENT_POSITIONS = effectiveConfig.maxConcurrentPositions ?? 5;
      const MAX_TOTAL_EXPOSURE = effectiveConfig.maxTotalExposure ?? 0.5;
      const openPositions: Array<{ exitTime: number; positionValue: number }> = [];

      // Debug counters
      let skippedOverlap = 0;
      let skippedKlineNotFound = 0;
      let skippedTrend = 0;
      let skippedMinNotional = 0;
      let skippedMinProfit = 0;
      let skippedMaxPositions = 0;
      let skippedMaxExposure = 0;

      for (const setup of sortedSetups) {
        // Clean up closed positions
        openPositions.splice(0, openPositions.length, 
          ...openPositions.filter(p => p.exitTime > setup.openTime)
        );

        // Check if we've reached max concurrent positions
        if (openPositions.length >= MAX_CONCURRENT_POSITIONS) {
          skippedMaxPositions++;
          continue;
        }

        const entryKline = klineMap.get(setup.openTime);

        if (!entryKline) {
          console.warn('[Backtest] Entry kline not found for setup', setup.id, 'at', setup.openTime);
          skippedKlineNotFound++;
          continue;
        }

        const entryPrice = parseFloat(entryKline.close);

        // Filter by trend if enabled FOR THIS SPECIFIC STRATEGY
        const setupStrategy = strategyMap.get(setup.type);
        const strategyOnlyWithTrend = setupStrategy?.optimizedParams?.onlyWithTrend ?? false;
        
        if (strategyOnlyWithTrend && ema200.length > 0) {
          const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);
          const ema200Value = ema200[setupIndex];

          if (ema200Value !== null && ema200Value !== undefined) {
            const isBullishTrend = entryPrice > ema200Value;
            const isBearishTrend = entryPrice < ema200Value;

            if (setup.direction === 'LONG' && !isBullishTrend) {
              console.warn('[Backtest] Skipping LONG setup - price below EMA200 (counter-trend)');
              skippedTrend++;
              continue;
            }
            if (setup.direction === 'SHORT' && !isBearishTrend) {
              console.warn('[Backtest] Skipping SHORT setup - price above EMA200 (counter-trend)');
              skippedTrend++;
              continue;
            }
          }
        }

        // Calculate SL/TP first (needed for position sizing)
        // CRITICAL PRIORITY LOGIC:
        // 1. ALWAYS use setup's calculated values if available (strategy-specific ATR/indicator-based)
        // 2. Only fall back to fixed config percentages if setup doesn't provide values
        // 3. This ensures dynamic strategies (larry-williams, momentum-breakout) use their own calculations
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

        // Log SL/TP source for first trade (debug - always show)
        if (trades.length === 0) {
          const slSource = setup.stopLoss ? '✓ setup-ATR' : '⚠ config-fixed';
          const tpSource = setup.takeProfit ? '✓ setup-ATR' : '⚠ config-fixed';
          const slPercent = stopLoss ? (Math.abs((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
          const tpPercent = takeProfit ? (Math.abs((takeProfit - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
          console.log(`[Backtest] First Trade SL/TP: ${slSource} ${slPercent}% | ${tpSource} ${tpPercent}%`);
        }

        // Calculate position size using intelligent position sizing
        const positionSizingMethod = effectiveConfig.positionSizingMethod ?? 'fixed-fractional';
        let positionSize: number;
        let positionValue: number;

        if (positionSizingMethod === 'fixed-fractional') {
          // Original behavior: fixed % of equity
          positionSize = (equity * ((effectiveConfig.maxPositionSize ?? 10) / 100)) / entryPrice;
          positionValue = positionSize * entryPrice;
        } else {
          // Calculate real trade statistics for Kelly Criterion
          const rollingStats = calculateRollingStats(trades, 30);
          const kellyConfig = rollingStats ? {
            winRate: rollingStats.winRate,
            avgWinPercent: rollingStats.avgWinPercent,
            avgLossPercent: rollingStats.avgLossPercent,
          } : {};
          
          // Use PositionSizer for intelligent sizing
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

          // Log sizing decision in verbose mode
          if (effectiveConfig.minConfidence !== undefined) {
            console.log(`[Position Sizing] ${sizingResult.rationale}`);
          }
        }

        // Check total exposure limit
        const currentExposure = openPositions.reduce((sum, p) => sum + p.positionValue, 0);
        const totalExposure = (currentExposure + positionValue) / equity;
        
        if (totalExposure > MAX_TOTAL_EXPOSURE) {
          skippedMaxExposure++;
          continue;
        }

        // Ensure position value meets minimum
        if (positionValue < MIN_NOTIONAL_VALUE) {
          console.warn('[Backtest] Position value', positionValue.toFixed(2), 'below MIN_NOTIONAL (', MIN_NOTIONAL_VALUE, '), skipping trade');
          skippedMinNotional++;
          continue;
        }

        // Filter by minimum expected profit after fees
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

        // Find exit
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

        const futureKlines = historicalKlines.filter(
          (k) => k.openTime > setup.openTime
        );

        const trailingStopConfig = strategy?.exit?.trailingStop;
        const useTrailingStop = trailingStopConfig?.enabled ?? effectiveConfig.useTrailingStop ?? false;
        let trailingStop = stopLoss;
        let highestHigh = entryPrice;
        let lowestLow = entryPrice;
        let breakEvenReached = false;
        const trailMultiplier = effectiveConfig.trailingATRMultiplier ?? trailingStopConfig?.trailMultiplier ?? 2;
        const breakEvenAfterR = effectiveConfig.breakEvenAfterR ?? trailingStopConfig?.breakEvenAfterR ?? 1;
        const atrAtEntry = setup.atr ?? (stopLoss ? Math.abs(entryPrice - stopLoss) / 1.5 : entryPrice * 0.02);

        for (const futureKline of futureKlines) {
          barsInTrade++;
          const futureIndex = historicalKlines.findIndex(k => k.openTime === futureKline.openTime);
          const high = parseFloat(futureKline.high);
          const low = parseFloat(futureKline.low);
          const open = parseFloat(futureKline.open);
          const close = parseFloat(futureKline.close);

          if (useTrailingStop && stopLoss) {
            if (setup.direction === 'LONG') {
              if (high > highestHigh) {
                highestHigh = high;
                const riskAmount = entryPrice - stopLoss;
                const unrealizedR = (highestHigh - entryPrice) / riskAmount;
                if (unrealizedR >= breakEvenAfterR && !breakEvenReached) {
                  trailingStop = entryPrice + (atrAtEntry * 0.1);
                  breakEvenReached = true;
                }
                if (breakEvenReached) {
                  const newTrailingStop = highestHigh - (atrAtEntry * trailMultiplier);
                  if (newTrailingStop > trailingStop!) {
                    trailingStop = newTrailingStop;
                  }
                }
              }
            } else {
              if (low < lowestLow) {
                lowestLow = low;
                const riskAmount = stopLoss - entryPrice;
                const unrealizedR = (entryPrice - lowestLow) / riskAmount;
                if (unrealizedR >= breakEvenAfterR && !breakEvenReached) {
                  trailingStop = entryPrice - (atrAtEntry * 0.1);
                  breakEvenReached = true;
                }
                if (breakEvenReached) {
                  const newTrailingStop = lowestLow + (atrAtEntry * trailMultiplier);
                  if (newTrailingStop < trailingStop!) {
                    trailingStop = newTrailingStop;
                  }
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

        // If no exit found, close at end of period
        if (!exitPrice) {
          const lastKline = historicalKlines[historicalKlines.length - 1];
          exitPrice = parseFloat(lastKline!.close);
          exitTime = new Date(lastKline!.openTime).toISOString();
          exitReason = 'END_OF_PERIOD';
        }

        // Apply slippage for stop loss exits (market orders)
        // Take profit is assumed to be limit order (no slippage)
        if (exitReason === 'STOP_LOSS') {
          const slippagePercent = effectiveConfig.slippagePercent ?? 0.05; // 0.05% default
          const slippageAmount = exitPrice * (slippagePercent / 100);
          // Slippage is unfavorable: LONG exits lower, SHORT exits higher
          exitPrice = setup.direction === 'LONG'
            ? exitPrice - slippageAmount
            : exitPrice + slippageAmount;
        }

        // Calculate PnL
        const priceDiff =
          setup.direction === 'LONG'
            ? exitPrice - entryPrice
            : entryPrice - exitPrice;

        const pnl = priceDiff * positionSize;
        // Calculate commission correctly: entry fee + exit fee (based on actual prices)
        const commissionRate = effectiveConfig.commission ?? 0.001;
        const entryCommission = positionSize * entryPrice * commissionRate;
        const exitCommission = positionSize * exitPrice * commissionRate;
        const commission = entryCommission + exitCommission;
        const netPnl = pnl - commission;
        const pnlPercent = (netPnl / positionValue) * 100;

        // Update equity
        equity += netPnl;

        // Track drawdown
        if (equity > peakEquity) {
          peakEquity = equity;
        }
        const currentDrawdown = peakEquity - equity;
        const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }

        // Record trade
        const trade = {
          id: generateId(16),
          setupId: setup.id,
          setupType: setup.type,
          setupConfidence: setup.confidence,
          entryTime: new Date(setup.openTime).toISOString(),
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
        };

        trades.push(trade);

        // Track this position for concurrent position management
        if (exitTime) {
          openPositions.push({
            exitTime: new Date(exitTime).getTime(),
            positionValue: positionValue,
          });
        }

        // Update equity curve
        if (exitTime) {
          equityCurve.push({
            time: exitTime,
            equity,
            drawdown: currentDrawdown,
            drawdownPercent: currentDrawdownPercent,
          });
        }
      }

      // 5. Calculate metrics
      // Use gross PnL (before fees) for win/loss classification
      // This reflects actual trade quality - fees are a separate concern
      const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
      const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);

      // Net PnL (after fees) - for equity calculations
      const totalPnl = trades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
      const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

      // Gross PnL (before fees) - for trade quality metrics
      const totalGrossPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const totalLosses = Math.abs(
        losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      );
      const grossProfitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

      // Calculate trade durations
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

        // Gross metrics (before fees) - reflects trade quality
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

      // 6. Calculate Sharpe Ratio
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
        total: skippedMaxPositions + skippedMaxExposure + skippedKlineNotFound + skippedTrend + skippedMinNotional + skippedMinProfit,
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
  private calculateWarmupPeriod(strategies: StrategyDefinition[]): number {
    const MIN_WARMUP = 50; // Minimum warmup for basic indicators
    let maxPeriod = MIN_WARMUP;

    for (const strategy of strategies) {
      // Check indicators defined in the strategy
      if (strategy.indicators) {
        for (const [, indicator] of Object.entries(strategy.indicators)) {
          const params = indicator.params || {};

          // Extract period from various parameter names
          const period = params.period || params.emaPeriod || params.smaPeriod ||
                        params.lookback || params.kPeriod || params.slowPeriod || 0;

          // Handle parameter references (e.g., "$smaTrend")
          const periodValue = typeof period === 'string' && period.startsWith('$')
            ? strategy.parameters?.[period.slice(1)]?.default || 0
            : period;

          if (typeof periodValue === 'number' && periodValue > maxPeriod) {
            maxPeriod = periodValue;
          }
        }
      }

      // Check parameters for trend filters (like EMA 200)
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

      // Check filters for trend periods
      if (strategy.filters?.trendFilter?.period) {
        const trendPeriod = strategy.filters.trendFilter.period;
        if (typeof trendPeriod === 'number' && trendPeriod > maxPeriod) {
          maxPeriod = trendPeriod;
        }
      }

      // If strategy uses onlyWithTrend, we need EMA200 to be valid
      if (strategy.optimizedParams?.onlyWithTrend) {
        maxPeriod = Math.max(maxPeriod, 200);
      }
    }

    // Add extra buffer for indicator calculations (some need 2x the period)
    const warmupWithBuffer = Math.ceil(maxPeriod * 1.5);
    console.log(`[Backtest] Calculated warmup period: ${warmupWithBuffer} (max indicator period: ${maxPeriod})`);

    return warmupWithBuffer;
  }
}
