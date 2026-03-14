import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';
import { calculateADX } from './adx';
import { calculateEMA } from './movingAverages';
import { calculateSupertrend } from './supertrend';
import { calculateMACD } from './macd';
import { calculateRSI } from './rsi';

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TrendMethod = 'ema' | 'adx' | 'supertrend' | 'combined' | 'macd';

export interface TrendDetectionResult {
  direction: TrendDirection;
  isClearTrend: boolean;
  strength: number;
  method: TrendMethod;
  details: TrendDetails;
}

export interface TrendDetails {
  ema?: { value: number; period: number; pricePosition: 'above' | 'below' | 'crossing' };
  adx?: { value: number; plusDI: number; minusDI: number; isStrong: boolean };
  supertrend?: { value: number; trend: 'up' | 'down' };
  macd?: { histogram: number; signal: number; macdLine: number };
  rsi?: { value: number };
  price: number;
}

export interface TrendCoreConfig {
  method: TrendMethod;
  emaPeriod?: number;
  emaConfirmBars?: number;
  adxPeriod?: number;
  adxThreshold?: number;
  supertrendPeriod?: number;
  supertrendMultiplier?: number;
  rsiPeriod?: number;
}

export const TREND_CORE_DEFAULTS = {
  EMA_PERIOD: 21,
  EMA_CONFIRM_BARS: 3,
  ADX_PERIOD: 14,
  ADX_THRESHOLD: 25,
  SUPERTREND_PERIOD: 10,
  SUPERTREND_MULTIPLIER: 3,
  RSI_PERIOD: 14,
  MIN_KLINES: 50,
} as const;

const createNeutralResult = (method: TrendMethod, price: number): TrendDetectionResult => ({
  direction: 'NEUTRAL',
  isClearTrend: false,
  strength: 0,
  method,
  details: { price },
});

export const detectTrendByEMA = (
  klines: Kline[],
  period: number = TREND_CORE_DEFAULTS.EMA_PERIOD,
  confirmBars: number = TREND_CORE_DEFAULTS.EMA_CONFIRM_BARS,
): TrendDetectionResult => {
  const minRequired = Math.max(period + confirmBars, 10);
  const lastKline = klines[klines.length - 1];
  const price = lastKline ? getKlineClose(lastKline) : 0;

  if (klines.length < minRequired) return createNeutralResult('ema', price);

  const emaValues = calculateEMA(klines, period);
  const lastEma = emaValues[emaValues.length - 1];

  if (lastEma === null || lastEma === undefined) return createNeutralResult('ema', price);

  const recentKlines = klines.slice(-confirmBars);
  const recentEma = emaValues.slice(-confirmBars);

  const allAbove = recentKlines.every((k, i) => {
    const emaValue = recentEma[i];
    return emaValue !== null && emaValue !== undefined && getKlineClose(k) > emaValue;
  });

  const allBelow = recentKlines.every((k, i) => {
    const emaValue = recentEma[i];
    return emaValue !== null && emaValue !== undefined && getKlineClose(k) < emaValue;
  });

  const pricePosition: 'above' | 'below' | 'crossing' =
    allAbove ? 'above' : allBelow ? 'below' : 'crossing';

  const isClearTrend = pricePosition !== 'crossing';
  const direction: TrendDirection = allAbove ? 'BULLISH' : allBelow ? 'BEARISH' : 'NEUTRAL';

  const emaDistance = Math.abs(price - lastEma) / lastEma * 100;
  const strength = Math.min(100, emaDistance * 20);

  return {
    direction,
    isClearTrend,
    strength,
    method: 'ema',
    details: {
      price,
      ema: { value: lastEma, period, pricePosition },
    },
  };
};

