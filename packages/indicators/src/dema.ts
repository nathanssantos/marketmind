import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

const DEFAULT_DEMA_PERIOD = 21;

export interface DEMAResult {
  values: (number | null)[];
}

export const calculateDEMA = (klines: Kline[], period: number = DEFAULT_DEMA_PERIOD): DEMAResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const closes = klines.map(getKlineClose);
  const multiplier = 2 / (period + 1);

  const ema1: (number | null)[] = [];
  const ema2: (number | null)[] = [];
  const values: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ema1.push(null);
      ema2.push(null);
      values.push(null);
      continue;
    }

    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j]!;
      }
      ema1.push(sum / period);
      ema2.push(null);
      values.push(null);
      continue;
    }

    const prevEma1 = ema1[i - 1];
    if (prevEma1 === null || prevEma1 === undefined) {
      ema1.push(null);
      ema2.push(null);
      values.push(null);
      continue;
    }

    const currentEma1 = (closes[i]! - prevEma1) * multiplier + prevEma1;
    ema1.push(currentEma1);

    if (i < 2 * period - 2) {
      ema2.push(null);
      values.push(null);
      continue;
    }

    if (i === 2 * period - 2) {
      let sum = 0;
      let hasNull = false;
      for (let j = 0; j < period; j++) {
        const e1Val = ema1[i - j];
        if (e1Val === null || e1Val === undefined) {
          hasNull = true;
          break;
        }
        sum += e1Val;
      }
      if (hasNull) {
        ema2.push(null);
        values.push(null);
        continue;
      }
      const firstEma2 = sum / period;
      ema2.push(firstEma2);
      values.push(2 * currentEma1 - firstEma2);
      continue;
    }

    const prevEma2 = ema2[i - 1];
    if (prevEma2 === null || prevEma2 === undefined) {
      ema2.push(null);
      values.push(null);
      continue;
    }

    const currentEma2 = (currentEma1 - prevEma2) * multiplier + prevEma2;
    ema2.push(currentEma2);

    const dema = 2 * currentEma1 - currentEma2;
    values.push(dema);
  }

  return { values };
};
