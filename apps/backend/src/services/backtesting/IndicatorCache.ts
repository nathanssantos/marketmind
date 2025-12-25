import type { ComputedIndicator, IndicatorDefinition, IndicatorType, Kline, StrategyDefinition } from '@marketmind/types';
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
  calculateNDayHighLow,
  calculateNR7,
  calculatePercentBSeries,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateSupertrend,
} from '@marketmind/indicators';

interface CacheEntry {
  type: IndicatorType;
  params: Record<string, number>;
  result: ComputedIndicator;
}

const generateCacheKey = (type: string, params: Record<string, number>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}:${params[k]}`)
    .join(',');
  return `${type}|${sortedParams}`;
};

export class IndicatorCache {
  private cache: Map<string, CacheEntry> = new Map();
  private klines: Kline[] = [];
  private priceData: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
  } | null = null;

  initialize(klines: Kline[]): void {
    this.klines = klines;
    this.cache.clear();

    this.priceData = {
      open: klines.map(k => parseFloat(k.open)),
      high: klines.map(k => parseFloat(k.high)),
      low: klines.map(k => parseFloat(k.low)),
      close: klines.map(k => parseFloat(k.close)),
      volume: klines.map(k => parseFloat(k.volume)),
    };
  }

  precomputeForStrategies(strategies: StrategyDefinition[], params: Record<string, number>): void {
    const uniqueIndicators = new Map<string, { type: IndicatorType; resolvedParams: Record<string, number> }>();

    for (const strategy of strategies) {
      if (!strategy.indicators) continue;

      for (const [_id, definition] of Object.entries(strategy.indicators)) {
        const resolvedParams = this.resolveParams(definition.params, params, strategy.parameters);
        const cacheKey = generateCacheKey(definition.type, resolvedParams);

        if (!uniqueIndicators.has(cacheKey)) {
          uniqueIndicators.set(cacheKey, {
            type: definition.type as IndicatorType,
            resolvedParams,
          });
        }
      }
    }

    console.log(`[IndicatorCache] Pre-computing ${uniqueIndicators.size} unique indicators for ${strategies.length} strategies`);

    for (const [cacheKey, { type, resolvedParams }] of uniqueIndicators) {
      const result = this.computeIndicator(type, resolvedParams);
      if (result) {
        this.cache.set(cacheKey, { type, params: resolvedParams, result });
      }
    }

    console.log(`[IndicatorCache] Cached ${this.cache.size} indicators`);
  }

  private resolveParams(
    indicatorParams: Record<string, string | number> | undefined,
    globalParams: Record<string, number>,
    strategyParameters?: Record<string, { default: number }>
  ): Record<string, number> {
    if (!indicatorParams) return {};

    const resolved: Record<string, number> = {};
    for (const [key, value] of Object.entries(indicatorParams)) {
      if (typeof value === 'number') {
        resolved[key] = value;
      } else if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1);
        resolved[key] = globalParams[paramName] ?? strategyParameters?.[paramName]?.default ?? 0;
      }
    }
    return resolved;
  }

  get(type: IndicatorType, params: Record<string, number>): ComputedIndicator | null {
    const cacheKey = generateCacheKey(type, params);
    const entry = this.cache.get(cacheKey);
    return entry?.result ?? null;
  }

  getForDefinition(definition: IndicatorDefinition, globalParams: Record<string, number>, strategyParameters?: Record<string, { default: number }>): ComputedIndicator | null {
    const resolvedParams = this.resolveParams(definition.params, globalParams, strategyParameters);
    return this.get(definition.type as IndicatorType, resolvedParams);
  }

  getPriceData(): typeof this.priceData {
    return this.priceData;
  }

  private computeIndicator(type: IndicatorType, params: Record<string, number>): ComputedIndicator | null {
    if (!this.priceData || this.klines.length === 0) return null;

    const { close, high, low, volume } = this.priceData;

    switch (type) {
      case 'sma': {
        const period = params.period ?? 20;
        const values = calculateSMA(close, period);
        return { type, values };
      }

      case 'ema': {
        const period = params.period ?? 20;
        const result = calculateEMA(this.klines, period);
        return { type, values: result };
      }

      case 'rsi': {
        const period = params.period ?? 14;
        const result = calculateRSI(this.klines, period);
        return { type, values: result.values };
      }

      case 'bollingerBands': {
        const period = params.period ?? 20;
        const stdDev = params.stdDev ?? 2;
        const result = calculateBollingerBandsArray(this.klines, period, stdDev);
        return {
          type,
          values: {
            upper: result.map(r => r?.upper ?? null),
            middle: result.map(r => r?.middle ?? null),
            lower: result.map(r => r?.lower ?? null),
          },
        };
      }

      case 'atr': {
        const period = params.period ?? 14;
        const result = calculateATR(this.klines, period);
        return { type, values: result };
      }

      case 'macd': {
        const fast = params.fastPeriod ?? 12;
        const slow = params.slowPeriod ?? 26;
        const signal = params.signalPeriod ?? 9;
        const result = calculateMACD(this.klines, fast, slow, signal);
        return {
          type,
          values: {
            macd: result.macdLine,
            signal: result.signalLine,
            histogram: result.histogram,
          },
        };
      }

      case 'stochastic': {
        const kPeriod = params.kPeriod ?? 14;
        const dPeriod = params.dPeriod ?? 3;
        const smooth = params.smooth ?? 3;
        const result = calculateStochastic(this.klines, kPeriod, dPeriod, smooth);
        return {
          type,
          values: {
            k: result.k,
            d: result.d,
          },
        };
      }

      case 'adx': {
        const period = params.period ?? 14;
        const result = calculateADX(this.klines, period);
        return {
          type,
          values: {
            adx: result.adx,
            plusDI: result.plusDI,
            minusDI: result.minusDI,
          },
        };
      }

      case 'cci': {
        const period = params.period ?? 20;
        const result = calculateCCI(this.klines, period);
        return { type, values: result };
      }

      case 'keltner': {
        const emaPeriod = params.emaPeriod ?? 20;
        const atrPeriod = params.atrPeriod ?? 10;
        const multiplier = params.multiplier ?? 2;
        const result = calculateKeltner(this.klines, emaPeriod, atrPeriod, multiplier);
        return {
          type,
          values: {
            upper: result.upper,
            middle: result.middle,
            lower: result.lower,
          },
        };
      }

      case 'supertrend': {
        const period = params.period ?? 10;
        const multiplier = params.multiplier ?? 3;
        const result = calculateSupertrend(this.klines, period, multiplier);
        return {
          type,
          values: {
            supertrend: result.supertrend,
            direction: result.direction,
          },
        };
      }

      case 'donchian': {
        const period = params.period ?? 20;
        const result = calculateDonchian(this.klines, period);
        return {
          type,
          values: {
            upper: result.upper,
            middle: result.middle,
            lower: result.lower,
          },
        };
      }

      case 'ibs': {
        const result = calculateIBS(this.klines);
        return { type, values: result };
      }

      case 'cumulativeRsi': {
        const rsiPeriod = params.rsiPeriod ?? 2;
        const cumulativePeriod = params.cumulativePeriod ?? 2;
        const result = calculateCumulativeRSI(this.klines, rsiPeriod, cumulativePeriod);
        return { type, values: result.values };
      }

      case 'nr7': {
        const result = calculateNR7(this.klines);
        return { type, values: result.isNR7 };
      }

      case 'nDayHighLow': {
        const days = params.days ?? 7;
        const result = calculateNDayHighLow(this.klines, days);
        return {
          type,
          values: {
            isHighest: result.isHighest,
            isLowest: result.isLowest,
          },
        };
      }

      case 'percentB': {
        const period = params.period ?? 20;
        const stdDev = params.stdDev ?? 2;
        const result = calculatePercentBSeries(this.klines, period, stdDev);
        return { type, values: result };
      }

      default:
        return null;
    }
  }

  clear(): void {
    this.cache.clear();
    this.klines = [];
    this.priceData = null;
  }

  getStats(): { cacheSize: number; indicatorTypes: string[] } {
    const types = new Set<string>();
    for (const entry of this.cache.values()) {
      types.add(entry.type);
    }
    return {
      cacheSize: this.cache.size,
      indicatorTypes: Array.from(types),
    };
  }
}
