/**
 * Indicator Engine
 *
 * Computes technical indicators based on strategy definitions.
 * Maps JSON indicator definitions to @marketmind/indicators functions.
 */

import type {
    ComputedIndicator,
    ComputedIndicators, IndicatorDefinition,
    IndicatorType, Kline
} from '@marketmind/types';

import {
    calculateADX,
    calculateATR,
    calculateBollingerBandsArray,
    calculateCCI,
    calculateCumulativeRSI,
    calculateDonchian,
    calculateEMA,
    calculateIBS,
    calculateKeltner,
    calculateMACD,
    calculateMFI,
    calculateNDayHighLow,
    calculateNR7,
    calculateOBV,
    calculatePercentBSeries,
    calculateRSI,
    calculateSMA,
    calculateStochastic,
    calculateSupertrend,
    calculateVWAP,
    calculateWilliamsR,
    findPivotPoints,
} from '@marketmind/indicators';

/**
 * Engine for computing indicators defined in strategy JSON
 */
export class IndicatorEngine {
  private cache: Map<string, ComputedIndicators> = new Map();

  /**
   * Compute all indicators defined in a strategy
   */
  computeIndicators(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): ComputedIndicators {
    const cacheKey = this.generateCacheKey(klines, indicators, params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result: ComputedIndicators = {};

    for (const [id, definition] of Object.entries(indicators)) {
      result[id] = this.computeIndicator(klines, definition, params);
    }

    // Add built-in price/volume series
    result['_price'] = {
      type: 'sma' as IndicatorType, // placeholder type
      values: {
        open: klines.map((k) => parseFloat(k.open)),
        high: klines.map((k) => parseFloat(k.high)),
        low: klines.map((k) => parseFloat(k.low)),
        close: klines.map((k) => parseFloat(k.close)),
        volume: klines.map((k) => parseFloat(k.volume)),
      },
    };

    // Compute volume SMA for confidence bonuses
    const volumeSma20 = calculateSMA(klines, 20);
    result['volume'] = {
      type: 'sma' as IndicatorType,
      values: {
        current: klines.map((k) => parseFloat(k.volume)),
        sma20: volumeSma20,
      },
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Compute a single indicator
   */
  private computeIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>
  ): ComputedIndicator {
    const resolvedParams = this.resolveParams(definition.params, params);

    switch (definition.type) {
      case 'sma':
        return {
          type: 'sma',
          values: calculateSMA(klines, resolvedParams['period'] ?? 20),
        };

      case 'ema':
        return {
          type: 'ema',
          values: calculateEMA(klines, resolvedParams['period'] ?? 20),
        };

      case 'rsi':
        const rsiResult = calculateRSI(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'rsi',
          values: rsiResult.values,
        };

      case 'macd':
        const macdResult = calculateMACD(
          klines,
          resolvedParams['fastPeriod'] ?? 12,
          resolvedParams['slowPeriod'] ?? 26,
          resolvedParams['signalPeriod'] ?? 9
        );
        return {
          type: 'macd',
          values: {
            macd: macdResult.macd,
            signal: macdResult.signal,
            histogram: macdResult.histogram,
          },
        };

      case 'bollingerBands':
        const bbResult = calculateBollingerBandsArray(
          klines,
          resolvedParams['period'] ?? 20,
          resolvedParams['stdDev'] ?? 2
        );
        return {
          type: 'bollingerBands',
          values: {
            upper: bbResult.map((b) => b?.upper ?? null),
            middle: bbResult.map((b) => b?.middle ?? null),
            lower: bbResult.map((b) => b?.lower ?? null),
          },
        };

      case 'atr':
        const atrResult = calculateATR(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'atr',
          values: atrResult.map((v) => (isNaN(v) ? null : v)),
        };

      case 'stochastic':
        const stochResult = calculateStochastic(
          klines,
          resolvedParams['kPeriod'] ?? 14,
          resolvedParams['dPeriod'] ?? 3
        );
        return {
          type: 'stochastic',
          values: {
            k: stochResult.k,
            d: stochResult.d,
          },
        };

      case 'vwap':
        const vwapResult = calculateVWAP(klines);
        return {
          type: 'vwap',
          values: vwapResult,
        };

      case 'pivotPoints':
        const pivots = findPivotPoints(klines, resolvedParams['lookback'] ?? 5);
        const pivotValues: (number | null)[] = new Array(klines.length).fill(null);
        for (const pivot of pivots) {
          if (pivot.index >= 0 && pivot.index < pivotValues.length) {
            pivotValues[pivot.index] = pivot.price;
          }
        }
        return {
          type: 'pivotPoints',
          values: pivotValues,
        };

      case 'adx':
        const adxResult = calculateADX(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'adx',
          values: {
            adx: adxResult.adx,
            plusDI: adxResult.plusDI,
            minusDI: adxResult.minusDI,
          },
        };

      case 'obv':
        const obvResult = calculateOBV(klines, resolvedParams['smaPeriod']);
        return {
          type: 'obv',
          values: {
            obv: obvResult.values,
            sma: obvResult.sma,
          },
        };

      case 'williamsR':
        const williamsResult = calculateWilliamsR(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'williamsR',
          values: williamsResult,
        };

      case 'cci':
        const cciResult = calculateCCI(klines, resolvedParams['period'] ?? 20);
        return {
          type: 'cci',
          values: cciResult,
        };

      case 'mfi':
        const mfiResult = calculateMFI(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'mfi',
          values: mfiResult,
        };

      case 'donchian':
        const donchianResult = calculateDonchian(klines, resolvedParams['period'] ?? 20);
        return {
          type: 'donchian',
          values: {
            upper: donchianResult.upper,
            middle: donchianResult.middle,
            lower: donchianResult.lower,
          },
        };

      case 'keltner':
        const keltnerResult = calculateKeltner(
          klines,
          resolvedParams['emaPeriod'] ?? 20,
          resolvedParams['atrPeriod'] ?? 10,
          resolvedParams['multiplier'] ?? 2
        );
        return {
          type: 'keltner',
          values: {
            upper: keltnerResult.upper,
            middle: keltnerResult.middle,
            lower: keltnerResult.lower,
          },
        };

      case 'supertrend':
        const supertrendResult = calculateSupertrend(
          klines,
          resolvedParams['period'] ?? 10,
          resolvedParams['multiplier'] ?? 3
        );
        return {
          type: 'supertrend',
          values: {
            trend: supertrendResult.trend.map((t) => (t === 'up' ? 1 : t === 'down' ? -1 : null)),
            value: supertrendResult.value,
          },
        };

      case 'ibs':
        const ibsResult = calculateIBS(klines);
        return {
          type: 'ibs',
          values: ibsResult.values,
        };

      case 'percentB':
        const percentBResult = calculatePercentBSeries(
          klines,
          resolvedParams['period'] ?? 20,
          resolvedParams['stdDev'] ?? 2
        );
        return {
          type: 'percentB',
          values: percentBResult.values,
        };

      case 'cumulativeRsi':
        const cumulativeRsiResult = calculateCumulativeRSI(
          klines,
          resolvedParams['rsiPeriod'] ?? 2,
          resolvedParams['sumPeriod'] ?? 2
        );
        return {
          type: 'cumulativeRsi',
          values: {
            cumulative: cumulativeRsiResult.values,
            rsi: cumulativeRsiResult.rsiValues,
          },
        };

      case 'nDayHighLow':
        const nDayResult = calculateNDayHighLow(klines, resolvedParams['period'] ?? 7);
        return {
          type: 'nDayHighLow',
          values: {
            isNDayHigh: nDayResult.isNDayHigh.map((v) => (v ? 1 : 0)),
            isNDayLow: nDayResult.isNDayLow.map((v) => (v ? 1 : 0)),
            highestClose: nDayResult.highestClose,
            lowestClose: nDayResult.lowestClose,
          },
        };

      case 'nr7':
        const nr7Result = calculateNR7(klines, resolvedParams['lookback'] ?? 7);
        return {
          type: 'nr7',
          values: nr7Result.isNR7.map((v) => (v ? 1 : 0)),
        };

      default:
        throw new Error(`Unknown indicator type: ${definition.type}`);
    }
  }

  /**
   * Resolve parameter references ($paramName) to actual values
   */
  private resolveParams(
    indicatorParams: Record<string, number | string>,
    strategyParams: Record<string, number>
  ): Record<string, number> {
    const resolved: Record<string, number> = {};

    for (const [key, value] of Object.entries(indicatorParams)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1);
        const paramValue = strategyParams[paramName];
        if (paramValue === undefined) {
          throw new Error(`Unknown parameter reference: ${value}`);
        }
        resolved[key] = paramValue;
      } else if (typeof value === 'number') {
        resolved[key] = value;
      } else {
        throw new Error(`Invalid parameter value: ${value}`);
      }
    }

    return resolved;
  }

