import type { Kline } from '@marketmind/types';

const DEFAULT_ATR_PERIOD = 14;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export const calculateATR = (
  klines: Kline[],
  period = DEFAULT_ATR_PERIOD,
): number[] => {
  if (klines.length === 0) return [];

  const trueRanges: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const current = klines[i];
    if (!current) continue;

    if (i === 0) {
      trueRanges.push(getKlineHigh(current) - getKlineLow(current));
    } else {
      const prev = klines[i - 1];
      if (!prev) continue;

      const tr = Math.max(
        getKlineHigh(current) - getKlineLow(current),
        Math.abs(getKlineHigh(current) - getKlineClose(prev)),
        Math.abs(getKlineLow(current) - getKlineClose(prev)),
      );

      trueRanges.push(tr);
    }
  }

  const atr: number[] = [];

  let smaSum = 0;
  for (let i = 0; i < trueRanges.length; i++) {
    const tr = trueRanges[i];
    if (tr === undefined) continue;

    if (i < period - 1) {
      smaSum += tr;
      atr.push(NaN);
    } else if (i === period - 1) {
      smaSum += tr;
      atr.push(smaSum / period);
    } else {
      const prevATR = atr[i - 1];
      if (prevATR === undefined || isNaN(prevATR)) continue;
      const smoothedATR = (prevATR * (period - 1) + tr) / period;
      atr.push(smoothedATR);
    }
  }

  return atr;
};
