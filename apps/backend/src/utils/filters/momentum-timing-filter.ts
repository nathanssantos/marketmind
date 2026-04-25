import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline, MomentumTimingResult, SetupMomentumType } from '@marketmind/types';
import { getStrategyMomentumType } from './strategy-filter-types';

const pineService = new PineIndicatorService();

export type { MomentumTimingResult, SetupMomentumType };

export const MOMENTUM_TIMING_FILTER = {
  RSI_PERIOD: 14,
  MFI_PERIOD: 14,
  RSI_LONG_MIN: 40,
  RSI_SHORT_MAX: 60,
  RSI_PULLBACK_LONG_MIN: 30,
  RSI_PULLBACK_SHORT_MAX: 70,
  MFI_LONG_MIN: 30,
  MFI_SHORT_MAX: 70,
  MIN_KLINES_REQUIRED: 20,
} as const;

export const getSetupMomentumType = (setupType: string): SetupMomentumType => {
  return getStrategyMomentumType(setupType);
};

export const checkMomentumTiming = async (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  setupType?: string
): Promise<MomentumTimingResult> => {
  const {
    RSI_PERIOD,
    MFI_PERIOD,
    RSI_LONG_MIN,
    RSI_SHORT_MAX,
    RSI_PULLBACK_LONG_MIN,
    RSI_PULLBACK_SHORT_MAX,
    MFI_LONG_MIN,
    MFI_SHORT_MAX,
    MIN_KLINES_REQUIRED,
  } = MOMENTUM_TIMING_FILTER;

  const momentumType = setupType ? getSetupMomentumType(setupType) : 'ANY';
  const isPullback = momentumType === 'PULLBACK';

  if (klines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      rsiValue: null,
      rsiPrevValue: null,
      rsiMomentum: 'NEUTRAL',
      mfiValue: null,
      mfiConfirmation: false,
      reason: `Insufficient klines for Momentum Timing calculation (${klines.length} < ${MIN_KLINES_REQUIRED}) - soft pass`,
    };
  }

  const [rsiValues, mfiValues] = await Promise.all([
    pineService.compute('rsi', klines, { period: RSI_PERIOD }),
    pineService.compute('mfi', klines, { period: MFI_PERIOD }),
  ]);

  const lastIndex = rsiValues.length - 1;
  const rsiValue = rsiValues[lastIndex] ?? null;
  const rsiPrevValue = rsiValues[lastIndex - 1] ?? null;

  const mfiValue = mfiValues[lastIndex] ?? null;

  if (rsiValue === null) {
    return {
      isAllowed: true,
      rsiValue: null,
      rsiPrevValue: null,
      rsiMomentum: 'NEUTRAL',
      mfiValue,
      mfiConfirmation: false,
      reason: 'RSI calculation returned null - soft pass',
    };
  }

  let rsiMomentum: 'RISING' | 'FALLING' | 'NEUTRAL' = 'NEUTRAL';
  if (rsiPrevValue !== null) {
    if (rsiValue > rsiPrevValue + 0.5) {
      rsiMomentum = 'RISING';
    } else if (rsiValue < rsiPrevValue - 0.5) {
      rsiMomentum = 'FALLING';
    }
  }

  let isAllowed: boolean;
  let mfiConfirmation: boolean;
  let reason: string;

  if (direction === 'LONG') {
    const rsiMinThreshold = isPullback ? RSI_PULLBACK_LONG_MIN : RSI_LONG_MIN;
    const rsiCondition = isPullback
      ? rsiValue > rsiMinThreshold
      : rsiValue > rsiMinThreshold && rsiMomentum !== 'FALLING';
    mfiConfirmation = mfiValue === null || mfiValue > MFI_LONG_MIN;

    isAllowed = rsiCondition && mfiConfirmation;

    if (isAllowed) {
      reason = isPullback
        ? `LONG allowed (pullback): RSI (${rsiValue.toFixed(2)}) > ${rsiMinThreshold}`
        : `LONG allowed: RSI (${rsiValue.toFixed(2)}) > ${rsiMinThreshold} with ${rsiMomentum} momentum`;
      if (mfiValue !== null) {
        reason += `, MFI (${mfiValue.toFixed(2)}) > ${MFI_LONG_MIN} confirms buying pressure`;
      }
    } else {
      const issues: string[] = [];
      if (rsiValue <= rsiMinThreshold) {
        issues.push(`RSI (${rsiValue.toFixed(2)}) ≤ ${rsiMinThreshold}`);
      }
      if (!isPullback && rsiMomentum === 'FALLING') {
        issues.push(`RSI momentum is FALLING`);
      }
      if (mfiValue !== null && mfiValue <= MFI_LONG_MIN) {
        issues.push(`MFI (${mfiValue.toFixed(2)}) ≤ ${MFI_LONG_MIN} (weak buying pressure)`);
      }
      reason = `LONG blocked: ${issues.join(', ')}`;
    }
  } else {
    const rsiMaxThreshold = isPullback ? RSI_PULLBACK_SHORT_MAX : RSI_SHORT_MAX;
    const rsiCondition = isPullback
      ? rsiValue < rsiMaxThreshold
      : rsiValue < rsiMaxThreshold && rsiMomentum !== 'RISING';
    mfiConfirmation = mfiValue === null || mfiValue < MFI_SHORT_MAX;

    isAllowed = rsiCondition && mfiConfirmation;

    if (isAllowed) {
      reason = isPullback
        ? `SHORT allowed (pullback): RSI (${rsiValue.toFixed(2)}) < ${rsiMaxThreshold}`
        : `SHORT allowed: RSI (${rsiValue.toFixed(2)}) < ${rsiMaxThreshold} with ${rsiMomentum} momentum`;
      if (mfiValue !== null) {
        reason += `, MFI (${mfiValue.toFixed(2)}) < ${MFI_SHORT_MAX} confirms selling pressure`;
      }
    } else {
      const issues: string[] = [];
      if (rsiValue >= rsiMaxThreshold) {
        issues.push(`RSI (${rsiValue.toFixed(2)}) ≥ ${rsiMaxThreshold}`);
      }
      if (!isPullback && rsiMomentum === 'RISING') {
        issues.push(`RSI momentum is RISING`);
      }
      if (mfiValue !== null && mfiValue >= MFI_SHORT_MAX) {
        issues.push(`MFI (${mfiValue.toFixed(2)}) ≥ ${MFI_SHORT_MAX} (strong buying pressure)`);
      }
      reason = `SHORT blocked: ${issues.join(', ')}`;
    }
  }

  return {
    isAllowed,
    rsiValue,
    rsiPrevValue,
    rsiMomentum,
    mfiValue,
    mfiConfirmation,
    reason,
  };
};
