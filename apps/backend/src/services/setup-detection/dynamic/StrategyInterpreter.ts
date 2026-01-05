import type {
  ComputedIndicators,
  EvaluationContext,
  ExitContext,
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

const { MIN_ENTRY_STOP_SEPARATION_PERCENT } = EXIT_CALCULATOR;

export interface StrategyInterpreterConfig extends SetupDetectorConfig {
  strategy: StrategyDefinition;
  parameterOverrides?: Record<string, number>;
}

export class StrategyInterpreter extends BaseSetupDetector {
  private strategy: StrategyDefinition;
  private resolvedParams: Record<string, number>;
  private indicatorEngine: IndicatorEngine;
  private conditionEvaluator: ConditionEvaluator;
  private exitCalculator: ExitCalculator;

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

    const baseExitContext: ExitContext = {
      direction,
      entryPrice: closePrice,
      klines,
      currentIndex,
      indicators,
      params: this.resolvedParams,
    };

    const entryPrice = closePrice;

    const exitContext: ExitContext = {
      ...baseExitContext,
      entryPrice,
    };

    const stopLoss = this.strategy.exit.stopLoss
      ? this.exitCalculator.calculateStopLoss(this.strategy.exit.stopLoss, exitContext)
      : null;

    if (stopLoss !== null) {
      const entryStopSeparation = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
      if (entryStopSeparation < MIN_ENTRY_STOP_SEPARATION_PERCENT) {
        logger.warn({
          strategy: this.strategy.id,
          direction,
          entryPrice: entryPrice.toFixed(4),
          stopLoss: stopLoss.toFixed(4),
          separationPercent: entryStopSeparation.toFixed(3),
          minRequired: MIN_ENTRY_STOP_SEPARATION_PERCENT,
        }, '⚠️ Entry and stop are too close - setup rejected');
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
    };

    const currentKline = klines[currentIndex];
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
      resolvedParams: this.resolvedParams,
    }, '✅ Setup detected');

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
        const subValues = indicator.values as Record<string, (number | null)[]>;
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
}
