import type { Kline } from '@marketmind/types';
import { calculateRSI } from './rsi';

export interface StochRSIResult {
  k: (number | null)[];
  d: (number | null)[];
}

export const calculateStochRSI = (
  klines: Kline[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): StochRSIResult => {
  if (klines.length === 0) {
    return { k: [], d: [] };
  }

  const rsiResult = calculateRSI(klines, rsiPeriod);
  const rsiValues = rsiResult.values;
  const len = rsiValues.length;

  const kValues: (number | null)[] = new Array(len);
  const dValues: (number | null)[] = new Array(len);

  for (let i = 0; i < stochPeriod - 1 && i < len; i++) {
    kValues[i] = null;
    dValues[i] = null;
  }

  for (let i = stochPeriod - 1; i < len; i++) {
    let minRsi = Infinity;
    let maxRsi = -Infinity;
    let validCount = 0;
    const startIdx = i - stochPeriod + 1;

    for (let j = startIdx; j <= i; j++) {
      const val = rsiValues[j];
      if (val !== null && val !== undefined) {
        if (val < minRsi) minRsi = val;
        if (val > maxRsi) maxRsi = val;
        validCount++;
      }
    }

    if (validCount === stochPeriod) {
      const currentRsi = rsiValues[i];
      if (currentRsi !== null && currentRsi !== undefined && maxRsi !== minRsi) {
        kValues[i] = ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
      } else if (currentRsi !== null && currentRsi !== undefined) {
        kValues[i] = 50;
      } else {
        kValues[i] = null;
      }
    } else {
      kValues[i] = null;
    }
  }

  for (let i = kSmooth - 1; i < len; i++) {
    let sum = 0;
    let validCount = 0;
    const startIdx = i - kSmooth + 1;

    for (let j = startIdx; j <= i; j++) {
      const val = kValues[j];
      if (val !== null && val !== undefined) {
        sum += val;
        validCount++;
      }
    }

    if (validCount === kSmooth) {
      kValues[i] = sum / validCount;
    }
  }

  for (let i = 0; i < dSmooth - 1 && i < len; i++) {
    dValues[i] = null;
  }

  for (let i = dSmooth - 1; i < len; i++) {
    let sum = 0;
    let validCount = 0;
    const startIdx = i - dSmooth + 1;

    for (let j = startIdx; j <= i; j++) {
      const val = kValues[j];
      if (val !== null && val !== undefined) {
        sum += val;
        validCount++;
      }
    }

    if (validCount === dSmooth) {
      dValues[i] = sum / validCount;
    } else {
      dValues[i] = null;
    }
  }

  return { k: kValues, d: dValues };
};
