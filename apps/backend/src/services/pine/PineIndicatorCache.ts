import type { Kline } from '@marketmind/types';
import { PineIndicatorService } from './PineIndicatorService';

export class PineIndicatorCache {
  private service = new PineIndicatorService();
  private cache = new Map<string, (number | null)[]>();
  private multiCache = new Map<string, Record<string, (number | null)[]>>();
  private klines: Kline[] = [];

  async initialize(klines: Kline[]): Promise<void> {
    this.klines = klines;
    this.cache.clear();
    this.multiCache.clear();
  }

  async getOrCompute(
    type: Parameters<PineIndicatorService['compute']>[0],
    params: Record<string, number> = {}
  ): Promise<(number | null)[]> {
    const key = `${type}:${JSON.stringify(params)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const result = await this.service.compute(type, this.klines, params);
    this.cache.set(key, result);
    return result;
  }

  async getOrComputeMulti(
    type: Parameters<PineIndicatorService['computeMulti']>[0],
    params: Record<string, number> = {}
  ): Promise<Record<string, (number | null)[]>> {
    const key = `multi:${type}:${JSON.stringify(params)}`;
    const cached = this.multiCache.get(key);
    if (cached) return cached;

    const result = await this.service.computeMulti(type, this.klines, params);
    this.multiCache.set(key, result);
    return result;
  }

  async precompute(indicators: Array<{ type: string; params?: Record<string, number> }>): Promise<void> {
    const singleTypes: Set<string> = new Set(['sma', 'ema', 'rsi', 'atr', 'hma', 'wma', 'cci', 'mfi', 'roc', 'cmo', 'vwap', 'obv', 'wpr', 'tsi', 'sar', 'highest', 'lowest']);
    const multiTypes: Set<string> = new Set(['bb', 'macd', 'stoch', 'kc', 'supertrend', 'dmi']);

    for (const { type, params } of indicators) {
      if (singleTypes.has(type)) {
        await this.getOrCompute(type as Parameters<PineIndicatorService['compute']>[0], params);
      } else if (multiTypes.has(type)) {
        await this.getOrComputeMulti(type as Parameters<PineIndicatorService['computeMulti']>[0], params);
      }
    }
  }

  getEMA(period: number): (number | null)[] {
    return this.cache.get(`ema:{"period":${period}}`) ?? [];
  }

  getSMA(period: number): (number | null)[] {
    return this.cache.get(`sma:{"period":${period}}`) ?? [];
  }

  getRSI(period: number): (number | null)[] {
    return this.cache.get(`rsi:{"period":${period}}`) ?? [];
  }

  getATR(period: number): (number | null)[] {
    return this.cache.get(`atr:{"period":${period}}`) ?? [];
  }

  getStochastic(period = 14, smoothK = 3): Record<string, (number | null)[]> {
    return this.multiCache.get(`multi:stoch:{"period":${period},"smoothK":${smoothK}}`) ?? {};
  }

  getDMI(period = 14): Record<string, (number | null)[]> {
    return this.multiCache.get(`multi:dmi:{"period":${period}}`) ?? {};
  }

  getMACD(fast = 12, slow = 26, signal = 9): Record<string, (number | null)[]> {
    return this.multiCache.get(`multi:macd:{"fastPeriod":${fast},"slowPeriod":${slow},"signalPeriod":${signal}}`) ?? {};
  }

  getSupertrend(multiplier = 3, period = 10): Record<string, (number | null)[]> {
    return this.multiCache.get(`multi:supertrend:{"multiplier":${multiplier},"period":${period}}`) ?? {};
  }

  getBB(period = 20, stdDev = 2): Record<string, (number | null)[]> {
    return this.multiCache.get(`multi:bb:{"period":${period},"stdDev":${stdDev}}`) ?? {};
  }
}
