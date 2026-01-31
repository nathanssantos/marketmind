import { calculateRSI, calculateMFI } from '@marketmind/indicators';
import type { Kline, MomentumTimingResult } from '@marketmind/types';

export type { MomentumTimingResult };

export type SetupMomentumType = 'PULLBACK' | 'BREAKOUT' | 'REVERSAL' | 'ANY';

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

const SETUP_MOMENTUM_TYPE: Record<string, SetupMomentumType> = {
  'breakout-long': 'BREAKOUT',
  'breakout-short': 'BREAKOUT',
  'ema9-pullback': 'PULLBACK',
  'ema9-double-pullback': 'PULLBACK',
  'ema9-continuation': 'PULLBACK',
  'larry-williams-9.1': 'PULLBACK',
  'larry-williams-9.2': 'PULLBACK',
  'larry-williams-9.3': 'PULLBACK',
  'larry-williams-9.4': 'PULLBACK',
  'oversold-bounce': 'REVERSAL',
  'overbought-fade': 'REVERSAL',
  'support-bounce': 'REVERSAL',
  'resistance-fade': 'REVERSAL',
  'trend-continuation': 'PULLBACK',
};

export const getSetupMomentumType = (setupType: string): SetupMomentumType => {
  return SETUP_MOMENTUM_TYPE[setupType] ?? 'ANY';
};

export const checkMomentumTiming = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  setupType?: string
): MomentumTimingResult => {
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

  const rsiResult = calculateRSI(klines, RSI_PERIOD);
  const mfiResult = calculateMFI(klines, MFI_PERIOD);

  const lastIndex = rsiResult.values.length - 1;
  const rsiValue = rsiResult.values[lastIndex] ?? null;
  const rsiPrevValue = rsiResult.values[lastIndex - 1] ?? null;

  const mfiValue = mfiResult[lastIndex] ?? null;

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

  let isAllowed = false;
  let mfiConfirmation = false;
  let reason = '';

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