  /**
   * Parse a reference string to extract base indicator, sub-key, and offset
   *
   * Examples:
   * - "close" -> { base: "close", subKey: null, offset: 0 }
   * - "close.prev" -> { base: "close", subKey: null, offset: 1 }
   * - "close.prev2" -> { base: "close", subKey: null, offset: 2 }
   * - "ema9.prev" -> { base: "ema9", subKey: null, offset: 1 }
   * - "bb.upper.prev" -> { base: "bb", subKey: "upper", offset: 1 }
   * - "macd.signal.prev3" -> { base: "macd", subKey: "signal", offset: 3 }
   */
  private parseReference(reference: string): { base: string; subKey: string | null; offset: number } {
    const parts = reference.split('.');
    const base = parts[0] ?? '';
    let subKey: string | null = null;
    let offset = 0;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (part === 'prev') {
        offset = 1;
      } else if (part.startsWith('prev')) {
        const num = parseInt(part.slice(4), 10);
        offset = isNaN(num) ? 1 : num;
      } else if (!subKey) {
        subKey = part;
      }
    }

    return { base, subKey, offset };
  }

  /**
   * Resolve an indicator reference to a value at a specific index
   *
   * Supports:
   * - "close", "open", "high", "low", "volume" - price data
   * - "rsi" - simple indicator value
   * - "bb.upper", "bb.lower", "bb.middle" - nested indicator values
   * - "macd.signal", "macd.histogram" - nested indicator values
   * - ".prev", ".prev2", ".prev3" suffixes for historical values
   *   e.g., "close.prev", "ema9.prev2", "bb.upper.prev"
   */
  resolveIndicatorValue(
    indicators: ComputedIndicators,
    reference: string,
    index: number
  ): number | null {
    const { base, subKey, offset } = this.parseReference(reference);
    const effectiveIndex = index - offset;

    if (effectiveIndex < 0) return null;

    // Handle price references
    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return null;
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[base]?.[effectiveIndex] ?? null;
    }

    // Handle volume.sma20 and volume.current
    if (base === 'volume' && subKey) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return null;
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    if (!base) return null;

    const indicator = indicators[base];
    if (!indicator) return null;

    // Check if values is an array (simple indicator) or object (compound indicator)
    if (Array.isArray(indicator.values)) {
      return indicator.values[effectiveIndex] ?? null;
    }

    // Compound indicator with sub-keys
    const values = indicator.values as Record<string, (number | null)[]>;
    if (subKey) {
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    // If no sub-key provided, try to get a default value
    // For RSI-like indicators, return the main value
    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey]?.[effectiveIndex] ?? null) : null;
  }

  /**
   * Get indicator values as array for crossover detection
   * Supports .prev, .prev2, etc. offsets - returns shifted arrays
   */
  getIndicatorSeries(
    indicators: ComputedIndicators,
    reference: string
  ): (number | null)[] {
    const { base, subKey, offset } = this.parseReference(reference);

    if (!base) return [];

    let baseSeries: (number | null)[] = [];

    // Handle price references
    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return [];
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      baseSeries = values[base] ?? [];
    } else if (base === 'volume' && subKey && !offset) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return [];
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      baseSeries = values[subKey] ?? [];
    } else {
      const indicator = indicators[base];
      if (!indicator) return [];

      if (Array.isArray(indicator.values)) {
        baseSeries = indicator.values;
      } else {
        const values = indicator.values as Record<string, (number | null)[]>;
        if (subKey) {
          baseSeries = values[subKey] ?? [];
        } else {
          const defaultKey = Object.keys(values)[0];
          baseSeries = defaultKey ? (values[defaultKey] ?? []) : [];
        }
      }
    }

    // Apply offset if needed (shift series by offset positions)
    if (offset > 0 && baseSeries.length > 0) {
      const shifted: (number | null)[] = new Array(baseSeries.length).fill(null);
      for (let i = offset; i < baseSeries.length; i++) {
        shifted[i] = baseSeries[i - offset] ?? null;
      }
      return shifted;
    }

    return baseSeries;
  }

  /**
   * Clear the indicator cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate a cache key for computed indicators
   */
  private generateCacheKey(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): string {
    const klineKey = klines.length > 0
      ? `${klines.length}-${klines[0]?.openTime}-${klines[klines.length - 1]?.openTime}`
      : 'empty';
    const indicatorKey = JSON.stringify(indicators);
    const paramKey = JSON.stringify(params);
    return `${klineKey}:${indicatorKey}:${paramKey}`;
  }
}
