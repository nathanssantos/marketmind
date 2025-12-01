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
 * Get kline width in milliseconds (closeTime - openTime)
 * This ensures accurate visual representation of the kline duration
 */
export const getKlineDuration = (kline: Kline): number => 
  kline.closeTime - kline.openTime;

/**
 * Check if kline is bullish (close > open)
 */
export const isKlineBullish = (kline: Kline): boolean => 
  parseFloat(kline.close) > parseFloat(kline.open);

/**
 * Check if kline is bearish (close < open)
 */
export const isKlineBearish = (kline: Kline): boolean => 
  parseFloat(kline.close) < parseFloat(kline.open);

/**
 * Get kline body size (absolute difference between open and close)
 */
export const getKlineBodySize = (kline: Kline): number => 
  Math.abs(parseFloat(kline.close) - parseFloat(kline.open));

/**
 * Get kline wick sizes
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

/**
 * Get quote volume (volume in quote asset, e.g., USDT)
 */
export const getKlineQuoteVolume = (kline: Kline): number =>
  parseFloat(kline.quoteVolume);

/**
 * Get number of trades in this kline
 */
export const getKlineTrades = (kline: Kline): number =>
  kline.trades;

/**
 * Get taker buy base volume (volume of buys initiated by takers)
 */
export const getKlineTakerBuyBaseVolume = (kline: Kline): number =>
  parseFloat(kline.takerBuyBaseVolume);

/**
 * Get taker buy quote volume (value of buys in quote asset)
 */
export const getKlineTakerBuyQuoteVolume = (kline: Kline): number =>
  parseFloat(kline.takerBuyQuoteVolume);

/**
 * Calculate buy pressure ratio (0-1, where >0.5 means more buying)
 * Uses taker buy volume vs total volume
 */
export const getKlineBuyPressure = (kline: Kline): number => {
  const totalVolume = parseFloat(kline.volume);
  if (totalVolume === 0) return 0.5;

  const buyVolume = parseFloat(kline.takerBuyBaseVolume);
  return buyVolume / totalVolume;
};

/**
 * Calculate sell pressure ratio (0-1, where >0.5 means more selling)
 */
export const getKlineSellPressure = (kline: Kline): number => {
  return 1 - getKlineBuyPressure(kline);
};

/**
 * Get the dominant pressure type
 */
export const getKlinePressureType = (kline: Kline): 'buy' | 'sell' | 'neutral' => {
  const buyPressure = getKlineBuyPressure(kline);
  if (buyPressure > 0.55) return 'buy';
  if (buyPressure < 0.45) return 'sell';
  return 'neutral';
};

/**
 * Calculate average trade size in base asset
 */
export const getKlineAverageTradeSize = (kline: Kline): number => {
  const trades = kline.trades;
  if (trades === 0) return 0;

  const volume = parseFloat(kline.volume);
  return volume / trades;
};

/**
 * Calculate average trade value in quote asset (e.g., USDT)
 */
export const getKlineAverageTradeValue = (kline: Kline): number => {
  const trades = kline.trades;
  if (trades === 0) return 0;

  const quoteVolume = parseFloat(kline.quoteVolume);
  return quoteVolume / trades;
};

