import type { Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

const TYPICAL_PRICE_DIVISOR = 3;

export const calculateVWAP = (candles: Kline[]): number[] => {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice =
      (getKlineHigh(candle) + getKlineLow(candle) + getKlineClose(candle)) / TYPICAL_PRICE_DIVISOR;

    cumulativeTPV += typicalPrice * getKlineVolume(candle);
    cumulativeVolume += getKlineVolume(candle);

    if (cumulativeVolume === 0) {
      vwap.push(getKlineClose(candle));
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};

export const calculateIntradayVWAP = (candles: Kline[]): number[] => {
  if (candles.length === 0) return [];

  const firstCandle = candles[0];
  if (!firstCandle) return [];

  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = new Date(firstCandle.openTime).getDate();

  for (const candle of candles) {
    const candleDay = new Date(candle.openTime).getDate();

    if (candleDay !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDay = candleDay;
    }

    const typicalPrice =
      (getKlineHigh(candle) + getKlineLow(candle) + getKlineClose(candle)) / TYPICAL_PRICE_DIVISOR;
    cumulativeTPV += typicalPrice * getKlineVolume(candle);
    cumulativeVolume += getKlineVolume(candle);

    if (cumulativeVolume === 0) {
      vwap.push(getKlineClose(candle));
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};
