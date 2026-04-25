import type { Interval, MarketType } from '@marketmind/types';
import { logger } from './logger';

export type WeightingMethod = 'EQUAL' | 'MARKET_CAP' | 'CAPPED_MARKET_CAP' | 'SQRT_MARKET_CAP' | 'MANUAL';

export interface ComponentState {
  id: number;
  symbol: string;
  marketType: MarketType;
  coingeckoId: string | null;
  weight: number;
  basePrice: number;
  currentPrice: number;
}

export interface CustomSymbolState {
  id: number;
  symbol: string;
  name: string;
  baseValue: number;
  weightingMethod: WeightingMethod;
  capPercent: number | null;
  rebalanceIntervalDays: number;
  lastRebalancedAt: Date | null;
  components: ComponentState[];
}

export const COINGECKO_CACHE_TTL_MS = 5 * 60 * 1000;
export const KLINE_INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

let marketCapCache: { data: Map<string, number>; timestamp: number } | null = null;

const applyCap = (weights: number[], cap: number): number[] => {
  const result = [...weights];
  for (let iter = 0; iter < 20; iter++) {
    let excess = 0;
    let uncappedCount = 0;
    for (const w of result) {
      if (w >= cap) excess += w - cap;
      else uncappedCount++;
    }
    if (excess < 0.0001 || uncappedCount === 0) break;
    for (let i = 0; i < result.length; i++) {
      if (result[i]! >= cap) result[i] = cap;
      else result[i] = result[i]! + excess / uncappedCount;
    }
  }
  return result;
};

export const computeWeights = (
  method: WeightingMethod,
  marketCaps: number[],
  capPercent?: number
): number[] => {
  if (method === 'EQUAL') return marketCaps.map(() => 1 / marketCaps.length);

  const raw = method === 'SQRT_MARKET_CAP'
    ? marketCaps.map(Math.sqrt)
    : [...marketCaps];

  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 0) return marketCaps.map(() => 1 / marketCaps.length);

  let weights = raw.map(v => v / total);

  if (method === 'CAPPED_MARKET_CAP' && capPercent) {
    weights = applyCap(weights, capPercent / 100);
  }
  return weights;
};

export const fetchMarketCaps = async (coingeckoIds: string[]): Promise<Map<string, number>> => {
  if (marketCapCache && Date.now() - marketCapCache.timestamp < COINGECKO_CACHE_TTL_MS) {
    const allFound = coingeckoIds.every(id => marketCapCache!.data.has(id));
    if (allFound) return marketCapCache.data;
  }

  const ids = coingeckoIds.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1`;
  const response = await fetch(url);

  if (!response.ok) {
    logger.warn({ status: response.status }, 'CoinGecko API request failed');
    return new Map();
  }

  const data = await response.json() as Array<{ id: string; market_cap: number }>;
  const result = new Map(data.map(coin => [coin.id, coin.market_cap ?? 0]));
  marketCapCache = { data: result, timestamp: Date.now() };
  return result;
};

export const fetchBinancePrice = async (symbol: string): Promise<number> => {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  const response = await fetch(url);
  if (!response.ok) {
    const futuresUrl = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`;
    const futuresResponse = await fetch(futuresUrl);
    if (!futuresResponse.ok) throw new Error(`Failed to fetch price for ${symbol}`);
    const futuresData = await futuresResponse.json() as { price: string };
    return parseFloat(futuresData.price);
  }
  const data = await response.json() as { price: string };
  return parseFloat(data.price);
};

export const computeIndexPrice = (state: CustomSymbolState): number => {
  let sum = 0;
  for (const c of state.components) {
    if (c.basePrice <= 0 || c.currentPrice <= 0) continue;
    sum += c.weight * (c.currentPrice / c.basePrice);
  }
  return state.baseValue * sum;
};

export const mapDbComponentToState = (c: {
  id: number;
  symbol: string;
  marketType: string;
  coingeckoId: string | null;
  weight: string;
  basePrice: string | null;
}): ComponentState => ({
  id: c.id,
  symbol: c.symbol,
  marketType: c.marketType as MarketType,
  coingeckoId: c.coingeckoId,
  weight: parseFloat(c.weight),
  basePrice: c.basePrice ? parseFloat(c.basePrice) : 0,
  currentPrice: 0,
});

export const mapDbSymbolToState = (
  cs: {
    id: number;
    symbol: string;
    name: string;
    baseValue: string;
    weightingMethod: string;
    capPercent: string | null;
    rebalanceIntervalDays: number | null;
    lastRebalancedAt: Date | null;
  },
  components: ComponentState[]
): CustomSymbolState => ({
  id: cs.id,
  symbol: cs.symbol,
  name: cs.name,
  baseValue: parseFloat(cs.baseValue),
  weightingMethod: cs.weightingMethod as WeightingMethod,
  capPercent: cs.capPercent ? parseFloat(cs.capPercent) : null,
  rebalanceIntervalDays: cs.rebalanceIntervalDays ?? 30,
  lastRebalancedAt: cs.lastRebalancedAt,
  components,
});
