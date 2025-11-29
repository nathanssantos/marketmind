import type { Candle } from '@shared/types';

const DEFAULT_ATR_PERIOD = 14;

export const calculateATR = (
  candles: Candle[],
  period = DEFAULT_ATR_PERIOD,
): number[] => {
  if (candles.length === 0) return [];

  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];
    if (!current) continue;

    if (i === 0) {
      trueRanges.push(current.high - current.low);
    } else {
      const prev = candles[i - 1];
      if (!prev) continue;

      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close),
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
