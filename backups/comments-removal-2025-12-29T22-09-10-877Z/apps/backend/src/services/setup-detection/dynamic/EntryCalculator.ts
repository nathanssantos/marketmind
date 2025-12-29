import type {
  ConditionOperand,
  EntryPriceConfig,
  ExitContext,
} from '@marketmind/types';
import { isParameterReference } from '@marketmind/types';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import type { IndicatorEngine } from './IndicatorEngine';

const DEFAULT_LOOKBACK = 2;
const DEFAULT_EXPIRATION_BARS = 3;
const { MAX_LIMIT_ENTRY_DISTANCE_PERCENT } = EXIT_CALCULATOR;

export class EntryCalculator {
  private indicatorEngine: IndicatorEngine;

  constructor(indicatorEngine: IndicatorEngine) {
    this.indicatorEngine = indicatorEngine;
  }

  calculateEntryPrice(
    config: EntryPriceConfig | undefined,
    context: ExitContext
  ): { price: number; orderType: 'MARKET' | 'LIMIT'; expirationBars: number } {
    const { direction, entryPrice } = context;

    if (!config || config.type === 'market') {
      return {
        price: entryPrice,
        orderType: 'MARKET',
        expirationBars: 0,
      };
    }

    if (config.type === 'close') {
      return {
        price: entryPrice,
        orderType: 'MARKET',
        expirationBars: 0,
      };
    }

    const expirationBars = config.expirationBars ?? DEFAULT_EXPIRATION_BARS;
    let calculatedPrice: number;

    switch (config.type) {
      case 'swingHighLow':
        calculatedPrice = this.calculateSwingEntry(config, context);
        break;

      case 'percent':
        calculatedPrice = this.calculatePercentEntry(config, context);
        break;

      case 'indicator':
        calculatedPrice = this.calculateIndicatorEntry(config, context);
        break;

      default:
        calculatedPrice = entryPrice;
    }

    const isValidEntry = this.validateEntryPrice(calculatedPrice, entryPrice, direction);
    if (!isValidEntry) {
      logger.warn({
        direction,
        entryPrice: entryPrice.toFixed(4),
        calculatedPrice: calculatedPrice.toFixed(4),
        type: config.type,
      }, '⚠️ Invalid entry price calculated, falling back to close price');
      return {
        price: entryPrice,
        orderType: 'MARKET',
        expirationBars: 0,
      };
    }

    logger.debug({
      type: 'entryPrice',
      entryType: config.type,
      direction,
      closePrice: entryPrice.toFixed(4),
      calculatedEntry: calculatedPrice.toFixed(4),
      orderType: 'LIMIT',
      expirationBars,
      improvementPercent: `${(((calculatedPrice - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
    }, 'Entry price calculated');

    return {
      price: calculatedPrice,
      orderType: 'LIMIT',
      expirationBars,
    };
  }

  private calculateSwingEntry(config: EntryPriceConfig, context: ExitContext): number {
    const { direction, klines, currentIndex, indicators } = context;
    const lookback = config.lookback ?? DEFAULT_LOOKBACK;

    const startIdx = Math.max(0, currentIndex - lookback + 1);
    const relevantKlines = [];
    for (let i = startIdx; i <= currentIndex; i++) {
      const kline = klines[i];
      if (kline) relevantKlines.push(kline);
    }

    if (relevantKlines.length === 0) {
      throw new Error('No klines available for swing entry calculation');
    }

    let entryPrice: number;

    if (direction === 'SHORT') {
      const highs = relevantKlines.map((k) => parseFloat(String((k as { high: string }).high)));
      entryPrice = Math.max(...highs);
    } else {
      const lows = relevantKlines.map((k) => parseFloat(String((k as { low: string }).low)));
      entryPrice = Math.min(...lows);
    }

    if (config.buffer !== undefined) {
      const bufferValue = this.resolveOperand(config.buffer, context);
      if (config.indicator === 'atr') {
        const atrValue = this.indicatorEngine.resolveIndicatorValue(
          indicators,
          'atr',
          currentIndex
        ) ?? 0;
        const bufferAmount = atrValue * bufferValue;
        entryPrice = direction === 'SHORT' ? entryPrice - bufferAmount : entryPrice + bufferAmount;
      } else {
        const closePrice = context.entryPrice;
        const bufferAmount = closePrice * (bufferValue / 100);
        entryPrice = direction === 'SHORT' ? entryPrice - bufferAmount : entryPrice + bufferAmount;
      }
    }

    return entryPrice;
  }

  private calculatePercentEntry(config: EntryPriceConfig, context: ExitContext): number {
    const { direction, entryPrice, klines, currentIndex } = context;
    const lookback = config.lookback ?? DEFAULT_LOOKBACK;
    const retracementPercent = config.retracementPercent ?? 50;

    const startIdx = Math.max(0, currentIndex - lookback + 1);
    const relevantKlines = [];
    for (let i = startIdx; i <= currentIndex; i++) {
      const kline = klines[i];
      if (kline) relevantKlines.push(kline);
    }

    if (relevantKlines.length === 0) {
      return entryPrice;
    }

    const highs = relevantKlines.map((k) => parseFloat(String((k as { high: string }).high)));
    const lows = relevantKlines.map((k) => parseFloat(String((k as { low: string }).low)));
    const swingHigh = Math.max(...highs);
    const swingLow = Math.min(...lows);
    const range = swingHigh - swingLow;

    if (direction === 'SHORT') {
      return swingLow + (range * (retracementPercent / 100));
    }
    return swingHigh - (range * (retracementPercent / 100));
  }

  private calculateIndicatorEntry(config: EntryPriceConfig, context: ExitContext): number {
    const { indicators, currentIndex, entryPrice } = context;

    if (!config.indicator) {
      return entryPrice;
    }

    const indicatorValue = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      config.indicator,
      currentIndex
    );

    if (indicatorValue === null) {
      logger.warn({
        indicator: config.indicator,
        currentIndex,
      }, '⚠️ Indicator value not available for entry calculation');
      return entryPrice;
    }

    return indicatorValue;
  }

  private validateEntryPrice(
    calculatedPrice: number,
    closePrice: number,
    direction: 'LONG' | 'SHORT'
  ): boolean {
    const distancePercent = Math.abs(calculatedPrice - closePrice) / closePrice * 100;
    if (distancePercent > MAX_LIMIT_ENTRY_DISTANCE_PERCENT) {
      logger.warn({
        direction,
        closePrice: closePrice.toFixed(4),
        calculatedPrice: calculatedPrice.toFixed(4),
        distancePercent: `${distancePercent.toFixed(2)}%`,
        maxAllowed: `${MAX_LIMIT_ENTRY_DISTANCE_PERCENT}%`,
      }, '⚠️ Limit entry price too far from close - exceeds max distance');
      return false;
    }

    if (direction === 'LONG') {
      return calculatedPrice <= closePrice;
    }
    return calculatedPrice >= closePrice;
  }

  private resolveOperand(
    operand: ConditionOperand | undefined,
    context: ExitContext
  ): number {
    if (operand === undefined) return 0;

    if (typeof operand === 'number') return operand;

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
}
