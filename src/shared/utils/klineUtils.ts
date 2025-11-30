import type { Kline } from '@shared/types';

export const parseKlinePrice = (price: string): number => parseFloat(price);

export const parseKlineVolume = (volume: string): number => parseFloat(volume);

export const getKlineOpen = (kline: Kline): number => parseFloat(kline.open);

export const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);

export const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);

export const getKlineTimestamp = (kline: Kline): number => kline.openTime;

export const getKlineCloseTime = (kline: Kline): number => kline.closeTime;

/**
 * Get candle width in milliseconds (closeTime - openTime)
 * This ensures accurate visual representation of the candle duration
 */
export const getKlineDuration = (kline: Kline): number => 
  kline.closeTime - kline.openTime;

/**
 * Check if candle is bullish (close > open)
 */
export const isKlineBullish = (kline: Kline): boolean => 
  parseFloat(kline.close) > parseFloat(kline.open);

/**
 * Check if candle is bearish (close < open)
 */
export const isKlineBearish = (kline: Kline): boolean => 
  parseFloat(kline.close) < parseFloat(kline.open);

/**
 * Get candle body size (absolute difference between open and close)
 */
export const getKlineBodySize = (kline: Kline): number => 
  Math.abs(parseFloat(kline.close) - parseFloat(kline.open));

/**
 * Get candle wick sizes
 */
export const getKlineUpperWick = (kline: Kline): number => {
  const high = parseFloat(kline.high);
  const open = parseFloat(kline.open);
  const close = parseFloat(kline.close);
  return high - Math.max(open, close);
};

export const getKlineLowerWick = (kline: Kline): number => {
  const low = parseFloat(kline.low);
  const open = parseFloat(kline.open);
  const close = parseFloat(kline.close);
  return Math.min(open, close) - low;
};
