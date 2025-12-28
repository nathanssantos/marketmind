import type { Kline } from '@marketmind/types';

export interface DbKline {
  openTime: Date;
  closeTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export const convertDbKlineToKline = (dbKline: DbKline): Kline => ({
  ...dbKline,
  openTime: dbKline.openTime.getTime(),
  closeTime: dbKline.closeTime.getTime(),
});

export const convertDbKlinesToKlines = (dbKlines: DbKline[]): Kline[] =>
  dbKlines.map(convertDbKlineToKline);

export const convertDbKlinesReversed = (dbKlines: DbKline[]): Kline[] =>
  dbKlines.reverse().map(convertDbKlineToKline);
