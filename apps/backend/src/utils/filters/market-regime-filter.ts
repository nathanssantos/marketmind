import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline, SetupStrategyType } from '@marketmind/types';
import { getStrategyStrategyType } from './strategy-filter-types';

const pineService = new PineIndicatorService();

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
export type StrategyType = SetupStrategyType;
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

export const getSetupStrategyType = (setupType: string): StrategyType => {
  return getStrategyStrategyType(setupType);
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

export const checkMarketRegime = async (
  klines: Kline[],
  setupType: string
): Promise<MarketRegimeResult> => {
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

  const [dmiResult, atrValues] = await Promise.all([
    pineService.computeMulti('dmi', klines, { period: ADX_PERIOD }),
    pineService.compute('atr', klines, { period: ATR_PERIOD }),
  ]);

  const adxArr = dmiResult['adx'] ?? [];
  const plusDIArr = dmiResult['plusDI'] ?? [];
  const minusDIArr = dmiResult['minusDI'] ?? [];

  const lastIndex = klines.length - 1;
  const adx = adxArr[lastIndex] ?? null;
  const plusDI = plusDIArr[lastIndex] ?? null;
  const minusDI = minusDIArr[lastIndex] ?? null;
  const atr = atrValues[lastIndex] ?? null;

  if (adx === null || isNaN(adx)) {
    return {
      isAllowed: true,
      regime: 'RANGING',
      adx: null,
      plusDI: plusDI ?? null,
      minusDI: minusDI ?? null,
      atr: atr !== null && !isNaN(atr) ? atr : null,
      atrPercentile: null,
      volatilityLevel: 'NORMAL',
      recommendedStrategy: 'ANY',
      reason: 'ADX calculation incomplete - allowing trade (soft pass)',
    };
  }

  const validAtrValues = atrValues
    .slice(Math.max(0, atrValues.length - ATR_LOOKBACK))
    .filter((v): v is number => v !== null && !isNaN(v))
    .sort((a, b) => a - b);

  let atrPercentile: number | null = null;
  if (atr !== null && !isNaN(atr) && validAtrValues.length > 0) {
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
      atr: atr !== null && !isNaN(atr) ? atr : null,
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
    atr: atr !== null && !isNaN(atr) ? atr : null,
    atrPercentile,
    volatilityLevel,
    recommendedStrategy,
    reason: `Setup allowed: ${setupType} compatible with ${regime} regime (ADX: ${adx.toFixed(1)})`,
  };
};
