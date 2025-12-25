import type {
  Condition,
  ConditionOperand,
  ExitContext,
  ExitLevel,
  Kline,
  PivotStrengthFilter,
  StrategyDefinition,
} from '@marketmind/types';
import { isParameterReference } from '@marketmind/types';
import {
  findNearestPivotStop,
  findNearestPivotTarget,
  type EnhancedPivotPoint,
  type PivotDetectionConfig,
  type PivotStrength,
} from '@marketmind/indicators';

import { EXIT_CALCULATOR, FLOAT_COMPARISON } from '../../../constants';
import { logger } from '../../logger';
import { calculateATRPercent, getVolatilityAdjustedMultiplier, getVolatilityProfile } from '../../volatility-profile';
import type { IndicatorEngine } from './IndicatorEngine';

const {
  DEFAULT_MULTIPLIER,
  DEFAULT_PERCENTAGE,
  DEFAULT_DISTANCE_PERCENT,
  DEFAULT_SWING_BUFFER_PERCENT,
  MIN_SWING_BUFFER_ATR,
  SWING_SKIP_RECENT,
  MIN_ENTRY_STOP_SEPARATION_PERCENT,
  BASE_CONFIDENCE,
  VOLUME_CONFIRMATION_BONUS,
  MAX_CONFIDENCE,
  DEFAULT_MAX_CONFIDENCE,
} = EXIT_CALCULATOR;

const { EPSILON } = FLOAT_COMPARISON;

export class ExitCalculator {
  private indicatorEngine: IndicatorEngine;

  constructor(indicatorEngine: IndicatorEngine) {
    this.indicatorEngine = indicatorEngine;
  }

