/**
 * Strategy Interpreter
 *
 * Main orchestrator that interprets JSON strategy definitions and produces
 * TradingSetup objects compatible with the existing BacktestEngine.
 * Extends BaseSetupDetector to integrate with SetupDetectionService.
 */

import type {
    ComputedIndicators,
    EvaluationContext,
    ExitContext, Kline, SetupDirection, StrategyDefinition
} from '@marketmind/types';

import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from '../BaseSetupDetector';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import { ConditionEvaluator } from './ConditionEvaluator';
import { EntryCalculator } from './EntryCalculator';
import { ExitCalculator } from './ExitCalculator';
import { IndicatorEngine } from './IndicatorEngine';

const { MIN_ENTRY_STOP_SEPARATION_PERCENT, DEFAULT_ENTRY_BUFFER_ATR } = EXIT_CALCULATOR;

/**
 * Configuration for StrategyInterpreter
 */
export interface StrategyInterpreterConfig extends SetupDetectorConfig {
  strategy: StrategyDefinition;
  parameterOverrides?: Record<string, number>;
}

/**
 * Interprets JSON strategy definitions and produces TradingSetup objects
 */
export class StrategyInterpreter extends BaseSetupDetector {
  private strategy: StrategyDefinition;
  private resolvedParams: Record<string, number>;
  private indicatorEngine: IndicatorEngine;
  private conditionEvaluator: ConditionEvaluator;
  private exitCalculator: ExitCalculator;
  private entryCalculator: EntryCalculator;

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
    this.entryCalculator = new EntryCalculator(this.indicatorEngine);
  }

  /**
   * Detect setups at the current kline index
   */
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

    const entryPriceConfig = this.strategy.entry.entryPrice ?? {
      type: 'swingHighLow' as const,
      lookback: 2,
      expirationBars: 3,
      buffer: DEFAULT_ENTRY_BUFFER_ATR,
      indicator: 'atr',
    };
    const entryCalcResult = this.entryCalculator.calculateEntryPrice(entryPriceConfig, baseExitContext);
    const entryPrice = entryCalcResult.orderType === 'LIMIT' ? entryCalcResult.price : closePrice;

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
      entryOrderType: entryCalcResult.orderType,
      limitEntryPrice: entryCalcResult.orderType === 'LIMIT' ? entryCalcResult.price : undefined,
      expirationBars: entryCalcResult.orderType === 'LIMIT' ? entryCalcResult.expirationBars : undefined,
    };

    const currentKline = klines[currentIndex];
    logger.info({
      setupId: setup.id,
      strategy: this.strategy.id,
      direction,
      symbol: currentKline ? `Candle at ${new Date(currentKline.openTime).toISOString()}` : 'Unknown',
      entryPrice: entryPrice.toFixed(4),
      entryOrderType: setup.entryOrderType,
      limitEntryPrice: setup.limitEntryPrice?.toFixed(4) ?? 'N/A',
      stopLoss: stopLoss?.toFixed(4) ?? 'None',
      takeProfit: takeProfit?.toFixed(4) ?? 'None',
      riskReward: riskReward.toFixed(2),
      confidence,
      volumeConfirmation,
      indicatorConfluence: indicatorConfluence.toFixed(2),
      resolvedParams: this.resolvedParams,
    }, '✅ Setup detected');

    return { setup, confidence };
  }

  /**
   * Check entry conditions for both long and short
   */
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

  /**
   * Check if setup passes strategy filters
   */
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

  /**
   * Calculate indicator confluence score
   */
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
        const values = indicator.values as Record<string, (number | null)[]>;
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

  /**
   * Check volume confirmation
   */
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

  /**
   * Resolve strategy parameters with defaults and overrides
   */
  private resolveParameters(
    overrides?: Record<string, number>
  ): Record<string, number> {
    const resolved: Record<string, number> = {};

    for (const [key, param] of Object.entries(this.strategy.parameters)) {
      if (overrides && overrides[key] !== undefined) {
        resolved[key] = overrides[key];
      } else {
        resolved[key] = param.default;
      }
    }

    return resolved;
  }

  /**
   * Get the strategy definition
   */
  getStrategy(): StrategyDefinition {
    return this.strategy;
  }

  /**
   * Get resolved parameters
   */
  getResolvedParams(): Record<string, number> {
    return { ...this.resolvedParams };
  }

  /**
   * Update parameters at runtime (for optimization)
   */
  updateParameters(params: Record<string, number>): void {
    for (const [key, value] of Object.entries(params)) {
      if (this.strategy.parameters[key] !== undefined) {
        this.resolvedParams[key] = value;
      }
    }
    this.indicatorEngine.clearCache();
  }

  /**
   * Get parameter optimization ranges
   */
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
