import type { Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

export const calculateSMA = (candles: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || candles.length === 0) {
    return [];
  }

  const result: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      const candle = candles[i - j];
      if (!candle) continue;
      sum += getKlineClose(candle);
    }

    result.push(sum / period);
  }

  return result;
};

export const calculateEMA = (candles: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || candles.length === 0) {
    return [];
  }

  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const candle = candles[i - j];
        if (!candle) continue;
        sum += getKlineClose(candle);
      }
      result.push(sum / period);
      continue;
    }

    const previousEMA = result[i - 1];
    if (previousEMA === null || previousEMA === undefined) {
      result.push(null);
      continue;
    }

    const currentCandle = candles[i];
    if (!currentCandle) {
      result.push(null);
      continue;
    }

    const ema = (currentCandle.close - previousEMA) * multiplier + previousEMA;
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
  candles: Kline[],
  period: number,
  type: 'SMA' | 'EMA',
): (number | null)[] => {
  return type === 'SMA' ? calculateSMA(candles, period) : calculateEMA(candles, period);
};

export const calculateMovingAverages = (candles: Kline[], configs: MAConfig[]): MAResult[] => {
  return configs
    .filter((config) => config.enabled)
    .map((config) => ({
      period: config.period,
      type: config.type,
      color: config.color,
      values: config.type === 'SMA' ? calculateSMA(candles, config.period) : calculateEMA(candles, config.period),
    }));
};
