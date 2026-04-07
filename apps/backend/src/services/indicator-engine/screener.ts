import type { Kline, ScreenerIndicatorId } from '@marketmind/types';

import {
  calculateBollingerBands,
  calculateChoppiness,
  calculateCMF,
  calculateVolumeRatio,
} from '@marketmind/indicators';

import { PineIndicatorService } from '../pine/PineIndicatorService';
import type { ScreenerExtraData, ScreenerTickerData } from './types';

const pineService = new PineIndicatorService();

type ScreenerAsyncEvalFn = (
  klines: Kline[],
  params: Record<string, number>,
  ticker?: ScreenerTickerData,
  extra?: ScreenerExtraData,
) => Promise<number | null>;

const getLastNonNull = (values: (number | null)[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

const parseClose = (kline: Kline): number => parseFloat(String(kline.close));

const computeCorrelation = (xReturns: number[], yReturns: number[]): number | null => {
  const n = Math.min(xReturns.length, yReturns.length);
  if (n < 5) return null;

  const x = xReturns.slice(-n);
  const y = yReturns.slice(-n);

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return null;
  return sumXY / denom;
};

const getReturns = (klines: Kline[], period: number): number[] => {
  const closes = klines.slice(-period - 1).map(parseClose);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] === 0) continue;
    returns.push((closes[i]! - closes[i - 1]!) / closes[i - 1]!);
  }
  return returns;
};

