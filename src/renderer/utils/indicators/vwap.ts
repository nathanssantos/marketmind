import type { Candle } from '@shared/types';

const TYPICAL_PRICE_DIVISOR = 3;

export const calculateVWAP = (candles: Candle[]): number[] => {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice =
      (candle.high + candle.low + candle.close) / TYPICAL_PRICE_DIVISOR;

    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume === 0) {
      vwap.push(candle.close);
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};

export const calculateIntradayVWAP = (candles: Candle[]): number[] => {
  if (candles.length === 0) return [];

  const firstCandle = candles[0];
  if (!firstCandle) return [];

  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = new Date(firstCandle.timestamp).getDate();

  for (const candle of candles) {
    const candleDay = new Date(candle.timestamp).getDate();

    if (candleDay !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDay = candleDay;
    }

    const typicalPrice =
      (candle.high + candle.low + candle.close) / TYPICAL_PRICE_DIVISOR;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume === 0) {
      vwap.push(candle.close);
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};
