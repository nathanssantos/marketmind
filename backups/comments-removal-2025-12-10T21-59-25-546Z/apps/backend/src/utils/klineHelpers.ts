import type { Kline } from '@marketmind/types';

export const getKlineOpen = (kline: Kline): number => parseFloat(kline.open);
export const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
export const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
export const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
export const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);
