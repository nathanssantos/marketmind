import type {
  ComputedIndicator,
  ComputedIndicators,
  IndicatorDefinition,
  IndicatorType,
  Kline,
  ScreenerIndicatorId,
} from '@marketmind/types';

import { calculateADX, calculateATR } from '@marketmind/indicators';

import { createCryptoIndicatorHandlers, fetchCryptoData } from './crypto-handlers';
import { calculateVolumeSMA, createIndicatorHandlers } from './handlers';
import { SCREENER_KLINE_EVALUATORS, SCREENER_TICKER_EVALUATORS } from './screener';
import type { CryptoData, ScreenerExtraData, ScreenerTickerData } from './types';
import { MAX_CACHE_SIZE, MAX_SINGLE_CACHE_SIZE } from './types';

export type { ScreenerExtraData, ScreenerTickerData } from './types';
export { isTickerBasedIndicator, TICKER_BASED_INDICATORS } from './screener';

export class IndicatorEngine {
  private cache: Map<string, ComputedIndicators> = new Map();
  private singleCache: Map<string, ComputedIndicator> = new Map();
  private cryptoDataCache: Map<string, { data: CryptoData; timestamp: number }> = new Map();
  private cryptoDataCacheTTL: number = 60000;

  private readonly indicatorComputeHandlers = createIndicatorHandlers();
  private readonly cryptoIndicatorHandlers = createCryptoIndicatorHandlers();

