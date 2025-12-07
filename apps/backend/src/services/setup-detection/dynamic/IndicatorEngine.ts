/**
 * Indicator Engine
 *
 * Computes technical indicators based on strategy definitions.
 * Maps JSON indicator definitions to @marketmind/indicators functions.
 */

import type { Kline } from '@marketmind/types';
import type {
  IndicatorDefinition,
  IndicatorType,
  ComputedIndicator,
  ComputedIndicators,
} from '@marketmind/types';

import { calculateSMA, calculateEMA } from '@marketmind/indicators';
import { calculateRSI } from '@marketmind/indicators';
import { calculateMACD } from '@marketmind/indicators';
import { calculateBollingerBandsArray } from '@marketmind/indicators';
import { calculateATR } from '@marketmind/indicators';
import { calculateStochastic } from '@marketmind/indicators';
import { calculateVWAP } from '@marketmind/indicators';
import { findPivotPoints } from '@marketmind/indicators';

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
        // Convert pivot points to array indexed by kline position
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
   * Resolve an indicator reference to a value at a specific index
   *
   * Supports:
   * - "close", "open", "high", "low", "volume" - price data
   * - "rsi" - simple indicator value
   * - "bb.upper", "bb.lower", "bb.middle" - nested indicator values
   * - "macd.signal", "macd.histogram" - nested indicator values
   */
  resolveIndicatorValue(
    indicators: ComputedIndicators,
    reference: string,
    index: number
  ): number | null {
    // Handle price references
    if (['open', 'high', 'low', 'close', 'volume'].includes(reference)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return null;
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[reference]?.[index] ?? null;
    }

    // Handle volume.sma20 and volume.current
    if (reference.startsWith('volume.')) {
      const subKey = reference.split('.')[1];
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return null;
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      return values[subKey ?? 'current']?.[index] ?? null;
    }

    // Handle nested references like "bb.upper" or simple like "rsi"
    const parts = reference.split('.');
    const indicatorId = parts[0];
    const subKey = parts[1];

    if (!indicatorId) return null;

    const indicator = indicators[indicatorId];
    if (!indicator) return null;

    // Check if values is an array (simple indicator) or object (compound indicator)
    if (Array.isArray(indicator.values)) {
      return indicator.values[index] ?? null;
    }

    // Compound indicator with sub-keys
    const values = indicator.values as Record<string, (number | null)[]>;
    if (subKey) {
      return values[subKey]?.[index] ?? null;
    }

    // If no sub-key provided, try to get a default value
    // For RSI-like indicators, return the main value
    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey]?.[index] ?? null) : null;
  }

  /**
   * Get indicator values as array for crossover detection
   */
  getIndicatorSeries(
    indicators: ComputedIndicators,
    reference: string
  ): (number | null)[] {
    const parts = reference.split('.');
    const indicatorId = parts[0];
    const subKey = parts[1];

    if (!indicatorId) return [];

    // Handle price references
    if (['open', 'high', 'low', 'close', 'volume'].includes(indicatorId)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return [];
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[indicatorId] ?? [];
    }

    const indicator = indicators[indicatorId];
    if (!indicator) return [];

    if (Array.isArray(indicator.values)) {
      return indicator.values;
    }

    const values = indicator.values as Record<string, (number | null)[]>;
    if (subKey) {
      return values[subKey] ?? [];
    }

    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey] ?? []) : [];
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
