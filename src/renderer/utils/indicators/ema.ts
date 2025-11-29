import type { Candle } from '@shared/types';

const DEFAULT_EMA_PERIOD = 9;
const EMA_MULTIPLIER_BASE = 2;

export const calculateEMA = (
  candles: Candle[],
  period = DEFAULT_EMA_PERIOD,
): number[] => {
  if (candles.length === 0) return [];
  if (period <= 0) return [];

  const ema: number[] = [];
  const multiplier = EMA_MULTIPLIER_BASE / (period + 1);

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    if (i < period) {
      sum += candle.close;
      if (i === period - 1) {
        ema.push(sum / period);
      } else {
        ema.push(NaN);
      }
    } else {
      const prevEMA = ema[i - 1];
      if (prevEMA === undefined || isNaN(prevEMA)) {
        ema.push(NaN);
        continue;
      }
      const currentEMA = (candle.close - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
    }
  }

  return ema;
};

export const calculateSMA = (
  candles: Candle[],
  period: number,
): number[] => {
  if (candles.length === 0) return [];
  if (period <= 0) return [];

  const sma: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      const candle = candles[i - j];
      if (!candle) continue;
      sum += candle.close;
    }

    sma.push(sum / period);
  }

  return sma;
};
