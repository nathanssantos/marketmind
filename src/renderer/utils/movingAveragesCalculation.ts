import type { Candle } from '@shared/types';

export const calculateSMA = (candles: Candle[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      const candle = candles[i - j];
      if (candle) {
        sum += candle.close;
      }
    }
    result.push(sum / period);
  }

  return result;
};

export const calculateEMA = (candles: Candle[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  let ema: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    if (ema === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const candle = candles[i - j];
        if (candle) {
          sum += candle.close;
        }
      }
      ema = sum / period;
    } else {
      const candle = candles[i];
      if (candle) {
        ema = (candle.close - ema) * multiplier + ema;
      }
    }

    result.push(ema);
  }

  return result;
};

export interface MAConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  enabled: boolean;
}

export interface MAResult {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  values: (number | null)[];
}

export const calculateMovingAverages = (candles: Candle[], configs: MAConfig[]): MAResult[] => {
  return configs
    .filter((config) => config.enabled)
    .map((config) => ({
      period: config.period,
      type: config.type,
      color: config.color,
      values: config.type === 'SMA' ? calculateSMA(candles, config.period) : calculateEMA(candles, config.period),
    }));
};