export const SCREENER_KLINE_EVALUATORS: Partial<Record<ScreenerIndicatorId, ScreenerAsyncEvalFn>> = {
  RSI: async (klines, params) => {
    const values = await pineService.compute('rsi', klines, { period: params['period'] ?? 14 });
    return getLastNonNull(values);
  },

  ADX: async (klines, params) => {
    const result = await pineService.computeMulti('dmi', klines, { period: params['period'] ?? 14 });
    return getLastNonNull(result['adx'] ?? []);
  },

  EMA: async (klines, params) => {
    const values = await pineService.compute('ema', klines, { period: params['period'] ?? 21 });
    return getLastNonNull(values);
  },

  SMA: async (klines, params) => {
    const values = await pineService.compute('sma', klines, { period: params['period'] ?? 20 });
    return getLastNonNull(values);
  },

  MACD_HISTOGRAM: async (klines) => {
    const result = await pineService.computeMulti('macd', klines);
    return getLastNonNull(result['histogram'] ?? []);
  },

  MACD_SIGNAL: async (klines) => {
    const result = await pineService.computeMulti('macd', klines);
    return getLastNonNull(result['signal'] ?? []);
  },

  BOLLINGER_WIDTH: async (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    if (!bb || bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
  },

  BOLLINGER_UPPER: async (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    return bb?.upper ?? null;
  },

  BOLLINGER_LOWER: async (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    return bb?.lower ?? null;
  },

  ATR: async (klines, params) => {
    const values = await pineService.compute('atr', klines, { period: params['period'] ?? 14 });
    return getLastNonNull(values);
  },

  ATR_PERCENT: async (klines, params) => {
    const values = await pineService.compute('atr', klines, { period: params['period'] ?? 14 });
    const atr = getLastNonNull(values);
    if (atr === null || klines.length === 0) return null;
    const close = parseClose(klines[klines.length - 1]!);
    if (close === 0) return null;
    return (atr / close) * 100;
  },

  STOCHASTIC_K: async (klines, params) => {
    const result = await pineService.computeMulti('stoch', klines, {
      period: params['period'] ?? 14,
      smoothK: params['kSmoothing'] ?? 3,
    });
    return getLastNonNull(result['k'] ?? []);
  },

  STOCHASTIC_D: async (klines, params) => {
    const result = await pineService.computeMulti('stoch', klines, {
      period: params['period'] ?? 14,
      smoothK: params['kSmoothing'] ?? 3,
    });
    return getLastNonNull(result['d'] ?? []);
  },

  CCI: async (klines, params) => {
    const values = await pineService.compute('cci', klines, { period: params['period'] ?? 20 });
    return getLastNonNull(values);
  },

  MFI: async (klines, params) => {
    const values = await pineService.compute('mfi', klines, { period: params['period'] ?? 14 });
    return getLastNonNull(values);
  },

  CMF: async (klines, params) => {
    const result = calculateCMF(klines, params['period'] ?? 20);
    return getLastNonNull(result.values);
  },

  OBV: async (klines) => {
    const values = await pineService.compute('obv', klines);
    return values.length > 0 ? (values[values.length - 1] ?? null) : null;
  },

  VWAP: async (klines) => {
    const values = await pineService.compute('vwap', klines);
    return values.length > 0 ? (values[values.length - 1] ?? null) : null;
  },

  ROC: async (klines, params) => {
    const values = await pineService.compute('roc', klines, { period: params['period'] ?? 12 });
    return getLastNonNull(values);
  },

  WILLIAMS_R: async (klines, params) => {
    const values = await pineService.compute('wpr', klines, { period: params['period'] ?? 14 });
    return getLastNonNull(values);
  },

  CHOPPINESS: async (klines, params) => {
    const values = calculateChoppiness(klines, params['period'] ?? 14);
    const lastValid = values.length > 0 ? values[values.length - 1] : null;
    return lastValid !== undefined && lastValid !== null && !isNaN(lastValid) ? lastValid : null;
  },

  TSI: async (klines) => {
    const values = await pineService.compute('tsi', klines);
    return getLastNonNull(values);
  },

  SUPERTREND: async (klines, params) => {
    const result = await pineService.computeMulti('supertrend', klines, {
      period: params['period'] ?? 10,
      multiplier: params['multiplier'] ?? 3,
    });
    return getLastNonNull(result['value'] ?? []);
  },

  PRICE_CLOSE: async (klines) => {
    if (klines.length === 0) return null;
    return parseClose(klines[klines.length - 1]!);
  },

  VOLUME_RATIO: async (klines, params) => {
    if (klines.length === 0) return null;
    return calculateVolumeRatio(klines, klines.length - 1, params['period'] ?? 20);
  },

  BTC_CORRELATION: async (klines, params, _ticker, extra) => {
    if (!extra?.btcKlines || extra.btcKlines.length === 0) return null;
    const period = params['period'] ?? 30;
    const assetReturns = getReturns(klines, period);
    const btcReturns = getReturns(extra.btcKlines, period);
    return computeCorrelation(assetReturns, btcReturns);
  },
};

export const SCREENER_TICKER_EVALUATORS: Partial<Record<ScreenerIndicatorId, ScreenerAsyncEvalFn>> = {
  PRICE_CHANGE_24H: async (_klines, _params, ticker) => ticker?.priceChange ?? null,
  PRICE_CHANGE_PERCENT_24H: async (_klines, _params, ticker) => ticker?.priceChangePercent ?? null,
  VOLUME_24H: async (_klines, _params, ticker) => ticker?.volume ?? null,
  QUOTE_VOLUME_24H: async (_klines, _params, ticker) => ticker?.quoteVolume ?? null,
  MARKET_CAP_RANK: async (_klines, _params, _ticker, extra) => extra?.marketCapRank ?? null,
  FUNDING_RATE: async (_klines, _params, _ticker, extra) => extra?.fundingRate ?? null,
};

export const TICKER_BASED_INDICATORS: Set<ScreenerIndicatorId> = new Set([
  'PRICE_CHANGE_24H',
  'PRICE_CHANGE_PERCENT_24H',
  'VOLUME_24H',
  'QUOTE_VOLUME_24H',
  'MARKET_CAP_RANK',
  'FUNDING_RATE',
]);

export const isTickerBasedIndicator = (id: ScreenerIndicatorId): boolean =>
  TICKER_BASED_INDICATORS.has(id);
