import type { Kline, ScreenerIndicatorId } from '@marketmind/types';

import {
  calculateADX,
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateCMF,
  calculateChoppiness,
  calculateEMA,
  calculateMACD,
  calculateMFI,
  calculateOBV,
  calculateROC,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateSupertrend,
  calculateTSI,
  calculateVolumeRatio,
  calculateVWAP,
  calculateWilliamsR,
} from '@marketmind/indicators';

import type { ScreenerEvalFn } from './types';

const getLastNonNull = (values: (number | null)[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

const getLastValidNumber = (values: number[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) {
    if (!isNaN(values[i]!)) return values[i]!;
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

export const SCREENER_KLINE_EVALUATORS: Partial<Record<ScreenerIndicatorId, ScreenerEvalFn>> = {
  RSI: (klines, params) => {
    const result = calculateRSI(klines, params['period'] ?? 14);
    return getLastNonNull(result.values);
  },

  ADX: (klines, params) => {
    const result = calculateADX(klines, params['period'] ?? 14);
    return getLastNonNull(result.adx);
  },

  EMA: (klines, params) => {
    const values = calculateEMA(klines, params['period'] ?? 21);
    return getLastNonNull(values);
  },

  SMA: (klines, params) => {
    const values = calculateSMA(klines, params['period'] ?? 20);
    return getLastNonNull(values);
  },

  MACD_HISTOGRAM: (klines) => {
    const result = calculateMACD(klines);
    return getLastValidNumber(result.histogram);
  },

  MACD_SIGNAL: (klines) => {
    const result = calculateMACD(klines);
    return getLastValidNumber(result.signal);
  },

  BOLLINGER_WIDTH: (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    if (!bb || bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
  },

  BOLLINGER_UPPER: (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    return bb?.upper ?? null;
  },

  BOLLINGER_LOWER: (klines, params) => {
    const bb = calculateBollingerBands(klines, params['period'] ?? 20, params['stdDev'] ?? 2);
    return bb?.lower ?? null;
  },

  ATR: (klines, params) => {
    const values = calculateATR(klines, params['period'] ?? 14);
    return getLastValidNumber(values);
  },

  ATR_PERCENT: (klines, params) => {
    const values = calculateATR(klines, params['period'] ?? 14);
    const atr = getLastValidNumber(values);
    if (atr === null || klines.length === 0) return null;
    const close = parseClose(klines[klines.length - 1]!);
    if (close === 0) return null;
    return (atr / close) * 100;
  },

  STOCHASTIC_K: (klines, params) => {
    const result = calculateStochastic(klines, params['period'] ?? 14, params['kSmoothing'] ?? 3, params['dPeriod'] ?? 3);
    return getLastNonNull(result.k);
  },

  STOCHASTIC_D: (klines, params) => {
    const result = calculateStochastic(klines, params['period'] ?? 14, params['kSmoothing'] ?? 3, params['dPeriod'] ?? 3);
    return getLastNonNull(result.d);
  },

  CCI: (klines, params) => {
    const values = calculateCCI(klines, params['period'] ?? 20);
    return getLastNonNull(values as (number | null)[]);
  },

  MFI: (klines, params) => {
    const values = calculateMFI(klines, params['period'] ?? 14);
    return getLastNonNull(values as (number | null)[]);
  },

  CMF: (klines, params) => {
    const result = calculateCMF(klines, params['period'] ?? 20);
    return getLastNonNull(result.values);
  },

  OBV: (klines) => {
    const result = calculateOBV(klines);
    return result.values.length > 0 ? result.values[result.values.length - 1]! : null;
  },

  VWAP: (klines) => {
    const values = calculateVWAP(klines);
    return values.length > 0 ? values[values.length - 1]! : null;
  },

  ROC: (klines, params) => {
    const result = calculateROC(klines, params['period'] ?? 12);
    return getLastNonNull(result.values);
  },

  WILLIAMS_R: (klines, params) => {
    const values = calculateWilliamsR(klines, params['period'] ?? 14);
    return getLastNonNull(values as (number | null)[]);
  },

  CHOPPINESS: (klines, params) => {
    const values = calculateChoppiness(klines, params['period'] ?? 14);
    return getLastValidNumber(values);
  },

  TSI: (klines) => {
    const result = calculateTSI(klines);
    return getLastNonNull(result.tsi);
  },

  SUPERTREND: (klines, params) => {
    const result = calculateSupertrend(klines, params['period'] ?? 10, params['multiplier'] ?? 3);
    return getLastNonNull(result.value);
  },

  PRICE_CLOSE: (klines) => {
    if (klines.length === 0) return null;
    return parseClose(klines[klines.length - 1]!);
  },

  VOLUME_RATIO: (klines, params) => {
    if (klines.length === 0) return null;
    return calculateVolumeRatio(klines, klines.length - 1, params['period'] ?? 20);
  },

  BTC_CORRELATION: (klines, params, _ticker, extra) => {
    if (!extra?.btcKlines || extra.btcKlines.length === 0) return null;
    const period = params['period'] ?? 30;
    const assetReturns = getReturns(klines, period);
    const btcReturns = getReturns(extra.btcKlines, period);
    return computeCorrelation(assetReturns, btcReturns);
  },
};

export const SCREENER_TICKER_EVALUATORS: Partial<Record<ScreenerIndicatorId, ScreenerEvalFn>> = {
  PRICE_CHANGE_24H: (_klines, _params, ticker) => ticker?.priceChange ?? null,
  PRICE_CHANGE_PERCENT_24H: (_klines, _params, ticker) => ticker?.priceChangePercent ?? null,
  VOLUME_24H: (_klines, _params, ticker) => ticker?.volume ?? null,
  QUOTE_VOLUME_24H: (_klines, _params, ticker) => ticker?.quoteVolume ?? null,
  MARKET_CAP_RANK: (_klines, _params, _ticker, extra) => extra?.marketCapRank ?? null,
  FUNDING_RATE: (_klines, _params, _ticker, extra) => extra?.fundingRate ?? null,
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