export const detectTrendByADX = (
  klines: Kline[],
  period: number = TREND_CORE_DEFAULTS.ADX_PERIOD,
  threshold: number = TREND_CORE_DEFAULTS.ADX_THRESHOLD,
): TrendDetectionResult => {
  const minRequired = period * 2 + 7;
  const lastKline = klines[klines.length - 1];
  const price = lastKline ? getKlineClose(lastKline) : 0;

  if (klines.length < minRequired) return createNeutralResult('adx', price);

  const adxResult = calculateADX(klines, period);
  const lastIdx = adxResult.adx.length - 1;
  const adx = adxResult.adx[lastIdx];
  const plusDI = adxResult.plusDI[lastIdx];
  const minusDI = adxResult.minusDI[lastIdx];

  if (adx === null || adx === undefined ||
      plusDI === null || plusDI === undefined ||
      minusDI === null || minusDI === undefined) {
    return createNeutralResult('adx', price);
  }

  const adxValue = adx;
  const plusDIValue = plusDI;
  const minusDIValue = minusDI;

  const isStrong = adxValue >= threshold;
  const isBullish = plusDIValue > minusDIValue;
  const isBearish = minusDIValue > plusDIValue;
  const isClearTrend = isStrong && (isBullish || isBearish);

  let direction: TrendDirection = 'NEUTRAL';
  if (isClearTrend) {
    direction = isBullish ? 'BULLISH' : 'BEARISH';
  }

  const strength = Math.min(100, (adxValue / 50) * 100);

  return {
    direction,
    isClearTrend,
    strength,
    method: 'adx',
    details: {
      price,
      adx: { value: adxValue, plusDI: plusDIValue, minusDI: minusDIValue, isStrong },
    },
  };
};

export const detectTrendBySuperTrend = (
  klines: Kline[],
  period: number = TREND_CORE_DEFAULTS.SUPERTREND_PERIOD,
  multiplier: number = TREND_CORE_DEFAULTS.SUPERTREND_MULTIPLIER,
): TrendDetectionResult => {
  const lastKline = klines[klines.length - 1];
  const price = lastKline ? getKlineClose(lastKline) : 0;

  if (klines.length < period) return createNeutralResult('supertrend', price);

  const result = calculateSupertrend(klines, period, multiplier);
  const lastIdx = result.trend.length - 1;
  const trend = result.trend[lastIdx];
  const value = result.value[lastIdx];

  if (trend === null || trend === undefined ||
      value === null || value === undefined) {
    return createNeutralResult('supertrend', price);
  }

  const trendValue = trend;
  const stValue = value;

  const direction: TrendDirection = trendValue === 'up' ? 'BULLISH' : trendValue === 'down' ? 'BEARISH' : 'NEUTRAL';
  const isClearTrend = trendValue !== null;

  const distance = Math.abs(price - stValue) / stValue * 100;
  const strength = Math.min(100, distance * 10);

  return {
    direction,
    isClearTrend,
    strength,
    method: 'supertrend',
    details: {
      price,
      supertrend: { value: stValue, trend: trendValue as 'up' | 'down' },
    },
  };
};

export const detectTrendByMACD = (klines: Kline[]): TrendDetectionResult => {
  const lastKline = klines[klines.length - 1];
  const price = lastKline ? getKlineClose(lastKline) : 0;

  if (klines.length < 35) return createNeutralResult('macd', price);

  const macdResult = calculateMACD(klines);
  const lastIdx = macdResult.histogram.length - 1;
  const histogram = macdResult.histogram[lastIdx];
  const signal = macdResult.signal[lastIdx];
  const macdLine = macdResult.macd[lastIdx];

  if (histogram === null || histogram === undefined ||
      signal === null || signal === undefined ||
      macdLine === null || macdLine === undefined) {
    return createNeutralResult('macd', price);
  }

  const prevHistogram = macdResult.histogram[lastIdx - 1] ?? null;
  const histogramValue = histogram;
  const isBullish = histogramValue > 0 && (prevHistogram === null || histogramValue > prevHistogram);
  const isBearish = histogramValue < 0 && (prevHistogram === null || histogramValue < prevHistogram);

  const direction: TrendDirection = isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';
  const isClearTrend = Math.abs(histogramValue) > 0.001;
  const strength = Math.min(100, Math.abs(histogramValue) * 1000);

  return {
    direction,
    isClearTrend,
    strength,
    method: 'macd',
    details: {
      price,
      macd: { histogram: histogramValue, signal, macdLine },
    },
  };
};

