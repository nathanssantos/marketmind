import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

const DEFAULT_LONG_PERIOD = 25;
const DEFAULT_SHORT_PERIOD = 13;
const DEFAULT_SIGNAL_PERIOD = 13;

export interface TSIResult {
  tsi: (number | null)[];
  signal: (number | null)[];
}

const calculateEMAFromValues = (values: number[], period: number): number[] => {
  if (values.length === 0 || period <= 0) return [];

  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[i]!);
    } else {
      result.push((values[i]! - result[i - 1]!) * multiplier + result[i - 1]!);
    }
  }

  return result;
};

export const calculateTSI = (
  klines: Kline[],
  longPeriod: number = DEFAULT_LONG_PERIOD,
  shortPeriod: number = DEFAULT_SHORT_PERIOD,
  signalPeriod: number = DEFAULT_SIGNAL_PERIOD,
): TSIResult => {
  if (klines.length === 0 || longPeriod <= 0 || shortPeriod <= 0 || signalPeriod <= 0) {
    return { tsi: [], signal: [] };
  }

  const closes = klines.map(getKlineClose);

  const priceChanges: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      priceChanges.push(0);
    } else {
      priceChanges.push(closes[i]! - closes[i - 1]!);
    }
  }

  const absPriceChanges = priceChanges.map((v) => Math.abs(v));

  const pcEMA1 = calculateEMAFromValues(priceChanges, longPeriod);
  const pcEMA2 = calculateEMAFromValues(pcEMA1, shortPeriod);

  const apcEMA1 = calculateEMAFromValues(absPriceChanges, longPeriod);
  const apcEMA2 = calculateEMAFromValues(apcEMA1, shortPeriod);

  const tsi: (number | null)[] = [];
  const minWarmup = longPeriod + shortPeriod - 1;

  for (let i = 0; i < closes.length; i++) {
    if (i < minWarmup) {
      tsi.push(null);
      continue;
    }

    const doubleSmoothedPC = pcEMA2[i]!;
    const doubleSmoothedAPC = apcEMA2[i]!;

    if (doubleSmoothedAPC === 0) {
      tsi.push(0);
    } else {
      tsi.push((doubleSmoothedPC / doubleSmoothedAPC) * 100);
    }
  }

  const signal: (number | null)[] = [];
  const signalMultiplier = 2 / (signalPeriod + 1);

  let signalStartIndex = -1;
  for (let i = 0; i < tsi.length; i++) {
    const tsiVal = tsi[i];
    if (tsiVal !== null && tsiVal !== undefined) {
      if (signalStartIndex === -1) {
        signalStartIndex = i;
        signal.push(tsiVal);
      } else {
        const prev = signal[i - 1];
        if (prev === null || prev === undefined) {
          signal.push(tsiVal);
        } else {
          signal.push((tsiVal - prev) * signalMultiplier + prev);
        }
      }
    } else {
      signal.push(null);
    }
  }

  return { tsi, signal };
};
