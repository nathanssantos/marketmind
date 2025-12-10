import type { Kline } from '@marketmind/types';

const DEFAULT_ELDER_PERIOD = 13;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface ElderRayResult {
  bullPower: (number | null)[];
  bearPower: (number | null)[];
}

export const calculateElderRay = (
  klines: Kline[],
  period: number = DEFAULT_ELDER_PERIOD,
): ElderRayResult => {
  if (klines.length === 0 || period <= 0) {
    return { bullPower: [], bearPower: [] };
  }

  const bullPower: (number | null)[] = [];
  const bearPower: (number | null)[] = [];

  const closes = klines.map(getKlineClose);
  const multiplier = 2 / (period + 1);

  const ema: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ema.push(null);
      bullPower.push(null);
      bearPower.push(null);
      continue;
    }

    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j]!;
      }
      ema.push(sum / period);
    } else {
      const prev = ema[i - 1];
      if (prev === null || prev === undefined) {
        ema.push(null);
      } else {
        ema.push((closes[i]! - prev) * multiplier + prev);
      }
    }

    const currentEma = ema[i];
    if (currentEma === null || currentEma === undefined) {
      bullPower.push(null);
      bearPower.push(null);
    } else {
      const high = getKlineHigh(klines[i]!);
      const low = getKlineLow(klines[i]!);
      bullPower.push(high - currentEma);
      bearPower.push(low - currentEma);
    }
  }

  return { bullPower, bearPower };
};
