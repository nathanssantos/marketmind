import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

export const calculateSMA = (klines: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];

  const result: (number | null)[] = new Array(klines.length);
  let windowSum = 0;

  for (let i = 0; i < klines.length; i++) {
    windowSum += getKlineClose(klines[i]!);

    if (i >= period) windowSum -= getKlineClose(klines[i - period]!);

    result[i] = i < period - 1 ? null : windowSum / period;
  }

  return result;
};

export const calculateEMA = (klines: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || klines.length === 0) {
    return [];
  }

  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const kline = klines[i - j];
        if (!kline) continue;
        sum += getKlineClose(kline);
      }
      result.push(sum / period);
      continue;
    }

    const previousEMA = result[i - 1];
    if (previousEMA === null || previousEMA === undefined) {
      result.push(null);
      continue;
    }

    const currentKline = klines[i];
    if (!currentKline) {
      result.push(null);
      continue;
    }

    const ema = (getKlineClose(currentKline) - previousEMA) * multiplier + previousEMA;
    result.push(ema);
  }

  return result;
};

export interface MovingAverageData {
  period: number;
  type: 'SMA' | 'EMA';
  values: (number | null)[];
  color: string;
}

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

export const calculateMovingAverage = (
  klines: Kline[],
  period: number,
  type: 'SMA' | 'EMA',
): (number | null)[] => {
  return type === 'SMA' ? calculateSMA(klines, period) : calculateEMA(klines, period);
};

export const calculateMovingAverages = (klines: Kline[], configs: MAConfig[]): MAResult[] => {
  return configs
    .filter((config) => config.enabled)
    .map((config) => ({
      period: config.period,
      type: config.type,
      color: config.color,
      values: config.type === 'SMA' ? calculateSMA(klines, config.period) : calculateEMA(klines, config.period),
    }));
};
