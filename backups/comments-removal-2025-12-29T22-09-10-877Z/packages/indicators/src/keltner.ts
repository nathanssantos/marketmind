import type { Kline } from '@marketmind/types';
import { calculateATR } from './atr';
import { calculateEMA } from './movingAverages';

const DEFAULT_EMA_PERIOD = 20;
const DEFAULT_ATR_PERIOD = 10;
const DEFAULT_MULTIPLIER = 2;

export interface KeltnerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export const calculateKeltner = (
  klines: Kline[],
  emaPeriod = DEFAULT_EMA_PERIOD,
  atrPeriod = DEFAULT_ATR_PERIOD,
  multiplier = DEFAULT_MULTIPLIER,
): KeltnerResult => {
  const length = klines.length;
  const requiredPeriod = Math.max(emaPeriod, atrPeriod);

  if (length < requiredPeriod) {
    return {
      upper: Array(length).fill(null),
      middle: Array(length).fill(null),
      lower: Array(length).fill(null),
    };
  }

  const emaValues = calculateEMA(klines, emaPeriod);
  const atrValues = calculateATR(klines, atrPeriod);

  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < length; i++) {
    const ema = emaValues[i];
    const atr = atrValues[i];

    if (ema === undefined || ema === null || atr === undefined || isNaN(atr)) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      middle.push(ema);
      upper.push(ema + multiplier * atr);
      lower.push(ema - multiplier * atr);
    }
  }

  return { upper, middle, lower };
};
