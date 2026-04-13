import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_SHORT_PERIOD = 7;
const DEFAULT_MID_PERIOD = 14;
const DEFAULT_LONG_PERIOD = 28;
const DEFAULT_SHORT_WEIGHT = 4;
const DEFAULT_MID_WEIGHT = 2;
const DEFAULT_LONG_WEIGHT = 1;

export interface UltimateOscillatorResult {
  values: (number | null)[];
}

export const calculateUltimateOscillator = (
  klines: Kline[],
  shortPeriod: number = DEFAULT_SHORT_PERIOD,
  midPeriod: number = DEFAULT_MID_PERIOD,
  longPeriod: number = DEFAULT_LONG_PERIOD,
  shortWeight: number = DEFAULT_SHORT_WEIGHT,
  midWeight: number = DEFAULT_MID_WEIGHT,
  longWeight: number = DEFAULT_LONG_WEIGHT,
): UltimateOscillatorResult => {
  if (klines.length === 0 || shortPeriod <= 0 || midPeriod <= 0 || longPeriod <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];
  const bp: number[] = [];
  const tr: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      bp.push(0);
      tr.push(0);
      values.push(null);
      continue;
    }

    const currentHigh = getKlineHigh(klines[i]!);
    const currentLow = getKlineLow(klines[i]!);
    const currentClose = getKlineClose(klines[i]!);
    const prevClose = getKlineClose(klines[i - 1]!);

    const minLowPrevClose = Math.min(currentLow, prevClose);
    const maxHighPrevClose = Math.max(currentHigh, prevClose);

    const buyingPressure = currentClose - minLowPrevClose;
    const trueRange = maxHighPrevClose - minLowPrevClose;

    bp.push(buyingPressure);
    tr.push(trueRange);

    if (i < longPeriod) {
      values.push(null);
      continue;
    }

    let shortBPSum = 0;
    let shortTRSum = 0;
    for (let j = 0; j < shortPeriod; j++) {
      shortBPSum += bp[i - j]!;
      shortTRSum += tr[i - j]!;
    }

    let midBPSum = 0;
    let midTRSum = 0;
    for (let j = 0; j < midPeriod; j++) {
      midBPSum += bp[i - j]!;
      midTRSum += tr[i - j]!;
    }

    let longBPSum = 0;
    let longTRSum = 0;
    for (let j = 0; j < longPeriod; j++) {
      longBPSum += bp[i - j]!;
      longTRSum += tr[i - j]!;
    }

    const shortAvg = shortTRSum === 0 ? 0 : shortBPSum / shortTRSum;
    const midAvg = midTRSum === 0 ? 0 : midBPSum / midTRSum;
    const longAvg = longTRSum === 0 ? 0 : longBPSum / longTRSum;

    const totalWeight = shortWeight + midWeight + longWeight;
    const uo =
      ((shortAvg * shortWeight + midAvg * midWeight + longAvg * longWeight) / totalWeight) * 100;

    values.push(uo);
  }

  return { values };
};