  computeIndicators(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): ComputedIndicators {
    const cacheKey = this.generateCacheKey(klines, indicators, params);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result: ComputedIndicators = {};
    const klineKey = this.getKlineKey(klines);

    for (const [id, definition] of Object.entries(indicators)) {
      const resolvedParams = this.resolveParams(definition.params, params);
      const singleKey = `${klineKey}:${definition.type}:${JSON.stringify(resolvedParams)}`;
      const cachedSingle = this.singleCache.get(singleKey);
      if (cachedSingle) {
        result[id] = cachedSingle;
      } else {
        const computed = this.computeIndicator(klines, definition, params);
        result[id] = computed;
        if (this.singleCache.size >= MAX_SINGLE_CACHE_SIZE) {
          const firstKey = this.singleCache.keys().next().value;
          if (firstKey) this.singleCache.delete(firstKey);
        }
        this.singleCache.set(singleKey, computed);
      }
    }

    result['_price'] = {
      type: 'sma' as IndicatorType,
      values: {
        open: klines.map((k) => parseFloat(k.open)),
        high: klines.map((k) => parseFloat(k.high)),
        low: klines.map((k) => parseFloat(k.low)),
        close: klines.map((k) => parseFloat(k.close)),
        volume: klines.map((k) => parseFloat(k.volume)),
      },
    };

    const volumeSma20 = calculateVolumeSMA(klines, 20);
    result['volume'] = {
      type: 'sma' as IndicatorType,
      values: {
        current: klines.map((k) => parseFloat(k.volume)),
        sma20: volumeSma20,
      },
    };

    if (!result['adx']) {
      const adxKey = `${klineKey}:adx:{"period":14}`;
      const cachedAdx = this.singleCache.get(adxKey);
      if (cachedAdx) {
        result['adx'] = cachedAdx;
      } else {
        const adxResult = calculateADX(klines, 14);
        result['adx'] = {
          type: 'adx' as IndicatorType,
          values: {
            adx: adxResult.adx,
            plusDI: adxResult.plusDI,
            minusDI: adxResult.minusDI,
          },
        };
        this.singleCache.set(adxKey, result['adx']);
      }
    }

    if (!result['atr']) {
      const atrKey = `${klineKey}:atr:{"period":14}`;
      const cachedAtr = this.singleCache.get(atrKey);
      if (cachedAtr) {
        result['atr'] = cachedAtr;
      } else {
        const atrResult = calculateATR(klines, 14);
        result['atr'] = {
          type: 'atr' as IndicatorType,
          values: atrResult,
        };
        this.singleCache.set(atrKey, result['atr']);
      }
    }

    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);
    return result;
  }

  private getKlineKey(klines: Kline[]): string {
    if (klines.length === 0) return 'empty';
    return `${klines.length}-${klines[0]?.openTime}-${klines[klines.length - 1]?.openTime}`;
  }

  async computeIndicatorsWithCryptoData(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>,
    symbol: string,
    baseAssetSymbol?: string
  ): Promise<ComputedIndicators> {
    const result = this.computeIndicators(klines, indicators, params);

    const hasCryptoIndicators = Object.values(indicators).some(
      (def) => ['fundingRate', 'openInterest', 'liquidations', 'relativeStrength', 'btcDominance'].includes(def.type)
    );

    if (!hasCryptoIndicators) return result;

    const cryptoData = await fetchCryptoData(
      this.cryptoDataCache,
      this.cryptoDataCacheTTL,
      symbol,
      Object.values(indicators).some((def) => def.type === 'btcDominance'),
    );

    for (const [id, definition] of Object.entries(indicators)) {
      const computed = this.computeCryptoIndicator(klines, definition, params, cryptoData, baseAssetSymbol);
      if (computed) result[id] = computed;
    }

    return result;
  }

  private computeCryptoIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>,
    cryptoData: CryptoData,
    _baseAssetSymbol?: string
  ): ComputedIndicator | null {
    const resolvedParams = this.resolveParams(definition.params, params);
    const handler = this.cryptoIndicatorHandlers[definition.type];
    return handler ? handler(klines, resolvedParams, cryptoData) : null;
  }

  private computeIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>
  ): ComputedIndicator {
    const resolvedParams = this.resolveParams(definition.params, params);
    const handler = this.indicatorComputeHandlers[definition.type];

    if (!handler) throw new Error(`Unknown indicator type: ${definition.type}`);

    return handler(klines, resolvedParams);
  }

  private resolveParams(
    indicatorParams: Record<string, number | string>,
    strategyParams: Record<string, number>
  ): Record<string, number | string> {
    const resolved: Record<string, number | string> = {};

    for (const [key, value] of Object.entries(indicatorParams)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1);
        const paramValue = strategyParams[paramName];
        if (paramValue === undefined) throw new Error(`Unknown parameter reference: ${value}`);
        resolved[key] = paramValue;
      } else if (typeof value === 'number' || typeof value === 'string') {
        resolved[key] = value;
      } else {
        throw new Error(`Invalid parameter value: ${value}`);
      }
    }

    return resolved;
  }

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

  resolveIndicatorValue(
    indicators: ComputedIndicators,
    reference: string,
    index: number
  ): number | null {
    const { base, subKey, offset } = this.parseReference(reference);
    const effectiveIndex = index - offset;

    if (effectiveIndex < 0) return null;

    if (base === 'volume' && subKey) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return null;
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return null;
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[base]?.[effectiveIndex] ?? null;
    }

    if (!base) return null;

    const indicator = indicators[base];
    if (!indicator) return null;

    if (Array.isArray(indicator.values)) return indicator.values[effectiveIndex] ?? null;

    const values = indicator.values;
    if (subKey) return values[subKey]?.[effectiveIndex] ?? null;

    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey]?.[effectiveIndex] ?? null) : null;
  }

  getIndicatorSeries(
    indicators: ComputedIndicators,
    reference: string
  ): (number | null)[] {
    const { base, subKey, offset } = this.parseReference(reference);

    if (!base) return [];

    let baseSeries: (number | null)[] = [];

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
        const values = indicator.values;
        if (subKey) {
          baseSeries = values[subKey] ?? [];
        } else {
          const defaultKey = Object.keys(values)[0];
          baseSeries = defaultKey ? (values[defaultKey] ?? []) : [];
        }
      }
    }

    if (offset > 0 && baseSeries.length > 0) {
      const shifted: (number | null)[] = new Array(baseSeries.length).fill(null);
      for (let i = offset; i < baseSeries.length; i++) {
        shifted[i] = baseSeries[i - offset] ?? null;
      }
      return shifted;
    }

    return baseSeries;
  }

  clearCache(): void {
    this.cache.clear();
    this.singleCache.clear();
  }

  evaluateScreenerIndicator(
    id: ScreenerIndicatorId,
    klines: Kline[],
    params: Record<string, number> = {},
    tickerData?: ScreenerTickerData,
    extraData?: ScreenerExtraData,
  ): number | null {
    const tickerFn = SCREENER_TICKER_EVALUATORS[id];
    if (tickerFn) return tickerFn(klines, params, tickerData, extraData);

    const klineFn = SCREENER_KLINE_EVALUATORS[id];
    if (klineFn) return klineFn(klines, params, tickerData, extraData);

    return null;
  }

  evaluateScreenerIndicators(
    ids: ScreenerIndicatorId[],
    klines: Kline[],
    paramsMap: Record<string, Record<string, number>>,
    tickerData?: ScreenerTickerData,
    extraData?: ScreenerExtraData,
  ): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    for (const id of ids) {
      result[id] = this.evaluateScreenerIndicator(id, klines, paramsMap[id] ?? {}, tickerData, extraData);
    }
    return result;
  }

  getScreenerPreviousValue(
    id: ScreenerIndicatorId,
    klines: Kline[],
    barsBack: number,
    params: Record<string, number> = {},
  ): number | null {
    if (klines.length <= barsBack) return null;
    const truncated = klines.slice(0, -barsBack);
    return this.evaluateScreenerIndicator(id, truncated, params);
  }

  private generateCacheKey(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): string {
    const klineKey = this.getKlineKey(klines);
    const indicatorKey = JSON.stringify(indicators);
    const paramKey = JSON.stringify(params);
    return `${klineKey}:${indicatorKey}:${paramKey}`;
  }
}
