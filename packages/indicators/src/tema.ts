import type { Kline } from '@marketmind/types';

const DEFAULT_TEMA_PERIOD = 21;

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface TEMAResult {
  values: (number | null)[];
}

export const calculateTEMA = (klines: Kline[], period: number = DEFAULT_TEMA_PERIOD): TEMAResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const closes = klines.map(getKlineClose);
  const multiplier = 2 / (period + 1);

  const ema1: (number | null)[] = [];
  const ema2: (number | null)[] = [];
  const ema3: (number | null)[] = [];
  const values: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ema1.push(null);
      ema2.push(null);
      ema3.push(null);
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
      ema3.push(null);
      values.push(null);
      continue;
    }

    const prevEma1 = ema1[i - 1];
    if (prevEma1 === null || prevEma1 === undefined) {
      ema1.push(null);
      ema2.push(null);
      ema3.push(null);
      values.push(null);
      continue;
    }

    const currentEma1 = (closes[i]! - prevEma1) * multiplier + prevEma1;
    ema1.push(currentEma1);

    if (i < 2 * period - 2) {
      ema2.push(null);
      ema3.push(null);
      values.push(null);
      continue;
    }

    if (i === 2 * period - 2) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const e1Val = ema1[i - j];
        if (e1Val === null || e1Val === undefined) {
          ema2.push(null);
          ema3.push(null);
          values.push(null);
          continue;
        }
        sum += e1Val;
      }
      ema2.push(sum / period);
      ema3.push(null);
      values.push(null);
      continue;
    }

    const prevEma2 = ema2[i - 1];
    if (prevEma2 === null || prevEma2 === undefined) {
      ema2.push(null);
      ema3.push(null);
      values.push(null);
      continue;
    }

    const currentEma2 = (currentEma1 - prevEma2) * multiplier + prevEma2;
    ema2.push(currentEma2);

    if (i < 3 * period - 3) {
      ema3.push(null);
      values.push(null);
      continue;
    }

    if (i === 3 * period - 3) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const e2Val = ema2[i - j];
        if (e2Val === null || e2Val === undefined) {
          ema3.push(null);
          values.push(null);
          continue;
        }
        sum += e2Val;
      }
      const firstEma3 = sum / period;
      ema3.push(firstEma3);
      values.push(3 * currentEma1 - 3 * currentEma2 + firstEma3);
      continue;
    }

    const prevEma3 = ema3[i - 1];
    if (prevEma3 === null || prevEma3 === undefined) {
      ema3.push(null);
      values.push(null);
      continue;
    }

    const currentEma3 = (currentEma2 - prevEma3) * multiplier + prevEma3;
    ema3.push(currentEma3);

    const tema = 3 * currentEma1 - 3 * currentEma2 + currentEma3;
    values.push(tema);
  }

  return { values };
};
