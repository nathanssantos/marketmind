import type { Candle } from '@shared/types';
import type { StochasticResult } from '../utils/stochastic';

export interface StochasticWorkerRequest {
  type: 'calculateStochastic';
  candles: Candle[];
  kPeriod: number;
  dPeriod: number;
}

export interface StochasticWorkerResponse {
  type: 'stochasticResult';
  k: (number | null)[];
  d: (number | null)[];
}

const calculateStochastic = (
  candles: Candle[],
  kPeriod: number,
  dPeriod: number
): StochasticResult => {
  if (candles.length === 0 || kPeriod <= 0 || dPeriod <= 0) {
    return { k: [], d: [] };
  }

  const k: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }

    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const currentClose = candles[i]!.close;

    if (highestHigh === lowestLow) {
      k.push(50);
      continue;
    }

    const stochK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    k.push(stochK);
  }

  const d = calculateSMA(k, dPeriod);

  return { k, d };
};

const calculateSMA = (values: (number | null)[], period: number): (number | null)[] => {
  if (period <= 0 || values.length === 0) {
    return [];
  }

  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) {
      result.push(null);
      continue;
    }

    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = 0; j < period; j++) {
      const val = values[i - j];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    }

    if (count === period) {
      result.push(sum / period);
    } else {
      result.push(null);
    }
  }

  return result;
};

self.onmessage = (event: MessageEvent<StochasticWorkerRequest>) => {
  const { type, candles, kPeriod, dPeriod } = event.data;

  if (type !== 'calculateStochastic') return;

  const result = calculateStochastic(candles, kPeriod, dPeriod);

  const response: StochasticWorkerResponse = {
    type: 'stochasticResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
