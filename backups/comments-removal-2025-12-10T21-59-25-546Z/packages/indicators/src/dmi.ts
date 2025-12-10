import type { Kline } from '@marketmind/types';

const DEFAULT_DMI_PERIOD = 14;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface DMIResult {
  plusDI: (number | null)[];
  minusDI: (number | null)[];
  dx: (number | null)[];
}

export const calculateDMI = (klines: Kline[], period: number = DEFAULT_DMI_PERIOD): DMIResult => {
  if (klines.length === 0 || period <= 0) {
    return { plusDI: [], minusDI: [], dx: [] };
  }

  const plusDI: (number | null)[] = [];
  const minusDI: (number | null)[] = [];
  const dx: (number | null)[] = [];

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      trueRanges.push(0);
      plusDMs.push(0);
      minusDMs.push(0);
      plusDI.push(null);
      minusDI.push(null);
      dx.push(null);
      continue;
    }

    const currentHigh = getKlineHigh(klines[i]!);
    const currentLow = getKlineLow(klines[i]!);
    const prevClose = getKlineClose(klines[i - 1]!);
    const prevHigh = getKlineHigh(klines[i - 1]!);
    const prevLow = getKlineLow(klines[i - 1]!);

    const tr = Math.max(currentHigh - currentLow, Math.abs(currentHigh - prevClose), Math.abs(currentLow - prevClose));
    trueRanges.push(tr);

    const upMove = currentHigh - prevHigh;
    const downMove = prevLow - currentLow;

    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);

    if (i < period) {
      plusDI.push(null);
      minusDI.push(null);
      dx.push(null);
      continue;
    }

    let smoothedTR = 0;
    let smoothedPlusDM = 0;
    let smoothedMinusDM = 0;

    if (i === period) {
      for (let j = 1; j <= period; j++) {
        smoothedTR += trueRanges[j]!;
        smoothedPlusDM += plusDMs[j]!;
        smoothedMinusDM += minusDMs[j]!;
      }
    } else {
      let sumTR = 0;
      let sumPlusDM = 0;
      let sumMinusDM = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumTR += trueRanges[j]!;
        sumPlusDM += plusDMs[j]!;
        sumMinusDM += minusDMs[j]!;
      }

      smoothedTR = sumTR;
      smoothedPlusDM = sumPlusDM;
      smoothedMinusDM = sumMinusDM;
    }

    const pDI = smoothedTR === 0 ? 0 : (smoothedPlusDM / smoothedTR) * 100;
    const mDI = smoothedTR === 0 ? 0 : (smoothedMinusDM / smoothedTR) * 100;

    plusDI.push(pDI);
    minusDI.push(mDI);

    const diSum = pDI + mDI;
    const diDiff = Math.abs(pDI - mDI);
    const dxValue = diSum === 0 ? 0 : (diDiff / diSum) * 100;

    dx.push(dxValue);
  }

  return { plusDI, minusDI, dx };
};
