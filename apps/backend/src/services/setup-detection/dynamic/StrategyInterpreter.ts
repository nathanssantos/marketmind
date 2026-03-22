import type {
  ComputedIndicators,
  EvaluationContext,
  ExitContext,
  Kline,
  SetupDirection,
  StrategyDefinition,
  TimeInterval,
} from '@marketmind/types';

import {
  BaseSetupDetector,
  type SetupDetectorConfig,
  type SetupDetectorResult,
} from '../BaseSetupDetector';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import { isDirectionAllowed } from '../../../utils/trading-validation';
import { ConditionEvaluator } from './ConditionEvaluator';
import { ExitCalculator } from './ExitCalculator';
import {
  calculateFibonacciProjectionData,
  extractIndicatorValues,
  extractTriggerCandles,
  validateFibonacciEntryProgress,
} from './FibonacciHelper';
import { IndicatorEngine } from './IndicatorEngine';

const { MIN_ENTRY_STOP_SEPARATION_PERCENT, MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT } = EXIT_CALCULATOR;

export interface StrategyInterpreterConfig extends SetupDetectorConfig {
  strategy: StrategyDefinition;
  parameterOverrides?: Record<string, number>;
  silent?: boolean;
  maxFibonacciEntryProgressPercentLong?: number;
  maxFibonacciEntryProgressPercentShort?: number;
  fibonacciSwingRange?: 'extended' | 'nearest';
  initialStopMode?: 'fibo_target' | 'nearest_swing';
  interval?: TimeInterval;
  directionMode?: 'long_only' | 'short_only';
  indicatorEngine?: IndicatorEngine;
}

export class StrategyInterpreter extends BaseSetupDetector {
  private strategy: StrategyDefinition;
  private resolvedParams: Record<string, number>;
  private indicatorEngine: IndicatorEngine;
  private conditionEvaluator: ConditionEvaluator;
  private exitCalculator: ExitCalculator;
  private silent: boolean;
  private maxFibEntryProgressLong: number;
  private maxFibEntryProgressShort: number;
  private fibonacciSwingRange: 'extended' | 'nearest';
  private initialStopMode: 'fibo_target' | 'nearest_swing';
  private interval: TimeInterval | undefined;
  private directionMode: 'long_only' | 'short_only' | undefined;

