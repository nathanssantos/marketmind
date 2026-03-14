import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';
import { calculateADX } from './adx';
import { calculateEMA } from './movingAverages';
import { calculateRSI } from './rsi';

const DEFAULT_ADX_PERIOD = 14;
const DEFAULT_ADX_THRESHOLD = 25;
const DEFAULT_EMA_PERIOD = 21;
const DEFAULT_EMA_CONFIRM_BARS = 3;
const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_RSI_LOWER_BOUND = 30;
const DEFAULT_RSI_UPPER_BOUND = 70;
const MIN_KLINES_REQUIRED = 50;

export interface TrendAlignmentConfig {
  adxPeriod?: number;
  adxThreshold?: number;
  emaPeriod?: number;
  emaConfirmBars?: number;
  rsiPeriod?: number;
  rsiLowerBound?: number;
  rsiUpperBound?: number;
}

export interface TrendInfo {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isClearTrend: boolean;
  strength: number;
  adx: number;
  priceVsEma: 'ABOVE' | 'BELOW' | 'CROSSING';
  rsi: number;
}

export interface TrendAlignmentResult {
  asset: TrendInfo;
  btc: TrendInfo;
  isAligned: boolean;
  alignmentScore: number;
  recommendation: 'TRADE' | 'SKIP' | 'CAUTION';
  reason: string;
}

export const TREND_ALIGNMENT_DEFAULTS = {
  ADX_PERIOD: DEFAULT_ADX_PERIOD,
  ADX_THRESHOLD: DEFAULT_ADX_THRESHOLD,
  EMA_PERIOD: DEFAULT_EMA_PERIOD,
  EMA_CONFIRM_BARS: DEFAULT_EMA_CONFIRM_BARS,
  RSI_PERIOD: DEFAULT_RSI_PERIOD,
  RSI_LOWER_BOUND: DEFAULT_RSI_LOWER_BOUND,
  RSI_UPPER_BOUND: DEFAULT_RSI_UPPER_BOUND,
  MIN_KLINES: MIN_KLINES_REQUIRED,
} as const;

const getRequiredConfig = (config: TrendAlignmentConfig) => ({
  adxPeriod: config.adxPeriod ?? DEFAULT_ADX_PERIOD,
  adxThreshold: config.adxThreshold ?? DEFAULT_ADX_THRESHOLD,
  emaPeriod: config.emaPeriod ?? DEFAULT_EMA_PERIOD,
  emaConfirmBars: config.emaConfirmBars ?? DEFAULT_EMA_CONFIRM_BARS,
  rsiPeriod: config.rsiPeriod ?? DEFAULT_RSI_PERIOD,
  rsiLowerBound: config.rsiLowerBound ?? DEFAULT_RSI_LOWER_BOUND,
  rsiUpperBound: config.rsiUpperBound ?? DEFAULT_RSI_UPPER_BOUND,
});

const createNeutralTrendInfo = (): TrendInfo => ({
  direction: 'NEUTRAL',
  isClearTrend: false,
  strength: 0,
  adx: 0,
  priceVsEma: 'CROSSING',
  rsi: 50,
});

