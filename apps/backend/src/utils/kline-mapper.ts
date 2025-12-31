import type { Kline } from '@marketmind/types';
import type { klines } from '../db/schema';

type DbKline = typeof klines.$inferSelect;

export const mapDbKlineToApi = (k: DbKline): Kline => ({
  openTime: k.openTime.getTime(),
  closeTime: k.closeTime.getTime(),
  open: k.open,
  high: k.high,
  low: k.low,
  close: k.close,
  volume: k.volume,
  quoteVolume: k.quoteVolume ?? '0',
  trades: k.trades ?? 0,
  takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
  takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
});

export const mapDbKlinesToApi = (dbKlines: DbKline[]): Kline[] =>
  dbKlines.map(mapDbKlineToApi);