  constructor(config: StrategyInterpreterConfig) {
    super({
      enabled: config.enabled,
      minConfidence: config.minConfidence,
      minRiskReward: config.minRiskReward,
    });

    this.strategy = config.strategy;
    this.resolvedParams = this.resolveParameters(config.parameterOverrides);
    this.indicatorEngine = config.indicatorEngine ?? new IndicatorEngine();
    this.conditionEvaluator = new ConditionEvaluator(this.indicatorEngine);
    this.exitCalculator = new ExitCalculator(this.indicatorEngine);
    this.silent = config.silent ?? false;
    this.maxFibEntryProgressLong = config.maxFibonacciEntryProgressPercentLong ?? MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT;
    this.maxFibEntryProgressShort = config.maxFibonacciEntryProgressPercentShort ?? MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT;
    this.fibonacciSwingRange = config.fibonacciSwingRange ?? 'nearest';
    this.initialStopMode = config.initialStopMode ?? 'fibo_target';
    this.interval = config.interval;
    this.directionMode = config.directionMode;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const indicators = this.indicatorEngine.computeIndicators(
      klines,
      this.strategy.indicators,
      this.resolvedParams
    );

    const evalContext: EvaluationContext = {
      klines,
      currentIndex,
      indicators,
      params: this.resolvedParams,
    };

    const { direction, triggered } = this.checkEntryConditions(evalContext);

    if (!triggered || !direction) {
      return { setup: null, confidence: 0 };
    }

    const closePrice = parseFloat(klines[currentIndex]?.close ?? '0');
    const entryPrice = closePrice;

    const fibonacciProjection = calculateFibonacciProjectionData(
      klines, currentIndex, direction, indicators,
      this.interval, this.fibonacciSwingRange, this.indicatorEngine, this.silent
    );

    const maxFibProgress = direction === 'LONG' ? this.maxFibEntryProgressLong : this.maxFibEntryProgressShort;
    const fibEntryValidation = validateFibonacciEntryProgress(entryPrice, fibonacciProjection, direction, maxFibProgress, this.silent);
    if (!fibEntryValidation.valid) {
      return {
        setup: null,
        confidence: 0,
        rejection: {
          reason: `Entry above max Fibonacci level (${maxFibProgress}%)`,
          details: {
            entryProgress: `${fibEntryValidation.progress.toFixed(1)}%`,
            maxAllowed: `${maxFibProgress}%`,
            direction,
          },
        },
      };
    }

    const exitContext: ExitContext = {
      direction,
      entryPrice,
      klines,
      currentIndex,
      indicators,
      params: this.resolvedParams,
      fibonacciSwing: fibonacciProjection
        ? {
            swingLow: { price: fibonacciProjection.swingLow.price, index: fibonacciProjection.swingLow.index },
            swingHigh: { price: fibonacciProjection.swingHigh.price, index: fibonacciProjection.swingHigh.index },
          }
        : undefined,
      initialStopMode: this.initialStopMode,
    };

    const stopLoss = this.strategy.exit.stopLoss
      ? this.exitCalculator.calculateStopLoss(this.strategy.exit.stopLoss, exitContext)
      : null;

    if (stopLoss !== null) {
      const entryStopSeparation = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
      if (entryStopSeparation < MIN_ENTRY_STOP_SEPARATION_PERCENT) {
        if (!this.silent) {
          logger.warn({
            strategy: this.strategy.id,
            direction,
            entryPrice: entryPrice.toFixed(4),
            stopLoss: stopLoss.toFixed(4),
            separationPercent: entryStopSeparation.toFixed(3),
            minRequired: MIN_ENTRY_STOP_SEPARATION_PERCENT,
          }, '! Entry and stop are too close - setup rejected');
        }
        return {
          setup: null,
          confidence: 0,
          rejection: {
            reason: 'Entry and stop too close',
            details: {
              separation: `${entryStopSeparation.toFixed(3)}%`,
              minRequired: `${MIN_ENTRY_STOP_SEPARATION_PERCENT}%`,
              direction,
            },
          },
        };
      }
    }

    const takeProfit = this.strategy.exit.takeProfit
      ? this.exitCalculator.calculateTakeProfit(this.strategy.exit.takeProfit, exitContext, stopLoss ?? 0)
      : null;

    const confidence = this.exitCalculator.calculateConfidence(
      this.strategy,
      exitContext
    );

    const riskReward = this.exitCalculator.calculateRiskReward(
      entryPrice,
      stopLoss,
      takeProfit,
      direction
    );

    const hasIndicatorBasedExit = !!this.strategy.exit.conditions;
    const effectiveRiskReward = hasIndicatorBasedExit ? this.config.minRiskReward : riskReward;
    const requirementsCheck = this.checkMinimumRequirements(confidence, effectiveRiskReward);
    if (!requirementsCheck.passed) {
      return {
        setup: null,
        confidence,
        rejection: {
          reason: requirementsCheck.reason,
          details: requirementsCheck.details,
        },
      };
    }

    const filtersCheck = this.checkStrategyFilters(confidence, riskReward, hasIndicatorBasedExit);
    if (!filtersCheck.passed) {
      return {
        setup: null,
        confidence,
        rejection: {
          reason: filtersCheck.reason,
          details: filtersCheck.details,
        },
      };
    }

    const indicatorConfluence = this.calculateIndicatorConfluence(indicators, currentIndex);
    const volumeConfirmation = this.checkVolumeConfirmation(indicators, currentIndex);

    const baseSetup = this.createSetup(
      this.strategy.id,
      direction,
      klines,
      currentIndex,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      indicatorConfluence,
      {
        strategyId: this.strategy.id,
        strategyVersion: this.strategy.version,
        strategyName: this.strategy.name,
        resolvedParams: this.resolvedParams,
      }
    );

    const setup = {
      ...baseSetup,
      entryOrderType: 'MARKET' as const,
      fibonacciProjection,
    };

    const currentKline = klines[currentIndex];
    if (!this.silent) {
      logger.info({
        setupId: setup.id,
        strategy: this.strategy.id,
        direction,
        symbol: currentKline ? `Candle at ${new Date(currentKline.openTime).toISOString()}` : 'Unknown',
        entryPrice: entryPrice.toFixed(4),
        entryOrderType: setup.entryOrderType,
        stopLoss: stopLoss?.toFixed(4) ?? 'None',
        takeProfit: takeProfit?.toFixed(4) ?? 'None',
        riskReward: riskReward.toFixed(2),
        confidence,
        volumeConfirmation,
        indicatorConfluence: indicatorConfluence.toFixed(2),
        hasFibonacciProjection: !!fibonacciProjection,
        resolvedParams: this.resolvedParams,
      }, '✓ Setup detected');
    }

    const lookback = this.strategy.education?.candlePattern?.lookback ?? 3;
    const triggerCandleData = extractTriggerCandles(klines, currentIndex, lookback);
    const triggerIndicatorValues = extractIndicatorValues(indicators, currentIndex);

    return {
      setup,
      confidence,
      triggerKlineIndex: currentIndex,
      triggerCandleData,
      triggerIndicatorValues,
    };
  }

