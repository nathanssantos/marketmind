import type { Candle } from '@shared/types';

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export const calculateStochastic = (
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3
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
  const multiplier = 2 / (period + 1);
  
  let firstValidIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) {
    return new Array(values.length).fill(null);
  }

  for (let i = 0; i < values.length; i++) {
    if (i < firstValidIndex) {
      result.push(null);
      continue;
    }

    const validValuesCount = i - firstValidIndex + 1;
    
    if (validValuesCount < period) {
      result.push(null);
      continue;
    }

    if (validValuesCount === period) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < period; j++) {
        const val = values[firstValidIndex + j];
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      }
      result.push(count > 0 ? sum / count : null);
      continue;
    }

    const previousEMA = result[i - 1];
    const currentValue = values[i];

    if (previousEMA === null || previousEMA === undefined || currentValue === null || currentValue === undefined) {
      result.push(null);
      continue;
    }

    const ema = (currentValue - previousEMA) * multiplier + previousEMA;
    result.push(ema);
  }

  return result;
};

export interface StochasticConfig {
  kPeriod: number;
  dPeriod: number;
  enabled: boolean;
  kColor: string;
  dColor: string;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticConfig = {
  kPeriod: 14,
  dPeriod: 9,
  enabled: false,
  kColor: '#2196f3',
  dColor: '#ff5722',
  overboughtLevel: 80,
  oversoldLevel: 20,
};