export const analyzeTrend = (
  klines: Kline[],
  config: TrendAlignmentConfig = {},
): TrendInfo => {
  const cfg = getRequiredConfig(config);
  const minRequired = cfg.adxPeriod * 2;

  if (klines.length < minRequired) return createNeutralTrendInfo();

  const adxResult = calculateADX(klines, cfg.adxPeriod);
  const emaValues = calculateEMA(klines, cfg.emaPeriod);
  const rsiResult = calculateRSI(klines, cfg.rsiPeriod);

  const lastAdx = adxResult.adx[adxResult.adx.length - 1];
  const lastEma = emaValues[emaValues.length - 1];
  const lastRsi = rsiResult.values[rsiResult.values.length - 1];
  const currentPrice = getKlineClose(klines[klines.length - 1]!);

  if (lastAdx === null || lastEma === null || lastRsi === null) {
    return createNeutralTrendInfo();
  }

  const recentKlines = klines.slice(-cfg.emaConfirmBars);
  const recentEma = emaValues.slice(-cfg.emaConfirmBars);

  const allAbove = recentKlines.every((k, i) => {
    const emaValue = recentEma[i];
    return emaValue !== null && emaValue !== undefined && getKlineClose(k) > emaValue;
  });

  const allBelow = recentKlines.every((k, i) => {
    const emaValue = recentEma[i];
    return emaValue !== null && emaValue !== undefined && getKlineClose(k) < emaValue;
  });

  const priceVsEma: 'ABOVE' | 'BELOW' | 'CROSSING' =
    allAbove ? 'ABOVE' : allBelow ? 'BELOW' : 'CROSSING';

  const adxValue = lastAdx ?? 0;
  const isClearTrend = adxValue >= cfg.adxThreshold && priceVsEma !== 'CROSSING';

  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (isClearTrend) {
    direction = priceVsEma === 'ABOVE' ? 'BULLISH' : 'BEARISH';
  }

  const emaValue = lastEma ?? currentPrice;
  const emaDistance = Math.abs(currentPrice - emaValue) / emaValue * 100;
  const strength = Math.min(100, (adxValue / 50 * 50) + (emaDistance * 10));

  return {
    direction,
    isClearTrend,
    strength,
    adx: adxValue,
    priceVsEma,
    rsi: lastRsi ?? 50,
  };
};

export const checkTrendAlignment = (
  assetKlines: Kline[],
  btcKlines: Kline[],
  config: TrendAlignmentConfig = {},
): TrendAlignmentResult => {
  const cfg = getRequiredConfig(config);

  const asset = analyzeTrend(assetKlines, cfg);
  const btc = analyzeTrend(btcKlines, cfg);

  const isDirectionAligned = asset.direction === btc.direction;
  const bothHaveClearTrend = asset.isClearTrend && btc.isClearTrend;
  const isAligned = isDirectionAligned && bothHaveClearTrend;

  let alignmentScore = 50;
  if (isDirectionAligned) alignmentScore += 20;
  if (bothHaveClearTrend) alignmentScore += 20;
  if (asset.rsi > cfg.rsiLowerBound && asset.rsi < cfg.rsiUpperBound) alignmentScore += 10;

  let recommendation: 'TRADE' | 'SKIP' | 'CAUTION';
  let reason: string;

  if (!btc.isClearTrend) {
    recommendation = 'CAUTION';
    reason = `BTC no clear trend (ADX: ${btc.adx.toFixed(1)})`;
  } else if (!asset.isClearTrend) {
    recommendation = 'SKIP';
    reason = `Asset no clear trend (ADX: ${asset.adx.toFixed(1)})`;
  } else if (!isDirectionAligned) {
    recommendation = 'SKIP';
    reason = `Opposite trend to BTC (Asset: ${asset.direction}, BTC: ${btc.direction})`;
  } else if (asset.rsi < cfg.rsiLowerBound || asset.rsi > cfg.rsiUpperBound) {
    recommendation = 'CAUTION';
    reason = `RSI at extreme (${asset.rsi.toFixed(1)})`;
  } else {
    recommendation = 'TRADE';
    reason = `Aligned with BTC ${btc.direction}`;
  }

  return {
    asset,
    btc,
    isAligned,
    alignmentScore,
    recommendation,
    reason,
  };
};

export const isTrendingMarket = (
  klines: Kline[],
  adxThreshold: number = DEFAULT_ADX_THRESHOLD,
): boolean => {
  const trend = analyzeTrend(klines, { adxThreshold });
  return trend.isClearTrend;
};

export const getTrendDirection = (
  klines: Kline[],
  config: TrendAlignmentConfig = {},
): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
  const trend = analyzeTrend(klines, config);
  return trend.direction;
};