  calculateStopLoss(exit: ExitLevel, context: ExitContext): number {
    const { direction, entryPrice, indicators, currentIndex } = context;

    let stopLoss: number;

    if (exit.type === 'swingHighLow') {
      stopLoss = this.calculateSwingHighLowStop(exit, context);
    } else if (exit.type === 'pivotBased') {
      stopLoss = this.calculatePivotBasedStop(exit, context);
    } else {
      const distance = this.calculateExitDistance(exit, context);

      if (distance < 0) {
        logger.warn({
          direction,
          entryPrice,
          distance,
          exitType: exit.type,
        }, '⚠️  Negative distance for stop loss - using absolute value');
        throw new Error(`Invalid negative distance (${distance}) for stop loss calculation`);
      }

      stopLoss = direction === 'LONG'
        ? entryPrice - distance
        : entryPrice + distance;
    }

    const atrValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;
    const atrPercent = atrValue > 0 && entryPrice > 0 ? calculateATRPercent(atrValue, entryPrice) : 0;
    const volatilityProfile = getVolatilityProfile(atrPercent);
    const minStopPercent = volatilityProfile.breakevenThreshold * 100;
    const minDistance = entryPrice * volatilityProfile.breakevenThreshold;
    const currentDistance = Math.abs(entryPrice - stopLoss);

    if (currentDistance < minDistance) {
      const adjustedStopLoss = direction === 'LONG'
        ? entryPrice - minDistance
        : entryPrice + minDistance;

      logger.info({
        direction,
        entryPrice: entryPrice.toFixed(4),
        originalStop: stopLoss.toFixed(4),
        adjustedStop: adjustedStopLoss.toFixed(4),
        originalDistance: `${((currentDistance / entryPrice) * 100).toFixed(2)}%`,
        volatilityLevel: volatilityProfile.level,
        atrPercent: atrPercent.toFixed(2),
        minDistance: `${minStopPercent.toFixed(2)}%`,
      }, '⚠️ Stop too tight - enforcing volatility-based minimum (same as trailing breakeven)');

      stopLoss = adjustedStopLoss;
    }

    const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLoss.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID STOP LOSS - SL must be below entry for LONG and above entry for SHORT');
      throw new Error(`Invalid stop loss: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
    }

    logger.debug({
      type: 'stopLoss',
      exitType: exit.type,
      direction,
      entryPrice: entryPrice.toFixed(4),
      stopLoss: stopLoss.toFixed(4),
      percentFromEntry: `${(((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
      note: 'Initial SL - trailing stop may adjust this later',
    }, 'Stop loss calculated');

    return stopLoss;
  }

  calculateTakeProfit(
    exit: ExitLevel,
    context: ExitContext,
    stopLossPrice?: number
  ): number {
    const { direction, entryPrice } = context;

    if (exit.type === 'riskReward' && stopLossPrice !== undefined) {
      const slDistance = Math.abs(entryPrice - stopLossPrice);
      const multiplier = this.resolveOperand(exit.multiplier ?? DEFAULT_MULTIPLIER, context);
      const tpDistance = slDistance * multiplier;

      const takeProfit = direction === 'LONG' 
        ? entryPrice + tpDistance 
        : entryPrice - tpDistance;

      logger.debug({
        type: 'takeProfit',
        exitType: 'riskReward',
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLossPrice.toFixed(4),
        slDistance: slDistance.toFixed(4),
        multiplier: multiplier.toFixed(2),
        tpDistance: tpDistance.toFixed(4),
        takeProfit: takeProfit.toFixed(4),
        riskReward: `${multiplier.toFixed(2)  }:1`,
      }, 'Take profit calculated (R:R)');

      return takeProfit;
    }

    if (exit.type === 'indicator') {
      const target = this.resolveIndicatorTarget(exit, context);
      if (target !== null) {
        const isValid = direction === 'LONG' ? target > entryPrice : target < entryPrice;
        if (!isValid) {
          logger.warn({
            direction,
            entryPrice: entryPrice.toFixed(4),
            indicatorTarget: target.toFixed(4),
            exitType: exit.type,
          }, '⚠️ Indicator-based TP is in loss zone - using fallback or throwing');
          if (exit.fallback) {
            logger.info('Using fallback TP calculation');
            return this.calculateTakeProfit(exit.fallback, context, stopLossPrice);
          }
          throw new Error(`Invalid take profit from indicator: ${direction} TP ${target.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
        }
        return target;
      }
    }

    if (exit.type === 'pivotBased') {
      return this.calculatePivotBasedTarget(exit, context, stopLossPrice);
    }

    const distance = this.calculateExitDistance(exit, context);
    const takeProfit = direction === 'LONG' 
      ? entryPrice + distance 
      : entryPrice - distance;

    const isValid = direction === 'LONG' ? takeProfit > entryPrice : takeProfit < entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        takeProfit: takeProfit.toFixed(4),
        distance: distance.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID TAKE PROFIT - TP must be above entry for LONG and below entry for SHORT');
      throw new Error(`Invalid take profit: ${direction} TP ${takeProfit.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
    }

    return takeProfit;
  }

  private calculateExitDistance(exit: ExitLevel, context: ExitContext): number {
    const { entryPrice } = context;

    switch (exit.type) {
      case 'atr': {
        const atrValue = this.getATRValue(exit, context);
        const baseMultiplier = this.resolveOperand(exit.multiplier ?? DEFAULT_MULTIPLIER, context);

        let adjustedMultiplier = baseMultiplier;
        if (atrValue > 0 && entryPrice > 0) {
          const atrPercent = calculateATRPercent(atrValue, entryPrice);
          adjustedMultiplier = getVolatilityAdjustedMultiplier(baseMultiplier, atrPercent);

          if (adjustedMultiplier !== baseMultiplier) {
            logger.debug({
              exitType: 'atr',
              atrValue: atrValue.toFixed(6),
              entryPrice: entryPrice.toFixed(4),
              atrPercent: atrPercent.toFixed(2),
              baseMultiplier,
              adjustedMultiplier: adjustedMultiplier.toFixed(2),
            }, 'Volatility-adjusted ATR multiplier for exit distance');
          }
        }

        return atrValue * adjustedMultiplier;
      }

      case 'percent': {
        const percent = this.resolveOperand(exit.value ?? DEFAULT_PERCENTAGE, context);
        return entryPrice * (percent / 100);
      }

      case 'fixed': {
        return this.resolveOperand(exit.value ?? 0, context);
      }

      case 'indicator': {
        const target = this.resolveIndicatorTarget(exit, context);
        if (target !== null) {
          return Math.abs(target - entryPrice);
        }
        if (exit.fallback) {
          return this.calculateExitDistance(exit.fallback, context);
        }
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
      }

      case 'riskReward': {
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
      }

      default:
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
    }
  }

  private getATRValue(exit: ExitLevel, context: ExitContext): number {
    const { indicators, currentIndex } = context;
    const indicatorRef = exit.indicator ?? 'atr';

    const value = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      indicatorRef,
      currentIndex
    );

    return value ?? 0;
  }

  private calculateSwingHighLowStop(exit: ExitLevel, context: ExitContext): number {
    const { direction, entryPrice, klines, currentIndex, indicators } = context;

    if (klines.length === 0 || currentIndex < 2) {
      throw new Error('Insufficient klines for swing high/low calculation');
    }

    const rawSwingPrice = direction === 'SHORT'
      ? this.findSwingHigh(klines as Kline[], currentIndex, SWING_SKIP_RECENT)
      : this.findSwingLow(klines as Kline[], currentIndex, SWING_SKIP_RECENT);

    let stopLoss = rawSwingPrice;

    let bufferApplied = false;
    const atrValue = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      'atr',
      currentIndex
    ) ?? 0;

    const atrPercent = atrValue > 0 && entryPrice > 0 ? calculateATRPercent(atrValue, entryPrice) : 0;

    if (exit.buffer !== undefined) {
      const bufferValue = this.resolveOperand(exit.buffer, context);
      if (exit.indicator === 'atr') {
        const effectiveBuffer = Math.max(bufferValue, MIN_SWING_BUFFER_ATR);
        const adjustedBuffer = atrPercent > 0
          ? getVolatilityAdjustedMultiplier(effectiveBuffer, atrPercent)
          : effectiveBuffer;
        const bufferAmount = atrValue * adjustedBuffer;
        stopLoss = direction === 'SHORT' ? stopLoss + bufferAmount : stopLoss - bufferAmount;
        bufferApplied = true;

        if (adjustedBuffer !== effectiveBuffer) {
          logger.debug({
            direction,
            requestedBuffer: bufferValue,
            baseBuffer: effectiveBuffer,
            adjustedBuffer: adjustedBuffer.toFixed(3),
            atrPercent: atrPercent.toFixed(2),
          }, 'Volatility-adjusted ATR buffer for swing stop');
        } else if (bufferValue < MIN_SWING_BUFFER_ATR) {
          logger.debug({
            direction,
            requestedBuffer: bufferValue,
            appliedBuffer: effectiveBuffer,
            minBuffer: MIN_SWING_BUFFER_ATR,
          }, 'Buffer increased to minimum ATR buffer');
        }
      } else {
        const bufferAmount = entryPrice * (bufferValue / 100);
        stopLoss = direction === 'SHORT' ? stopLoss + bufferAmount : stopLoss - bufferAmount;
        bufferApplied = true;
      }
    }

    if (!bufferApplied) {
      const baseMinAtrBuffer = MIN_SWING_BUFFER_ATR;
      const adjustedMinAtrBuffer = atrPercent > 0
        ? getVolatilityAdjustedMultiplier(baseMinAtrBuffer, atrPercent)
        : baseMinAtrBuffer;
      const minAtrBuffer = atrValue * adjustedMinAtrBuffer;
      const defaultPercentBuffer = stopLoss * (DEFAULT_SWING_BUFFER_PERCENT / 100);
      const defaultBufferAmount = Math.max(minAtrBuffer, defaultPercentBuffer);
      stopLoss = direction === 'SHORT' ? stopLoss + defaultBufferAmount : stopLoss - defaultBufferAmount;
      logger.debug({
        direction,
        defaultBufferPercent: DEFAULT_SWING_BUFFER_PERCENT,
        minAtrBuffer: minAtrBuffer.toFixed(4),
        adjustedAtrMultiplier: adjustedMinAtrBuffer.toFixed(3),
        bufferAmount: defaultBufferAmount.toFixed(4),
      }, 'Applied default swing buffer (max of ATR and percent)');
    }

    const isOnWrongSide = direction === 'LONG' ? stopLoss >= entryPrice : stopLoss <= entryPrice;
    const separationPercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
    let usedFallback = false;

    if (isOnWrongSide || separationPercent < MIN_ENTRY_STOP_SEPARATION_PERCENT) {
      const minDistance = entryPrice * (MIN_ENTRY_STOP_SEPARATION_PERCENT / 100);
      const atrFallback = atrValue * 1.5;
      const fallbackDistance = Math.max(minDistance, atrFallback);

      stopLoss = direction === 'LONG'
        ? entryPrice - fallbackDistance
        : entryPrice + fallbackDistance;
      usedFallback = true;

      logger.debug({
        direction,
        originalStopLoss: rawSwingPrice.toFixed(4),
        wasOnWrongSide: isOnWrongSide,
        originalSeparation: `${separationPercent.toFixed(3)}%`,
        minRequired: `${MIN_ENTRY_STOP_SEPARATION_PERCENT}%`,
        fallbackDistance: fallbackDistance.toFixed(4),
        newStopLoss: stopLoss.toFixed(4),
      }, 'Swing stop invalid or too close - applied ATR-based fallback');
    }

    const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLoss.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID SWING HIGH/LOW STOP - SL must be below entry for LONG and above entry for SHORT');
      throw new Error(`Invalid swing high/low stop loss: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
    }

    const finalSeparation = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
    const maxLookback = Math.min(50, currentIndex);

    logger.debug({
      type: 'stopLoss',
      exitType: 'swingHighLow',
      direction,
      entryPrice: entryPrice.toFixed(4),
      rawSwingPrice: rawSwingPrice.toFixed(4),
      stopLoss: stopLoss.toFixed(4),
      maxCandlesConsidered: maxLookback,
      skipRecent: SWING_SKIP_RECENT,
      percentFromEntry: `${finalSeparation.toFixed(2)}%`,
      bufferApplied: bufferApplied ? 'custom' : 'default',
      usedFallback,
    }, 'Swing high/low stop loss calculated');

    return stopLoss;
  }

  private resolveIndicatorTarget(
    exit: ExitLevel,
    context: ExitContext
  ): number | null {
    const { indicators, currentIndex } = context;

    const indicatorRef = exit.value ?? exit.indicator;

    if (indicatorRef === undefined) {
      return null;
    }

    if (typeof indicatorRef === 'number') {
      return indicatorRef;
    }

    if (typeof indicatorRef === 'string') {
      return this.indicatorEngine.resolveIndicatorValue(
        indicators,
        indicatorRef,
        currentIndex
      );
    }

    return 0;
  }

  private resolveOperand(
    operand: ConditionOperand | undefined,
    context: ExitContext
  ): number {
    if (operand === undefined) {
      return 0;
    }

    if (typeof operand === 'number') {
      return operand;
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      return context.params[paramName] ?? 0;
    }

    if (typeof operand === 'string') {
      const value = this.indicatorEngine.resolveIndicatorValue(
        context.indicators,
        operand,
        context.currentIndex
      );
      return value ?? 0;
    }

    return 0;
  }

  calculateConfidence(
    strategy: StrategyDefinition,
    context: ExitContext
  ): number {
    const config = strategy.confidence;

    if (!config) {
      return this.calculateDefaultConfidence(context);
    }

    let confidence = config.base;
    const appliedBonuses: Array<{ description: string; bonus: number }> = [];

    if (config.bonuses) {
      for (const bonus of config.bonuses) {
        if (this.evaluateBonusCondition(bonus.condition, context)) {
          confidence += bonus.bonus;
          appliedBonuses.push({
            description: bonus.description ?? 'Unknown',
            bonus: bonus.bonus,
          });
        }
      }
    }

    const maxConfidence = config.max ?? DEFAULT_MAX_CONFIDENCE;
    const finalConfidence = Math.min(Math.max(confidence, 0), maxConfidence);

    logger.debug({
      strategy: strategy.id,
      baseConfidence: config.base,
      appliedBonuses,
      totalBonus: appliedBonuses.reduce((sum, b) => sum + b.bonus, 0),
      rawConfidence: confidence,
      maxConfidence,
      finalConfidence,
    }, 'Confidence calculated');

    return finalConfidence;
  }

  private evaluateBonusCondition(
    condition: Condition,
    context: ExitContext
  ): boolean {
    const leftValue = this.resolveConditionOperand(condition.left, context);
    const rightValue = this.resolveConditionOperand(condition.right, context);

    if (leftValue === null || rightValue === null) {
      return false;
    }

    switch (condition.op) {
      case '>':
        return leftValue > rightValue;
      case '<':
        return leftValue < rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '==':
        return Math.abs(leftValue - rightValue) < EPSILON;
      case '!=':
        return Math.abs(leftValue - rightValue) >= EPSILON;
      default:
        return false;
    }
  }

  private resolveConditionOperand(
    operand: ConditionOperand,
    context: ExitContext
  ): number | null {
    if (typeof operand === 'number') {
      return operand;
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      return context.params[paramName] ?? null;
    }

    if (typeof operand === 'string') {
      return this.indicatorEngine.resolveIndicatorValue(
        context.indicators,
        operand,
        context.currentIndex
      );
    }

    return null;
  }

  private calculateDefaultConfidence(context: ExitContext): number {
    const { indicators, currentIndex } = context;

    let confidence = BASE_CONFIDENCE;

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

    if (volumeCurrent !== null && volumeSma20 !== null && volumeCurrent > volumeSma20) {
      confidence += VOLUME_CONFIRMATION_BONUS;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  calculateRiskReward(
    entryPrice: number,
    stopLoss: number | null,
    takeProfit: number | null,
    _direction: 'LONG' | 'SHORT'
  ): number {
    if (stopLoss === null || takeProfit === null) return 0;

    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entryPrice);

    if (riskDistance === 0) return 0;

    return rewardDistance / riskDistance;
  }

  private findSwingLow(klines: Kline[], currentIndex: number, skipRecent: number = 0): number {
    const maxLookback = Math.min(50, currentIndex);
    const searchEndIndex = currentIndex - skipRecent;

    for (let i = searchEndIndex - 1; i >= Math.max(1, currentIndex - maxLookback); i--) {
      const kline = klines[i];
      if (!kline) continue;

      const low = parseFloat(String((kline as { low: string }).low));
      const prevLow = parseFloat(String((klines[i - 1] as { low: string }).low));
      const nextLow = parseFloat(String((klines[i + 1] as { low: string }).low));

      if (low <= prevLow && low <= nextLow) {
        return low;
      }
    }

    const fallbackStart = Math.max(0, currentIndex - 20);
    const fallbackEnd = Math.max(fallbackStart, searchEndIndex);
    const lows = [];
    for (let i = fallbackStart; i <= fallbackEnd; i++) {
      const kline = klines[i];
      if (kline) lows.push(parseFloat(String((kline as { low: string }).low)));
    }
    return lows.length > 0 ? Math.min(...lows) : parseFloat(String((klines[currentIndex] as { low: string }).low));
  }

  private findSwingHigh(klines: Kline[], currentIndex: number, skipRecent: number = 0): number {
    const maxLookback = Math.min(50, currentIndex);
    const searchEndIndex = currentIndex - skipRecent;

    for (let i = searchEndIndex - 1; i >= Math.max(1, currentIndex - maxLookback); i--) {
      const kline = klines[i];
      if (!kline) continue;

      const high = parseFloat(String((kline as { high: string }).high));
      const prevHigh = parseFloat(String((klines[i - 1] as { high: string }).high));
      const nextHigh = parseFloat(String((klines[i + 1] as { high: string }).high));

      if (high >= prevHigh && high >= nextHigh) {
        return high;
      }
    }

    const fallbackStart = Math.max(0, currentIndex - 20);
    const fallbackEnd = Math.max(fallbackStart, searchEndIndex);
    const highs = [];
    for (let i = fallbackStart; i <= fallbackEnd; i++) {
      const kline = klines[i];
      if (kline) highs.push(parseFloat(String((kline as { high: string }).high)));
    }
    return highs.length > 0 ? Math.max(...highs) : parseFloat(String((klines[currentIndex] as { high: string }).high));
  }

  private calculatePivotBasedStop(exit: ExitLevel, context: ExitContext): number {
    const { direction, entryPrice, klines, indicators, currentIndex } = context;

    if (klines.length === 0 || currentIndex < 5) {
      throw new Error('Insufficient klines for pivot-based stop calculation');
    }

    const pivotConfig = this.buildPivotConfig(exit);
    const klinesTyped = klines as Kline[];

    const { stop, pivot } = findNearestPivotStop(
      klinesTyped,
      entryPrice,
      direction,
      pivotConfig
    );

    if (stop === null || !this.isPivotAcceptable(pivot, exit.pivotConfig?.minStrength ?? 'any', exit.pivotConfig?.requireVolumeConfirmation ?? false)) {
      if (exit.fallback) {
        logger.debug({ direction, entryPrice }, 'No suitable pivot found for stop - using fallback');
        return this.calculateStopLoss(exit.fallback, context);
      }

      const atrValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;
      const fallbackMultiplier = 2.0;
      const fallbackDistance = atrValue * fallbackMultiplier;
      const fallbackStop = direction === 'LONG'
        ? entryPrice - fallbackDistance
        : entryPrice + fallbackDistance;

      logger.debug({
        direction,
        entryPrice: entryPrice.toFixed(4),
        fallbackStop: fallbackStop.toFixed(4),
        atrValue: atrValue.toFixed(4),
      }, 'No suitable pivot for stop - using ATR fallback');

      return fallbackStop;
    }

    let stopLoss = stop;
    const atrValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;

    if (exit.buffer !== undefined && atrValue > 0) {
      const bufferValue = this.resolveOperand(exit.buffer, context);
      const bufferAmount = atrValue * bufferValue;
      stopLoss = direction === 'LONG' ? stopLoss - bufferAmount : stopLoss + bufferAmount;
    }

    const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
    if (!isValid) {
      if (exit.fallback) {
        return this.calculateStopLoss(exit.fallback, context);
      }
      throw new Error(`Invalid pivot-based stop: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
    }

    logger.debug({
      type: 'stopLoss',
      exitType: 'pivotBased',
      direction,
      entryPrice: entryPrice.toFixed(4),
      stopLoss: stopLoss.toFixed(4),
      pivotPrice: stop.toFixed(4),
      pivotStrength: pivot?.strength ?? 'unknown',
      volumeConfirmed: pivot?.volumeConfirmed ?? false,
      percentFromEntry: `${(((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
    }, 'Pivot-based stop loss calculated');

    return stopLoss;
  }

  calculatePivotBasedTarget(exit: ExitLevel, context: ExitContext, stopLossPrice?: number): number {
    const { direction, entryPrice, klines, indicators, currentIndex } = context;

    if (klines.length === 0 || currentIndex < 5) {
      throw new Error('Insufficient klines for pivot-based target calculation');
    }

    const pivotConfig = this.buildPivotConfig(exit);
    const klinesTyped = klines as Kline[];

    const { target, pivot } = findNearestPivotTarget(
      klinesTyped,
      entryPrice,
      direction,
      pivotConfig
    );

    if (target === null || !this.isPivotAcceptable(pivot, exit.pivotConfig?.minStrength ?? 'any', exit.pivotConfig?.requireVolumeConfirmation ?? false)) {
      if (exit.fallback) {
        logger.debug({ direction, entryPrice }, 'No suitable pivot found for target - using fallback');
        return this.calculateTakeProfit(exit.fallback, context, stopLossPrice);
      }

      if (stopLossPrice !== undefined) {
        const slDistance = Math.abs(entryPrice - stopLossPrice);
        const defaultRR = 2.0;
        const fallbackTarget = direction === 'LONG'
          ? entryPrice + (slDistance * defaultRR)
          : entryPrice - (slDistance * defaultRR);

        logger.debug({
          direction,
          entryPrice: entryPrice.toFixed(4),
          fallbackTarget: fallbackTarget.toFixed(4),
          rrRatio: defaultRR,
        }, 'No suitable pivot for target - using 2:1 R:R fallback');

        return fallbackTarget;
      }

      const atrValue = this.indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;
      const fallbackMultiplier = 3.0;
      const fallbackTarget = direction === 'LONG'
        ? entryPrice + (atrValue * fallbackMultiplier)
        : entryPrice - (atrValue * fallbackMultiplier);

      return fallbackTarget;
    }

    const isValid = direction === 'LONG' ? target > entryPrice : target < entryPrice;
    if (!isValid) {
      if (exit.fallback) {
        return this.calculateTakeProfit(exit.fallback, context, stopLossPrice);
      }
      throw new Error(`Invalid pivot-based target: ${direction} TP ${target.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
    }

    logger.debug({
      type: 'takeProfit',
      exitType: 'pivotBased',
      direction,
      entryPrice: entryPrice.toFixed(4),
      takeProfit: target.toFixed(4),
      pivotStrength: pivot?.strength ?? 'unknown',
      volumeConfirmed: pivot?.volumeConfirmed ?? false,
      percentFromEntry: `${(((target - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
    }, 'Pivot-based take profit calculated');

    return target;
  }

  private buildPivotConfig(exit: ExitLevel): PivotDetectionConfig {
    const config = exit.pivotConfig;
    return {
      lookback: exit.lookback ?? 5,
      lookahead: 2,
      volumeLookback: config?.volumeLookback ?? 20,
      volumeMultiplier: config?.volumeMultiplier ?? 1.2,
    };
  }

  private isPivotAcceptable(
    pivot: EnhancedPivotPoint | null,
    minStrength: PivotStrengthFilter,
    requireVolumeConfirmation: boolean
  ): boolean {
    if (!pivot) return false;

    if (requireVolumeConfirmation && !pivot.volumeConfirmed) {
      return false;
    }

    if (minStrength === 'any') return true;

    const strengthOrder: Record<PivotStrength, number> = {
      'weak': 1,
      'medium': 2,
      'strong': 3,
    };

    const minStrengthValue = strengthOrder[minStrength as PivotStrength] ?? 0;
    const pivotStrengthValue = strengthOrder[pivot.strength] ?? 0;

    return pivotStrengthValue >= minStrengthValue;
  }
}

