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

  const kValues: (number | null)[] = new Array(rsiValues.length).fill(null);
  const dValues: (number | null)[] = new Array(rsiValues.length).fill(null);

  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const rsiSlice = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const validRsi = rsiSlice.filter((v): v is number => v !== null);

    if (validRsi.length === stochPeriod) {
      const minRsi = Math.min(...validRsi);
      const maxRsi = Math.max(...validRsi);
      const currentRsi = rsiValues[i];

      if (currentRsi !== null && currentRsi !== undefined && maxRsi !== minRsi) {
        kValues[i] = ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
      } else if (currentRsi !== null && currentRsi !== undefined) {
        kValues[i] = 50;
      }
    }
  }

  for (let i = kSmooth - 1; i < kValues.length; i++) {
    const kSlice = kValues.slice(i - kSmooth + 1, i + 1);
    const validK = kSlice.filter((v): v is number => v !== null);

    if (validK.length === kSmooth) {
      kValues[i] = validK.reduce((sum, v) => sum + v, 0) / validK.length;
    }
  }

  for (let i = dSmooth - 1; i < kValues.length; i++) {
    const kSlice = kValues.slice(i - dSmooth + 1, i + 1);
    const validK = kSlice.filter((v): v is number => v !== null);

    if (validK.length === dSmooth) {
      dValues[i] = validK.reduce((sum, v) => sum + v, 0) / validK.length;
    }
  }

  return { k: kValues, d: dValues };
};
