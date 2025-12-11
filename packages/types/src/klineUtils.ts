import type { Kline } from './kline';

export const parseKlinePrice = (price: string): number => parseFloat(price);

export const parseKlineVolume = (volume: string): number => parseFloat(volume);

export const getKlineOpen = (kline: Kline): number => parseFloat(kline.open);

export const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);

export const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);

export const getKlineTimestamp = (kline: Kline): number => kline.openTime;

export const getKlineCloseTime = (kline: Kline): number => kline.closeTime;

export const getKlineDuration = (kline: Kline): number =>
  kline.closeTime - kline.openTime;

export const isKlineBullish = (kline: Kline): boolean =>
  parseFloat(kline.close) > parseFloat(kline.open);

export const isKlineBearish = (kline: Kline): boolean =>
  parseFloat(kline.close) < parseFloat(kline.open);

export const getKlineBodySize = (kline: Kline): number =>
  Math.abs(parseFloat(kline.close) - parseFloat(kline.open));

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

export const getKlineQuoteVolume = (kline: Kline): number =>
  parseFloat(kline.quoteVolume);

export const getKlineTrades = (kline: Kline): number => kline.trades;

export const getKlineTakerBuyBaseVolume = (kline: Kline): number =>
  parseFloat(kline.takerBuyBaseVolume);

export const getKlineTakerBuyQuoteVolume = (kline: Kline): number =>
  parseFloat(kline.takerBuyQuoteVolume);

export const getKlineBuyPressure = (kline: Kline): number => {
  const totalVolume = parseFloat(kline.volume);
  if (totalVolume === 0) return 0.5;
  const buyVolume = parseFloat(kline.takerBuyBaseVolume);
  return buyVolume / totalVolume;
};

export const getKlineSellPressure = (kline: Kline): number =>
  1 - getKlineBuyPressure(kline);

export const getKlinePressureType = (kline: Kline): 'buy' | 'sell' | 'neutral' => {
  const buyPressure = getKlineBuyPressure(kline);
  if (buyPressure > 0.55) return 'buy';
  if (buyPressure < 0.45) return 'sell';
  return 'neutral';
};

export const getKlineAverageTradeSize = (kline: Kline): number => {
  const trades = kline.trades;
  if (trades === 0) return 0;
  const volume = parseFloat(kline.volume);
  return volume / trades;
};

export const getKlineAverageTradeValue = (kline: Kline): number => {
  const trades = kline.trades;
  if (trades === 0) return 0;
  const quoteVolume = parseFloat(kline.quoteVolume);
  return quoteVolume / trades;
};
