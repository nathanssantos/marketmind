import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@shared/utils';

export interface RSIResult {
  values: (number | null)[];
}

export const calculateRSI = (klines: Kline[], period: number = 2): RSIResult => {
  if (klines.length < period + 1) {
    return { values: Array(klines.length).fill(null) };
  }

  const values: (number | null)[] = [];
  
  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (j === 0) continue;
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

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      values.push(100);
      continue;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    values.push(rsi);
  }

  return { values };
};
