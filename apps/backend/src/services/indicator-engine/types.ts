import type {
  ComputedIndicator,
  IndicatorType,
  Kline,
} from '@marketmind/types';

import type { FundingRateData, LiquidationData, OpenInterestData } from '@marketmind/indicators';

export interface CryptoData {
  fundingRate: FundingRateData[];
  openInterest: OpenInterestData[];
  liquidations: LiquidationData[];
  baseAssetCloses?: number[];
  btcDominance?: number | null;
}

export interface ScreenerTickerData {
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  volume: number;
  quoteVolume: number;
}

export interface ScreenerExtraData {
  marketCapRank?: number | null;
  btcKlines?: Kline[];
  fundingRate?: number | null;
}

export type IndicatorComputeHandler = (
  klines: Kline[],
  resolvedParams: Record<string, number | string>,
) => ComputedIndicator;

export type CryptoIndicatorHandler = (
  klines: Kline[],
  resolvedParams: Record<string, number | string>,
  cryptoData: CryptoData,
) => ComputedIndicator | null;

export type ScreenerEvalFn = (
  klines: Kline[],
  params: Record<string, number>,
  ticker?: ScreenerTickerData,
  extra?: ScreenerExtraData,
) => number | null;

export const MAX_CACHE_SIZE = 100;
export const MAX_SINGLE_CACHE_SIZE = 500;
export const MAX_CRYPTO_CACHE_SIZE = 50;

export const toNumber = (value: string | number | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  return typeof value === 'string' ? parseFloat(value) : value;
};

export type IndicatorHandlerMap = Record<
  IndicatorType,
  IndicatorComputeHandler
>;

export type CryptoHandlerMap = Partial<Record<IndicatorType, CryptoIndicatorHandler>>;
