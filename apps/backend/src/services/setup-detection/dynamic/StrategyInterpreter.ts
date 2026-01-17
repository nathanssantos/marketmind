import { calculateFibonacciProjection, selectDynamicFibonacciLevel } from '@marketmind/indicators';
import type {
  ComputedIndicators,
  EvaluationContext,
  ExitContext,
  FibonacciProjectionData,
  Kline,
  SetupDirection,
  StrategyDefinition,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';

import {
  BaseSetupDetector,
  type SetupDetectorConfig,
  type SetupDetectorResult,
} from '../BaseSetupDetector';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import { ConditionEvaluator } from './ConditionEvaluator';
import { ExitCalculator } from './ExitCalculator';
import { IndicatorEngine } from './IndicatorEngine';

const FIBONACCI_LOOKBACK = 100;
const DEFAULT_FIBONACCI_LEVEL = 1.618;

const { MIN_ENTRY_STOP_SEPARATION_PERCENT, MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT } = EXIT_CALCULATOR;

export interface StrategyInterpreterConfig extends SetupDetectorConfig {
  strategy: StrategyDefinition;
  parameterOverrides?: Record<string, number>;
  silent?: boolean;
  maxFibonacciEntryProgressPercent?: number;
}

export class StrategyInterpreter extends BaseSetupDetector {
  private strategy: StrategyDefinition;
  private resolvedParams: Record<string, number>;
  private indicatorEngine: IndicatorEngine;
  private conditionEvaluator: ConditionEvaluator;
  private exitCalculator: ExitCalculator;
  private silent: boolean;
  private maxFibEntryProgress: number;

  constructor(config: StrategyInterpreterConfig) {
    super({
      enabled: config.enabled,
      minConfidence: config.minConfidence,
      minRiskReward: config.minRiskReward,
    });

    this.strategy = config.strategy;
    this.resolvedParams = this.resolveParameters(config.parameterOverrides);
    this.indicatorEngine = new IndicatorEngine();
    this.conditionEvaluator = new ConditionEvaluator(this.indicatorEngine);
    this.exitCalculator = new ExitCalculator(this.indicatorEngine);
    this.silent = config.silent ?? false;
    this.maxFibEntryProgress = config.maxFibonacciEntryProgressPercent ?? MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT;
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

    const fibonacciProjection = this.calculateFibonacciProjectionData(klines, currentIndex, direction, indicators);

    const fibEntryValidation = this.validateFibonacciEntryProgress(entryPrice, fibonacciProjection, direction);
    if (!fibEntryValidation.valid) {
      return {
        setup: null,
        confidence: 0,
        rejection: {
          reason: `Entry above max Fibonacci level (${this.maxFibEntryProgress}%)`,
          details: {
            entryProgress: `${fibEntryValidation.progress.toFixed(1)}%`,
            maxAllowed: `${this.maxFibEntryProgress}%`,
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
          }, '⚠️ Entry and stop are too close - setup rejected');
        }
        return { setup: null, confidence: 0 };
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
    if (!this.meetsMinimumRequirements(confidence, effectiveRiskReward)) {
      return { setup: null, confidence };
    }

    if (!this.passesFilters(confidence, riskReward)) {
      return { setup: null, confidence };
    }

    const indicatorConfluence = this.calculateIndicatorConfluence(
      indicators,
      currentIndex
    );

    const volumeConfirmation = this.checkVolumeConfirmation(
      indicators,
      currentIndex
    );

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
      }, '✅ Setup detected');
    }

    const triggerCandleData = this.extractTriggerCandles(klines, currentIndex);
    const triggerIndicatorValues = this.extractIndicatorValues(indicators, currentIndex);

    return {
      setup,
      confidence,
      triggerKlineIndex: currentIndex,
      triggerCandleData,
      triggerIndicatorValues,
    };
  }

  private calculateFibonacciProjectionData(
    klines: Kline[],
    currentIndex: number,
    direction: SetupDirection,
    indicators: ComputedIndicators
  ): FibonacciProjectionData | undefined {
    const projection = calculateFibonacciProjection(klines, currentIndex, FIBONACCI_LOOKBACK, direction);
    if (!projection) return undefined;

    const primaryLevel = this.selectPrimaryFibonacciLevel(klines, currentIndex, indicators);

    return {
      swingLow: {
        price: projection.swingLow.price,
        index: projection.swingLow.index,
        timestamp: projection.swingLow.timestamp,
      },
      swingHigh: {
        price: projection.swingHigh.price,
        index: projection.swingHigh.index,
        timestamp: projection.swingHigh.timestamp,
      },
      levels: projection.levels.map(l => ({
        level: l.level,
        price: l.price,
        label: l.label,
      })),
      range: projection.range,
      primaryLevel,
    };
  }

  private selectPrimaryFibonacciLevel(
    klines: Kline[],
    currentIndex: number,
    indicators: ComputedIndicators
  ): number {
    const adxValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'adx', currentIndex);
    const atrValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex);

    if (adxValue === null || atrValue === null) {
      if (!this.silent) {
        logger.debug({ adxValue, atrValue }, 'Missing ADX or ATR for dynamic Fibonacci level selection, using default');
      }
      return DEFAULT_FIBONACCI_LEVEL;
    }

    const currentKline = klines[currentIndex];
    const closePrice = currentKline ? parseFloat(currentKline.close) : 0;
    const atrPercent = closePrice > 0 ? (atrValue / closePrice) * 100 : 0;

    let volumeRatio: number | undefined;
    const currentVolume = currentKline ? parseFloat(currentKline.volume) : 0;
    if (currentVolume > 0 && currentIndex >= 20) {
      let avgVolume = 0;
      for (let i = currentIndex - 20; i < currentIndex; i++) {
        const k = klines[i];
        if (k) avgVolume += parseFloat(k.volume);
      }
      avgVolume /= 20;
      volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : undefined;
    }

    const result = selectDynamicFibonacciLevel({ adx: adxValue, atrPercent, volumeRatio });

    if (!this.silent) {
      logger.debug({
        adx: adxValue.toFixed(2),
        atrPercent: atrPercent.toFixed(2),
        volumeRatio: volumeRatio?.toFixed(2) ?? 'N/A',
        selectedLevel: result.level,
        reason: result.reason,
      }, 'Dynamic Fibonacci level selected');
    }

    return result.level;
  }

  private extractTriggerCandles(
    klines: Kline[],
    currentIndex: number
  ): TriggerCandleSnapshot[] {
    const lookback = this.strategy.education?.candlePattern?.lookback ?? 3;
    const snapshots: TriggerCandleSnapshot[] = [];

    for (let offset = -(lookback - 1); offset <= 0; offset++) {
      const idx = currentIndex + offset;
      if (idx < 0 || idx >= klines.length) continue;

      const kline = klines[idx];
      if (!kline) continue;

      snapshots.push({
        offset,
        openTime: kline.openTime,
        open: typeof kline.open === 'string' ? parseFloat(kline.open) : kline.open,
        high: typeof kline.high === 'string' ? parseFloat(kline.high) : kline.high,
        low: typeof kline.low === 'string' ? parseFloat(kline.low) : kline.low,
        close: typeof kline.close === 'string' ? parseFloat(kline.close) : kline.close,
        volume: typeof kline.volume === 'string' ? parseFloat(kline.volume) : kline.volume,
      });
    }

    return snapshots;
  }

  private extractIndicatorValues(
    indicators: ComputedIndicators,
    currentIndex: number
  ): TriggerIndicatorValues {
    const values: TriggerIndicatorValues = {};

    for (const [id, indicator] of Object.entries(indicators)) {
      if (id.startsWith('_')) continue;

      if (Array.isArray(indicator.values)) {
        const current = indicator.values[currentIndex];
        const prev = currentIndex > 0 ? indicator.values[currentIndex - 1] : null;
        const prev2 = currentIndex > 1 ? indicator.values[currentIndex - 2] : null;

        if (current !== null && current !== undefined) {
          values[id] = current;
        }
        if (prev !== null && prev !== undefined) {
          values[`${id}Prev`] = prev;
        }
        if (prev2 !== null && prev2 !== undefined) {
          values[`${id}Prev2`] = prev2;
        }
      } else {
        const subValues = indicator.values;
        for (const [subKey, arr] of Object.entries(subValues)) {
          const current = arr[currentIndex];
          const prev = currentIndex > 0 ? arr[currentIndex - 1] : null;

          if (current !== null && current !== undefined) {
            values[`${id}.${subKey}`] = current;
          }
          if (prev !== null && prev !== undefined) {
            values[`${id}.${subKey}Prev`] = prev;
          }
        }
      }
    }

    return values;
  }

  private checkEntryConditions(context: EvaluationContext): {
    direction: SetupDirection | null;
    triggered: boolean;
  } {
    const { entry } = this.strategy;

    if (entry.long) {
      const longTriggered = this.conditionEvaluator.evaluate(entry.long, context);
      if (longTriggered) {
        return { direction: 'LONG', triggered: true };
      }
    }

    if (entry.short) {
      const shortTriggered = this.conditionEvaluator.evaluate(entry.short, context);
      if (shortTriggered) {
        return { direction: 'SHORT', triggered: true };
      }
    }

    return { direction: null, triggered: false };
  }

  private passesFilters(confidence: number, riskReward: number): boolean {
    const { filters, exit } = this.strategy;

    if (!filters) {
      return true;
    }

    if (filters.minConfidence && confidence < filters.minConfidence) {
      return false;
    }

    const hasIndicatorBasedExit = !!exit.conditions;
    if (filters.minRiskReward && riskReward < filters.minRiskReward && !hasIndicatorBasedExit) {
      return false;
    }

    return true;
  }

  private calculateIndicatorConfluence(
    indicators: ComputedIndicators,
    currentIndex: number
  ): number {
    let confluence = 0;
    let count = 0;

    for (const [id, indicator] of Object.entries(indicators)) {
      if (id.startsWith('_')) continue; // Skip internal indicators

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
      indicators,
      'volume.current',
      currentIndex
    );
    const volumeSma20 = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      'volume.sma20',
      currentIndex
    );

    if (volumeCurrent === null || volumeSma20 === null) {
      return false;
    }

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

  private validateFibonacciEntryProgress(
    entryPrice: number,
    fibonacciProjection: FibonacciProjectionData | undefined,
    direction: SetupDirection
  ): { valid: boolean; progress: number; reason?: string } {
    if (!fibonacciProjection) {
      return { valid: true, progress: 0 };
    }

    const { swingLow, swingHigh } = fibonacciProjection;
    const swingRange = swingHigh.price - swingLow.price;

    if (swingRange <= 0) {
      return { valid: true, progress: 0, reason: 'invalid_swing_range' };
    }

    const progress = direction === 'LONG'
      ? ((entryPrice - swingLow.price) / swingRange) * 100
      : ((swingHigh.price - entryPrice) / swingRange) * 100;

    const isValid = progress <= this.maxFibEntryProgress;

    if (!isValid && !this.silent) {
      logger.warn({
        direction,
        entryPrice: entryPrice.toFixed(4),
        swingLow: swingLow.price.toFixed(4),
        swingHigh: swingHigh.price.toFixed(4),
        fibLevel: `${progress.toFixed(1)}%`,
        maxAllowed: `${this.maxFibEntryProgress}%`,
      }, '⚠️ Entry price above max Fibonacci level - setup rejected');
    }

    return {
      valid: isValid,
      progress,
      reason: isValid ? undefined : 'entry_above_max_fib_level',
    };
  }
}
