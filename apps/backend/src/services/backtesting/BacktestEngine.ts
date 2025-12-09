import type { BacktestConfig, BacktestResult, ComputedIndicators, EvaluationContext, Interval, Kline, OptimizedBacktestParams, StrategyDefinition } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { fetchHistoricalKlinesFromAPI } from '../binance-historical';
import { SetupDetectionService } from '../setup-detection/SetupDetectionService';
import { ConditionEvaluator, IndicatorEngine, StrategyLoader } from '../setup-detection/dynamic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

export class BacktestEngine {
  /**
   * Merge optimizedParams from multiple strategies.
   * When multiple strategies are tested together:
   * - Uses the most conservative (lowest) maxPositionSize
   * - onlyWithTrend is DISABLED here (applied per-strategy instead)
   * - useAlgorithmicLevels is true if ANY strategy uses it
   * - minConfidence is the highest of all strategies
   * - commission uses the highest value
   */
  private mergeOptimizedParams(strategies: StrategyDefinition[]): OptimizedBacktestParams | null {
    const strategiesWithParams = strategies.filter(s => s.optimizedParams);
    if (strategiesWithParams.length === 0) return null;

    const allParams = strategiesWithParams.map(s => s.optimizedParams!);

    return {
      maxPositionSize: Math.min(...allParams.map(p => p.maxPositionSize)),
      useAlgorithmicLevels: allParams.some(p => p.useAlgorithmicLevels),
      onlyWithTrend: false, // FIXED: Don't apply globally, check per-strategy instead
      minConfidence: Math.max(...allParams.map(p => p.minConfidence ?? 0)) || undefined,
      commission: Math.max(...allParams.map(p => p.commission ?? 0.1)),
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
      let historicalKlines: any[];

      if (klines && klines.length > 0) {
        console.log('[Backtest] Using pre-fetched klines:', klines.length);
        historicalKlines = klines;
      } else {
        console.log('[Backtest] Fetching historical klines from Binance API...');
        historicalKlines = await fetchHistoricalKlinesFromAPI(
          config.symbol,
          config.interval as Interval,
          new Date(config.startDate),
          new Date(config.endDate)
        );
        console.log('[Backtest] Fetched', historicalKlines.length, 'klines from API');
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
      let loadedStrategies: StrategyDefinition[] = [];
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

      // Apply optimizedParams from strategy definitions if useOptimizedSettings is enabled
      let effectiveConfig = { ...config };
      
      if (config.useOptimizedSettings && loadedStrategies.length > 0) {
        const mergedParams = this.mergeOptimizedParams(loadedStrategies);
        if (mergedParams) {
          effectiveConfig = {
            ...effectiveConfig,
            maxPositionSize: mergedParams.maxPositionSize ?? effectiveConfig.maxPositionSize,
            useAlgorithmicLevels: mergedParams.useAlgorithmicLevels ?? effectiveConfig.useAlgorithmicLevels,
            onlyWithTrend: mergedParams.onlyWithTrend ?? effectiveConfig.onlyWithTrend ?? false,  // FIXED: Default to false
            minConfidence: mergedParams.minConfidence ?? effectiveConfig.minConfidence,
            commission: mergedParams.commission !== undefined ? mergedParams.commission / 100 : effectiveConfig.commission,
            stopLossPercent: mergedParams.stopLossPercent ?? effectiveConfig.stopLossPercent,
            takeProfitPercent: mergedParams.takeProfitPercent ?? effectiveConfig.takeProfitPercent,
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

      // Filter by minimum confidence if specified
      const tradableSetups = effectiveConfig.minConfidence && effectiveConfig.minConfidence > 0
        ? detectedSetups.filter((s: any) => s.confidence >= effectiveConfig.minConfidence!)
        : detectedSetups;

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

      // Track open position to prevent overlapping trades
      let currentPositionExitTime: number | null = null;

      for (const setup of sortedSetups) {
        // Skip if we have an open position that hasn't exited yet
        if (currentPositionExitTime !== null && setup.openTime < currentPositionExitTime) {
          continue;
        }

        const entryKline = klineMap.get(setup.openTime);

        if (!entryKline) {
          console.warn('[Backtest] Entry kline not found for setup', setup.id, 'at', setup.openTime);
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
              continue;
            }
            if (setup.direction === 'SHORT' && !isBearishTrend) {
              console.warn('[Backtest] Skipping SHORT setup - price above EMA200 (counter-trend)');
              continue;
            }
          }
        }

        const positionSize = (equity * ((effectiveConfig.maxPositionSize ?? 10) / 100)) / entryPrice;
        const positionValue = positionSize * entryPrice;

        // Ensure position value meets minimum
        if (positionValue < MIN_NOTIONAL_VALUE) {
          console.warn('[Backtest] Position value', positionValue.toFixed(2), 'below MIN_NOTIONAL (', MIN_NOTIONAL_VALUE, '), skipping trade');
          continue;
        }

        // Calculate SL/TP
        const stopLoss = effectiveConfig.useAlgorithmicLevels && setup.stopLoss
          ? setup.stopLoss
          : effectiveConfig.stopLossPercent
          ? setup.direction === 'LONG'
            ? entryPrice * (1 - effectiveConfig.stopLossPercent / 100)
            : entryPrice * (1 + effectiveConfig.stopLossPercent / 100)
          : undefined;

        const takeProfit = effectiveConfig.useAlgorithmicLevels && setup.takeProfit
          ? setup.takeProfit
          : effectiveConfig.takeProfitPercent
          ? setup.direction === 'LONG'
            ? entryPrice * (1 + effectiveConfig.takeProfitPercent / 100)
            : entryPrice * (1 - effectiveConfig.takeProfitPercent / 100)
          : undefined;

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

        for (const futureKline of futureKlines) {
          barsInTrade++;
          const futureIndex = historicalKlines.findIndex(k => k.openTime === futureKline.openTime);
          const high = parseFloat(futureKline.high);
          const low = parseFloat(futureKline.low);
          const open = parseFloat(futureKline.open);
          const close = parseFloat(futureKline.close);

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

          const slHit = stopLoss && (
            (setup.direction === 'LONG' && low <= stopLoss) ||
            (setup.direction === 'SHORT' && high >= stopLoss)
          );
          const tpHit = takeProfit && (
            (setup.direction === 'LONG' && high >= takeProfit) ||
            (setup.direction === 'SHORT' && low <= takeProfit)
          );

          if (slHit && tpHit) {
            const isBullishCandle = close > open;
            if (setup.direction === 'LONG') {
              exitReason = isBullishCandle ? 'TAKE_PROFIT' : 'STOP_LOSS';
              exitPrice = isBullishCandle ? takeProfit : stopLoss;
            } else {
              exitReason = isBullishCandle ? 'STOP_LOSS' : 'TAKE_PROFIT';
              exitPrice = isBullishCandle ? stopLoss : takeProfit;
            }
            exitTime = new Date(futureKline.openTime).toISOString();
            break;
          } else if (slHit) {
            exitPrice = stopLoss;
            exitTime = new Date(futureKline.openTime).toISOString();
            exitReason = 'STOP_LOSS';
            break;
          } else if (tpHit) {
            exitPrice = takeProfit;
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

        // Track position exit time to prevent overlapping trades
        if (exitTime) {
          currentPositionExitTime = new Date(exitTime).getTime();
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
    }

    // Add extra buffer for indicator calculations (some need 2x the period)
    const warmupWithBuffer = Math.ceil(maxPeriod * 1.5);
    console.log(`[Backtest] Calculated warmup period: ${warmupWithBuffer} (max indicator period: ${maxPeriod})`);

    return warmupWithBuffer;
  }
}
