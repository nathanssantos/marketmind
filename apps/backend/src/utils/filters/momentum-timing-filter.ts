import { calculateRSI, calculateMFI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export interface MomentumTimingResult {
  isAllowed: boolean;
  rsiValue: number | null;
  rsiPrevValue: number | null;
  rsiMomentum: 'RISING' | 'FALLING' | 'NEUTRAL';
  mfiValue: number | null;
  mfiConfirmation: boolean;
  reason: string;
}

export const MOMENTUM_TIMING_FILTER = {
  RSI_PERIOD: 14,
  MFI_PERIOD: 14,
  RSI_LONG_MIN: 40,
  RSI_SHORT_MAX: 60,
  MFI_LONG_MIN: 30,
  MFI_SHORT_MAX: 70,
  MIN_KLINES_REQUIRED: 20,
} as const;

export const checkMomentumTiming = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): MomentumTimingResult => {
  const {
    RSI_PERIOD,
    MFI_PERIOD,
    RSI_LONG_MIN,
    RSI_SHORT_MAX,
    MFI_LONG_MIN,
    MFI_SHORT_MAX,
    MIN_KLINES_REQUIRED,
  } = MOMENTUM_TIMING_FILTER;

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
    const rsiCondition = rsiValue > RSI_LONG_MIN && rsiMomentum !== 'FALLING';
    mfiConfirmation = mfiValue === null || mfiValue > MFI_LONG_MIN;

    isAllowed = rsiCondition && mfiConfirmation;

    if (isAllowed) {
      reason = `LONG allowed: RSI (${rsiValue.toFixed(2)}) > ${RSI_LONG_MIN} with ${rsiMomentum} momentum`;
      if (mfiValue !== null) {
        reason += `, MFI (${mfiValue.toFixed(2)}) > ${MFI_LONG_MIN} confirms buying pressure`;
      }
    } else {
      const issues: string[] = [];
      if (rsiValue <= RSI_LONG_MIN) {
        issues.push(`RSI (${rsiValue.toFixed(2)}) ≤ ${RSI_LONG_MIN}`);
      }
      if (rsiMomentum === 'FALLING') {
        issues.push(`RSI momentum is FALLING`);
      }
      if (mfiValue !== null && mfiValue <= MFI_LONG_MIN) {
        issues.push(`MFI (${mfiValue.toFixed(2)}) ≤ ${MFI_LONG_MIN} (weak buying pressure)`);
      }
      reason = `LONG blocked: ${issues.join(', ')}`;
    }
  } else {
    const rsiCondition = rsiValue < RSI_SHORT_MAX && rsiMomentum !== 'RISING';
    mfiConfirmation = mfiValue === null || mfiValue < MFI_SHORT_MAX;

    isAllowed = rsiCondition && mfiConfirmation;

    if (isAllowed) {
      reason = `SHORT allowed: RSI (${rsiValue.toFixed(2)}) < ${RSI_SHORT_MAX} with ${rsiMomentum} momentum`;
      if (mfiValue !== null) {
        reason += `, MFI (${mfiValue.toFixed(2)}) < ${MFI_SHORT_MAX} confirms selling pressure`;
      }
    } else {
      const issues: string[] = [];
      if (rsiValue >= RSI_SHORT_MAX) {
        issues.push(`RSI (${rsiValue.toFixed(2)}) ≥ ${RSI_SHORT_MAX}`);
      }
      if (rsiMomentum === 'RISING') {
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