  private checkEntryConditions(context: EvaluationContext): {
    direction: SetupDirection | null;
    triggered: boolean;
  } {
    const { entry } = this.strategy;

    if (isDirectionAllowed(this.directionMode, 'LONG') && entry.long) {
      const longTriggered = this.conditionEvaluator.evaluate(entry.long, context);
      if (longTriggered) return { direction: 'LONG', triggered: true };
    }

    if (isDirectionAllowed(this.directionMode, 'SHORT') && entry.short) {
      const shortTriggered = this.conditionEvaluator.evaluate(entry.short, context);
      if (shortTriggered) return { direction: 'SHORT', triggered: true };
    }

    return { direction: null, triggered: false };
  }

  private calculateIndicatorConfluence(
    indicators: ComputedIndicators,
    currentIndex: number
  ): number {
    let confluence = 0;
    let count = 0;

    for (const [id, indicator] of Object.entries(indicators)) {
      if (id.startsWith('_')) continue;

      if (Array.isArray(indicator.values)) {
        if (indicator.values[currentIndex] !== null) {
          confluence += 1;
          count += 1;
        }
      } else {
        const values = indicator.values;
        const hasValue = Object.values(values).some(
          (arr) => arr[currentIndex] !== null
        );
        if (hasValue) {
          confluence += 1;
          count += 1;
        }
      }
    }

    return count > 0 ? Math.min((confluence / count) * 2, 2) : 0;
  }

  private checkVolumeConfirmation(
    indicators: ComputedIndicators,
    currentIndex: number
  ): boolean {
    const volumeCurrent = this.indicatorEngine.resolveIndicatorValue(
      indicators, 'volume.current', currentIndex
    );
    const volumeSma20 = this.indicatorEngine.resolveIndicatorValue(
      indicators, 'volume.sma20', currentIndex
    );

    if (volumeCurrent === null || volumeSma20 === null) return false;
    return volumeCurrent > volumeSma20;
  }

  private resolveParameters(
    overrides?: Record<string, number>
  ): Record<string, number> {
    const resolved: Record<string, number> = {};

    for (const [key, param] of Object.entries(this.strategy.parameters)) {
      if (overrides?.[key] !== undefined) {
        resolved[key] = overrides[key];
      } else {
        resolved[key] = param.default;
      }
    }

    return resolved;
  }

  getStrategy(): StrategyDefinition {
    return this.strategy;
  }

  getResolvedParams(): Record<string, number> {
    return { ...this.resolvedParams };
  }

  updateParameters(params: Record<string, number>): void {
    for (const [key, value] of Object.entries(params)) {
      if (this.strategy.parameters[key] !== undefined) {
        this.resolvedParams[key] = value;
      }
    }
    this.indicatorEngine.clearCache();
  }

  getParameterRanges(): Record<
    string,
    { min: number; max: number; step: number; default: number }
  > {
    const ranges: Record<
      string,
      { min: number; max: number; step: number; default: number }
    > = {};

    for (const [key, param] of Object.entries(this.strategy.parameters)) {
      ranges[key] = {
        min: param.min ?? param.default * 0.5,
        max: param.max ?? param.default * 2,
        step: param.step ?? 1,
        default: param.default,
      };
    }

    return ranges;
  }

  private checkMinimumRequirements(
    confidence: number,
    riskReward: number
  ): { passed: boolean; reason: string; details: Record<string, string | number> } {
    if (confidence < this.config.minConfidence) {
      return {
        passed: false,
        reason: 'Confidence below minimum',
        details: {
          confidence,
          minRequired: this.config.minConfidence,
        },
      };
    }

    if (riskReward < this.config.minRiskReward) {
      return {
        passed: false,
        reason: 'Risk/reward below minimum',
        details: {
          riskReward: parseFloat(riskReward.toFixed(2)),
          minRequired: this.config.minRiskReward,
        },
      };
    }

    return { passed: true, reason: '', details: {} };
  }

  private checkStrategyFilters(
    confidence: number,
    riskReward: number,
    hasIndicatorBasedExit: boolean
  ): { passed: boolean; reason: string; details: Record<string, string | number> } {
    const { filters, exit } = this.strategy;

    if (!filters) {
      return { passed: true, reason: '', details: {} };
    }

    if (filters.minConfidence && confidence < filters.minConfidence) {
      return {
        passed: false,
        reason: 'Strategy filter: confidence below minimum',
        details: {
          confidence,
          strategyMinConfidence: filters.minConfidence,
        },
      };
    }

    const hasExitConditions = !!exit.conditions || hasIndicatorBasedExit;
    if (filters.minRiskReward && riskReward < filters.minRiskReward && !hasExitConditions) {
      return {
        passed: false,
        reason: 'Strategy filter: risk/reward below minimum',
        details: {
          riskReward: parseFloat(riskReward.toFixed(2)),
          strategyMinRiskReward: filters.minRiskReward,
        },
      };
    }

    return { passed: true, reason: '', details: {} };
  }
}
