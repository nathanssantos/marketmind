import { calculateADX, calculateATR } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const ADX_PERIOD = 14;
const ATR_PERIOD = 14;
const STRONG_TREND_THRESHOLD = 25;
const WEAK_TREND_THRESHOLD = 20;
const ATR_LOOKBACK = 100;
const MIN_KLINES_REQUIRED = 35;

export const MARKET_REGIME_FILTER = {
  ADX_PERIOD,
  ATR_PERIOD,
  STRONG_TREND_THRESHOLD,
  WEAK_TREND_THRESHOLD,
  ATR_LOOKBACK,
  MIN_KLINES_REQUIRED,
} as const;

export type MarketRegime = 'TRENDING' | 'WEAK_TREND' | 'RANGING' | 'VOLATILE';
export type StrategyType = 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'ANY';
export type VolatilityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export interface MarketRegimeResult {
  isAllowed: boolean;
  regime: MarketRegime;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  atr: number | null;
  atrPercentile: number | null;
  volatilityLevel: VolatilityLevel;
  recommendedStrategy: StrategyType;
  reason: string;
}

const SETUP_STRATEGY_MAP: Record<string, StrategyType> = {
  'larry-williams-9.1': 'TREND_FOLLOWING',
  'larry-williams-9.2': 'TREND_FOLLOWING',
  'larry-williams-9.3': 'TREND_FOLLOWING',
  'larry-williams-9.4': 'TREND_FOLLOWING',
  'ema9-pullback': 'TREND_FOLLOWING',
  'ema9-double-pullback': 'TREND_FOLLOWING',
  'ema9-continuation': 'TREND_FOLLOWING',
  'oversold-bounce': 'MEAN_REVERSION',
  'overbought-fade': 'MEAN_REVERSION',
  'support-bounce': 'MEAN_REVERSION',
  'resistance-fade': 'MEAN_REVERSION',
  'breakout-long': 'TREND_FOLLOWING',
  'breakout-short': 'TREND_FOLLOWING',
  'trend-continuation': 'TREND_FOLLOWING',
};

export const getSetupStrategyType = (setupType: string): StrategyType => {
  return SETUP_STRATEGY_MAP[setupType] ?? 'ANY';
};

const calculatePercentile = (value: number, sortedValues: number[]): number => {
  if (sortedValues.length === 0) return 50;
  let count = 0;
  for (const v of sortedValues) {
    if (v <= value) count++;
  }
  return (count / sortedValues.length) * 100;
};

const getVolatilityLevel = (percentile: number): VolatilityLevel => {
  if (percentile < 20) return 'LOW';
  if (percentile <= 80) return 'NORMAL';
  if (percentile <= 95) return 'HIGH';
  return 'EXTREME';
};

export const checkMarketRegime = (
  klines: Kline[],
  setupType: string
): MarketRegimeResult => {
  const strategyType = getSetupStrategyType(setupType);

  if (klines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      regime: 'RANGING',
      adx: null,
      plusDI: null,
      minusDI: null,
      atr: null,
      atrPercentile: null,
      volatilityLevel: 'NORMAL',
      recommendedStrategy: 'ANY',
      reason: `Insufficient klines (${klines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`,
    };
  }

  const adxResult = calculateADX(klines, ADX_PERIOD);
  const atrValues = calculateATR(klines, ATR_PERIOD);

  const lastIndex = klines.length - 1;
  const adx = adxResult.adx[lastIndex];
  const plusDI = adxResult.plusDI[lastIndex];
  const minusDI = adxResult.minusDI[lastIndex];
  const atr = atrValues[lastIndex];

  if (adx === null || adx === undefined || isNaN(adx)) {
    return {
      isAllowed: true,
      regime: 'RANGING',
      adx: null,
      plusDI: plusDI ?? null,
      minusDI: minusDI ?? null,
      atr: isNaN(atr ?? NaN) ? null : atr ?? null,
      atrPercentile: null,
      volatilityLevel: 'NORMAL',
      recommendedStrategy: 'ANY',
      reason: 'ADX calculation incomplete - allowing trade (soft pass)',
    };
  }

  const validAtrValues = atrValues
    .slice(Math.max(0, atrValues.length - ATR_LOOKBACK))
    .filter((v): v is number => !isNaN(v))
    .sort((a, b) => a - b);

  let atrPercentile: number | null = null;
  if (atr !== undefined && !isNaN(atr) && validAtrValues.length > 0) {
    atrPercentile = calculatePercentile(atr, validAtrValues);
  }

  const volatilityLevel = atrPercentile !== null ? getVolatilityLevel(atrPercentile) : 'NORMAL';

  let regime: MarketRegime;
  let recommendedStrategy: StrategyType;

  if (adx >= STRONG_TREND_THRESHOLD) {
    regime = 'TRENDING';
    recommendedStrategy = 'TREND_FOLLOWING';
  } else if (adx >= WEAK_TREND_THRESHOLD) {
    regime = 'WEAK_TREND';
    recommendedStrategy = 'ANY';
  } else {
    regime = 'RANGING';
    recommendedStrategy = 'MEAN_REVERSION';
  }

  if (volatilityLevel === 'EXTREME') {
    regime = 'VOLATILE';
    recommendedStrategy = 'ANY';
  }

  const isCompatible =
    strategyType === 'ANY' ||
    recommendedStrategy === 'ANY' ||
    strategyType === recommendedStrategy;

  if (!isCompatible) {
    return {
      isAllowed: false,
      regime,
      adx,
      plusDI: plusDI ?? null,
      minusDI: minusDI ?? null,
      atr: isNaN(atr ?? NaN) ? null : atr ?? null,
      atrPercentile,
      volatilityLevel,
      recommendedStrategy,
      reason: `Setup blocked: ${setupType} is ${strategyType} but market is ${regime} (ADX: ${adx.toFixed(1)})`,
    };
  }

  return {
    isAllowed: true,
    regime,
    adx,
    plusDI: plusDI ?? null,
    minusDI: minusDI ?? null,
    atr: isNaN(atr ?? NaN) ? null : atr ?? null,
    atrPercentile,
    volatilityLevel,
    recommendedStrategy,
    reason: `Setup allowed: ${setupType} compatible with ${regime} regime (ADX: ${adx.toFixed(1)})`,
  };
};
