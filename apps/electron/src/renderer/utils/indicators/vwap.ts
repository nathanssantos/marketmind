import type { Kline } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

const TYPICAL_PRICE_DIVISOR = 3;

export const calculateVWAP = (klines: Kline[]): number[] => {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const kline of klines) {
    const typicalPrice =
      (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / TYPICAL_PRICE_DIVISOR;

    cumulativeTPV += typicalPrice * getKlineVolume(kline);
    cumulativeVolume += getKlineVolume(kline);

    if (cumulativeVolume === 0) {
      vwap.push(getKlineClose(kline));
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};

export const calculateIntradayVWAP = (klines: Kline[]): number[] => {
  if (klines.length === 0) return [];

  const firstKline = klines[0];
  if (!firstKline) return [];

  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = new Date(firstKline.openTime).getDate();

  for (const kline of klines) {
    const klineDay = new Date(kline.openTime).getDate();

    if (klineDay !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDay = klineDay;
    }

    const typicalPrice =
      (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / TYPICAL_PRICE_DIVISOR;
    cumulativeTPV += typicalPrice * getKlineVolume(kline);
    cumulativeVolume += getKlineVolume(kline);

    if (cumulativeVolume === 0) {
      vwap.push(getKlineClose(kline));
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return vwap;
};
