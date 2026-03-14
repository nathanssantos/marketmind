import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_ADX_PERIOD = 14;

export interface ADXResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

export const calculateADX = (
  klines: Kline[],
  period = DEFAULT_ADX_PERIOD,
): ADXResult => {
  const length = klines.length;

  if (length < period + 1) {
    return {
      adx: Array(length).fill(null),
      plusDI: Array(length).fill(null),
      minusDI: Array(length).fill(null),
    };
  }

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trueRange: number[] = [];

  for (let i = 0; i < length; i++) {
    const current = klines[i];
    if (!current) continue;

    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      trueRange.push(getKlineHigh(current) - getKlineLow(current));
      continue;
    }

    const prev = klines[i - 1];
    if (!prev) continue;

    const highDiff = getKlineHigh(current) - getKlineHigh(prev);
    const lowDiff = getKlineLow(prev) - getKlineLow(current);

    const pDM = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const mDM = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    plusDM.push(pDM);
    minusDM.push(mDM);

    const tr = Math.max(
      getKlineHigh(current) - getKlineLow(current),
      Math.abs(getKlineHigh(current) - getKlineClose(prev)),
      Math.abs(getKlineLow(current) - getKlineClose(prev)),
    );
    trueRange.push(tr);
  }

  const smoothedPlusDM: number[] = [];
  const smoothedMinusDM: number[] = [];
  const smoothedTR: number[] = [];

  let sumPlusDM = 0;
  let sumMinusDM = 0;
  let sumTR = 0;

  for (let i = 0; i < length; i++) {
    if (i < period) {
      sumPlusDM += plusDM[i] ?? 0;
      sumMinusDM += minusDM[i] ?? 0;
      sumTR += trueRange[i] ?? 0;
      smoothedPlusDM.push(NaN);
      smoothedMinusDM.push(NaN);
      smoothedTR.push(NaN);
    } else if (i === period) {
      smoothedPlusDM.push(sumPlusDM);
      smoothedMinusDM.push(sumMinusDM);
      smoothedTR.push(sumTR);
    } else {
      const prevSmoothedPlusDM = smoothedPlusDM[i - 1] ?? 0;
      const prevSmoothedMinusDM = smoothedMinusDM[i - 1] ?? 0;
      const prevSmoothedTR = smoothedTR[i - 1] ?? 0;

      smoothedPlusDM.push(prevSmoothedPlusDM - prevSmoothedPlusDM / period + (plusDM[i] ?? 0));
      smoothedMinusDM.push(prevSmoothedMinusDM - prevSmoothedMinusDM / period + (minusDM[i] ?? 0));
      smoothedTR.push(prevSmoothedTR - prevSmoothedTR / period + (trueRange[i] ?? 0));
    }
  }

  const plusDI: (number | null)[] = [];
  const minusDI: (number | null)[] = [];
  const dx: number[] = [];

  for (let i = 0; i < length; i++) {
    if (i < period || isNaN(smoothedTR[i] ?? NaN) || (smoothedTR[i] ?? 0) === 0) {
      plusDI.push(null);
      minusDI.push(null);
      dx.push(NaN);
    } else {
      const pDI = ((smoothedPlusDM[i] ?? 0) / (smoothedTR[i] ?? 1)) * 100;
      const mDI = ((smoothedMinusDM[i] ?? 0) / (smoothedTR[i] ?? 1)) * 100;
      plusDI.push(pDI);
      minusDI.push(mDI);

      const diSum = pDI + mDI;
      const dxValue = diSum === 0 ? 0 : (Math.abs(pDI - mDI) / diSum) * 100;
      dx.push(dxValue);
    }
  }

  const adx: (number | null)[] = [];
  let adxSum = 0;
  let adxCount = 0;

  for (let i = 0; i < length; i++) {
    if (i < period * 2 - 1) {
      if (i >= period && !isNaN(dx[i] ?? NaN)) {
        adxSum += dx[i] ?? 0;
        adxCount++;
      }
      adx.push(null);
    } else if (i === period * 2 - 1) {
      adxSum += dx[i] ?? 0;
      adxCount++;
      adx.push(adxSum / period);
    } else {
      const prevADX = adx[i - 1];
      if (prevADX === null || prevADX === undefined) {
        adx.push(null);
      } else {
        const smoothedADX = ((prevADX * (period - 1)) + (dx[i] ?? 0)) / period;
        adx.push(smoothedADX);
      }
    }
  }

  return { adx, plusDI, minusDI };
};
