import { calculateADX, calculateATR, calculateRSI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { logger } from './logger';

export interface DynamicPyramidConfig {
  useAtr: boolean;
  useAdx: boolean;
  useRsi: boolean;
  adxThreshold: number;
  rsiLowerBound: number;
  rsiUpperBound: number;
  baseMinDistance: number;
  baseScaleFactor: number;
  leverage: number;
  leverageAware: boolean;
}

export interface DynamicPyramidEvaluation {
  canPyramid: boolean;
  adjustedMinDistance: number;
  adjustedScaleFactor: number;
  adxValue: number | null;
  rsiValue: number | null;
  atrValue: number | null;
  atrRatio: number;
  reason: string;
}

const DEFAULT_ATR_PERIOD = 14;
const DEFAULT_ADX_PERIOD = 14;
const DEFAULT_RSI_PERIOD = 14;

export const evaluateDynamicConditions = (
  klines: Kline[],
  config: DynamicPyramidConfig
): DynamicPyramidEvaluation => {
  if (klines.length < 30) {
    return {
      canPyramid: false,
      adjustedMinDistance: config.baseMinDistance,
      adjustedScaleFactor: config.baseScaleFactor,
      adxValue: null,
      rsiValue: null,
      atrValue: null,
      atrRatio: 1,
      reason: 'Insufficient kline data for indicator calculation',
    };
  }

  let atrRatio = 1;
  let atrValue: number | null = null;
  let adxValue: number | null = null;
  let rsiValue: number | null = null;

  if (config.useAtr) {
    const atrValues = calculateATR(klines, DEFAULT_ATR_PERIOD);
    const validAtrValues = atrValues.filter((v) => !isNaN(v) && v > 0);

    if (validAtrValues.length >= 2) {
      const currentAtr = validAtrValues[validAtrValues.length - 1] ?? 0;
      atrValue = currentAtr;
      const avgAtr = validAtrValues.slice(-DEFAULT_ATR_PERIOD).reduce((a, b) => a + b, 0) / Math.min(validAtrValues.length, DEFAULT_ATR_PERIOD);
      atrRatio = avgAtr > 0 ? currentAtr / avgAtr : 1;
      atrRatio = Math.max(0.5, Math.min(2.0, atrRatio));
    }
  }

  if (config.useAdx) {
    const adxResult = calculateADX(klines, DEFAULT_ADX_PERIOD);
    const adxValues = adxResult.adx.filter((v): v is number => v !== null);

    if (adxValues.length > 0) {
      adxValue = adxValues[adxValues.length - 1] ?? null;

      if (adxValue !== null && adxValue < config.adxThreshold) {
        logger.debug({
          adxValue,
          threshold: config.adxThreshold,
        }, '[DynamicPyramid] ADX below threshold - weak trend');
        return {
          canPyramid: false,
          adjustedMinDistance: config.baseMinDistance * atrRatio,
          adjustedScaleFactor: config.baseScaleFactor,
          adxValue,
          rsiValue: null,
          atrValue,
          atrRatio,
          reason: `ADX (${adxValue.toFixed(1)}) below threshold (${config.adxThreshold}) - weak trend`,
        };
      }
    }
  }

  if (config.useRsi) {
    const rsiResult = calculateRSI(klines, DEFAULT_RSI_PERIOD);
    const rsiValues = rsiResult.values.filter((v): v is number => v !== null);

    if (rsiValues.length > 0) {
      rsiValue = rsiValues[rsiValues.length - 1] ?? null;

      if (rsiValue !== null && rsiValue > config.rsiLowerBound && rsiValue < config.rsiUpperBound) {
        logger.debug({
          rsiValue,
          lowerBound: config.rsiLowerBound,
          upperBound: config.rsiUpperBound,
        }, '[DynamicPyramid] RSI in neutral zone');
        return {
          canPyramid: false,
          adjustedMinDistance: config.baseMinDistance * atrRatio,
          adjustedScaleFactor: config.baseScaleFactor,
          adxValue,
          rsiValue,
          atrValue,
          atrRatio,
          reason: `RSI (${rsiValue.toFixed(1)}) in neutral zone (${config.rsiLowerBound}-${config.rsiUpperBound})`,
        };
      }
    }
  }

  const adjustedMinDistance = config.baseMinDistance * atrRatio;

  let adjustedScaleFactor = config.baseScaleFactor;
  if (config.leverageAware && config.leverage > 1) {
    adjustedScaleFactor = config.baseScaleFactor * (1 / Math.sqrt(config.leverage));
    adjustedScaleFactor = Math.max(0.1, Math.min(1.0, adjustedScaleFactor));
  }

  logger.debug({
    atrRatio: atrRatio.toFixed(2),
    adxValue: adxValue?.toFixed(1) ?? 'N/A',
    rsiValue: rsiValue?.toFixed(1) ?? 'N/A',
    adjustedMinDistance: (adjustedMinDistance * 100).toFixed(2),
    adjustedScaleFactor: adjustedScaleFactor.toFixed(2),
    leverage: config.leverage,
  }, '[DynamicPyramid] Conditions evaluated');

  return {
    canPyramid: true,
    adjustedMinDistance,
    adjustedScaleFactor,
    adxValue,
    rsiValue,
    atrValue,
    atrRatio,
    reason: 'Dynamic conditions met',
  };
};

export interface PyramidCandidate {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  adxValue: number | null;
  currentPrice: number;
  profitPercent: number;
  suggestedSize: number;
  entryCount: number;
}

export const prioritizePyramidCandidates = (
  candidates: PyramidCandidate[]
): PyramidCandidate[] => {
  return [...candidates].sort((a, b) => {
    const adxA = a.adxValue ?? 0;
    const adxB = b.adxValue ?? 0;
    return adxB - adxA;
  });
};

export const calculateLeverageAdjustedScaleFactor = (
  baseScaleFactor: number,
  leverage: number,
  leverageAware: boolean
): number => {
  if (!leverageAware || leverage <= 1) return baseScaleFactor;
  const adjusted = baseScaleFactor * (1 / Math.sqrt(leverage));
  return Math.max(0.1, Math.min(1.0, adjusted));
};

export const calculateAtrAdjustedMinDistance = (
  baseMinDistance: number,
  klines: Kline[]
): number => {
  if (klines.length < 30) return baseMinDistance;

  const atrValues = calculateATR(klines, DEFAULT_ATR_PERIOD);
  const validAtrValues = atrValues.filter((v) => !isNaN(v) && v > 0);

  if (validAtrValues.length < 2) return baseMinDistance;

  const currentAtr = validAtrValues[validAtrValues.length - 1] ?? 0;
  const avgAtr = validAtrValues.slice(-DEFAULT_ATR_PERIOD).reduce((a, b) => a + b, 0) / Math.min(validAtrValues.length, DEFAULT_ATR_PERIOD);

  const atrRatio = avgAtr > 0 ? currentAtr / avgAtr : 1;
  const clampedRatio = Math.max(0.5, Math.min(2.0, atrRatio));

  return baseMinDistance * clampedRatio;
};

export const getCurrentIndicatorValues = (
  klines: Kline[]
): { atr: number | null; adx: number | null; rsi: number | null; plusDI: number | null; minusDI: number | null } => {
  if (klines.length < 30) {
    return { atr: null, adx: null, rsi: null, plusDI: null, minusDI: null };
  }

  const atrValues = calculateATR(klines, DEFAULT_ATR_PERIOD);
  const adxResult = calculateADX(klines, DEFAULT_ADX_PERIOD);
  const rsiResult = calculateRSI(klines, DEFAULT_RSI_PERIOD);

  const validAtr = atrValues.filter((v) => !isNaN(v) && v > 0);
  const validAdx = adxResult.adx.filter((v): v is number => v !== null);
  const validRsi = rsiResult.values.filter((v): v is number => v !== null);
  const validPlusDI = adxResult.plusDI.filter((v): v is number => v !== null);
  const validMinusDI = adxResult.minusDI.filter((v): v is number => v !== null);

  return {
    atr: validAtr.length > 0 ? (validAtr[validAtr.length - 1] ?? null) : null,
    adx: validAdx.length > 0 ? (validAdx[validAdx.length - 1] ?? null) : null,
    rsi: validRsi.length > 0 ? (validRsi[validRsi.length - 1] ?? null) : null,
    plusDI: validPlusDI.length > 0 ? (validPlusDI[validPlusDI.length - 1] ?? null) : null,
    minusDI: validMinusDI.length > 0 ? (validMinusDI[validMinusDI.length - 1] ?? null) : null,
  };
};