export const detectTrendCombined = (
  klines: Kline[],
  config: Partial<TrendCoreConfig> = {},
): TrendDetectionResult => {
  const emaPeriod = config.emaPeriod ?? TREND_CORE_DEFAULTS.EMA_PERIOD;
  const adxPeriod = config.adxPeriod ?? TREND_CORE_DEFAULTS.ADX_PERIOD;
  const adxThreshold = config.adxThreshold ?? TREND_CORE_DEFAULTS.ADX_THRESHOLD;
  const rsiPeriod = config.rsiPeriod ?? TREND_CORE_DEFAULTS.RSI_PERIOD;

  const lastKline = klines[klines.length - 1];
  const price = lastKline ? getKlineClose(lastKline) : 0;

  const minRequired = Math.max(emaPeriod, adxPeriod * 2 + 7, rsiPeriod + 1);
  if (klines.length < minRequired) return createNeutralResult('combined', price);

  const emaResult = detectTrendByEMA(klines, emaPeriod);
  const adxResult = detectTrendByADX(klines, adxPeriod, adxThreshold);

  const rsiResult = calculateRSI(klines, rsiPeriod);
  const rsi = rsiResult.values[rsiResult.values.length - 1] ?? 50;

  const emaDirection = emaResult.direction;
  const adxDirection = adxResult.direction;
  const adxStrong = adxResult.details.adx?.isStrong ?? false;

  let direction: TrendDirection = 'NEUTRAL';
  let isClearTrend = false;

  if (emaDirection === adxDirection && emaDirection !== 'NEUTRAL' && adxStrong) {
    direction = emaDirection;
    isClearTrend = true;
  } else if (adxStrong && adxDirection !== 'NEUTRAL') {
    direction = adxDirection;
    isClearTrend = true;
  } else if (emaResult.isClearTrend) {
    direction = emaDirection;
    isClearTrend = false;
  }

  const strength = (emaResult.strength + adxResult.strength) / 2;

  return {
    direction,
    isClearTrend,
    strength,
    method: 'combined',
    details: {
      price,
      ema: emaResult.details.ema,
      adx: adxResult.details.adx,
      rsi: { value: rsi },
    },
  };
};

export const detectTrend = (
  klines: Kline[],
  config: TrendCoreConfig = { method: 'combined' },
): TrendDetectionResult => {
  switch (config.method) {
    case 'ema':
      return detectTrendByEMA(
        klines,
        config.emaPeriod ?? TREND_CORE_DEFAULTS.EMA_PERIOD,
        config.emaConfirmBars ?? TREND_CORE_DEFAULTS.EMA_CONFIRM_BARS,
      );
    case 'adx':
      return detectTrendByADX(
        klines,
        config.adxPeriod ?? TREND_CORE_DEFAULTS.ADX_PERIOD,
        config.adxThreshold ?? TREND_CORE_DEFAULTS.ADX_THRESHOLD,
      );
    case 'supertrend':
      return detectTrendBySuperTrend(
        klines,
        config.supertrendPeriod ?? TREND_CORE_DEFAULTS.SUPERTREND_PERIOD,
        config.supertrendMultiplier ?? TREND_CORE_DEFAULTS.SUPERTREND_MULTIPLIER,
      );
    case 'macd':
      return detectTrendByMACD(klines);
    case 'combined':
    default:
      return detectTrendCombined(klines, config);
  }
};

export const isTrendAllowingDirection = (
  trend: TrendDetectionResult,
  direction: 'LONG' | 'SHORT',
): boolean => {
  if (!trend.isClearTrend) return true;
  if (direction === 'LONG') return trend.direction === 'BULLISH';
  if (direction === 'SHORT') return trend.direction === 'BEARISH';
  return true;
};

export const formatTrendResult = (result: TrendDetectionResult): string => {
  const { direction, isClearTrend, strength, method, details } = result;
  const parts: string[] = [
    `${direction} (${method})`,
    `clear=${isClearTrend}`,
    `strength=${strength.toFixed(1)}`,
  ];

  if (details.ema) parts.push(`EMA${details.ema.period}=${details.ema.value.toFixed(2)}`);
  if (details.adx) parts.push(`ADX=${details.adx.value.toFixed(1)}`);
  if (details.supertrend) parts.push(`ST=${details.supertrend.trend}`);
  if (details.rsi) parts.push(`RSI=${details.rsi.value.toFixed(1)}`);

  return parts.join(' | ');
};
