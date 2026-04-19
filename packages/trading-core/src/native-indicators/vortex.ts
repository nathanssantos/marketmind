import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_VORTEX_PERIOD = 14;

export interface VortexResult {
  viPlus: (number | null)[];
  viMinus: (number | null)[];
}

export const calculateVortex = (
  klines: Kline[],
  period: number = DEFAULT_VORTEX_PERIOD,
): VortexResult => {
  if (klines.length === 0 || period <= 0) {
    return { viPlus: [], viMinus: [] };
  }

  const viPlus: (number | null)[] = [];
  const viMinus: (number | null)[] = [];

  const vmPlus: number[] = [];
  const vmMinus: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      vmPlus.push(0);
      vmMinus.push(0);
      trueRanges.push(0);
      viPlus.push(null);
      viMinus.push(null);
      continue;
    }

    const currentHigh = getKlineHigh(klines[i]!);
    const currentLow = getKlineLow(klines[i]!);
    const prevClose = getKlineClose(klines[i - 1]!);
    const prevHigh = getKlineHigh(klines[i - 1]!);
    const prevLow = getKlineLow(klines[i - 1]!);

    const vmp = Math.abs(currentHigh - prevLow);
    const vmm = Math.abs(currentLow - prevHigh);

    vmPlus.push(vmp);
    vmMinus.push(vmm);

    const tr = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose),
    );
    trueRanges.push(tr);

    if (i < period) {
      viPlus.push(null);
      viMinus.push(null);
      continue;
    }

    let sumVMPlus = 0;
    let sumVMMinus = 0;
    let sumTR = 0;

    for (let j = i - period + 1; j <= i; j++) {
      sumVMPlus += vmPlus[j]!;
      sumVMMinus += vmMinus[j]!;
      sumTR += trueRanges[j]!;
    }

    if (sumTR === 0) {
      viPlus.push(null);
      viMinus.push(null);
    } else {
      viPlus.push(sumVMPlus / sumTR);
      viMinus.push(sumVMMinus / sumTR);
    }
  }

  return { viPlus, viMinus };
};
