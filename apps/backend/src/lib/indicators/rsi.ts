import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

export interface RSIResult {
  values: (number | null)[];
}

export const calculateRSI = (klines: Kline[], period: number = 2): RSIResult => {
  if (klines.length < period + 1) {
    return { values: Array(klines.length).fill(null) };
  }

  const values: (number | null)[] = [];
  let prevAvgGain = 0;
  let prevAvgLoss = 0;

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    if (i === period) {
      let gains = 0;
      let losses = 0;

      for (let j = 1; j <= period; j++) {
        const currentKline = klines[j];
        const prevKline = klines[j - 1];
        if (!currentKline || !prevKline) continue;
        const change = getKlineClose(currentKline) - getKlineClose(prevKline);
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      prevAvgGain = gains / period;
      prevAvgLoss = losses / period;
    } else {
      const currentKline = klines[i];
      const prevKline = klines[i - 1];
      if (!currentKline || !prevKline) {
        values.push(null);
        continue;
      }

      const change = getKlineClose(currentKline) - getKlineClose(prevKline);
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;

      prevAvgGain = (prevAvgGain * (period - 1) + currentGain) / period;
      prevAvgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;
    }

    if (prevAvgLoss === 0) {
      values.push(100);
      continue;
    }

    const rs = prevAvgGain / prevAvgLoss;
    const rsi = 100 - (100 / (1 + rs));

    values.push(rsi);
  }

  return { values };
};
