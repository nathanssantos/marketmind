import type { TestKline } from '@marketmind/types';

export type { TestKline } from '@marketmind/types';

export interface RawKlineRow {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
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

export const toRawKline = (k: TestKline): RawKlineRow => ({
  symbol: k.symbol,
  interval: k.interval,
  openTime: new Date(k.openTime).toISOString(),
  closeTime: new Date(k.closeTime).toISOString(),
  open: String(k.open),
  high: String(k.high),
  low: String(k.low),
  close: String(k.close),
  volume: String(k.volume),
  quoteVolume: String(k.quoteVolume),
  trades: k.trades,
  takerBuyBaseVolume: String(k.takerBuyBaseVolume),
  takerBuyQuoteVolume: String(k.takerBuyQuoteVolume),
});

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

interface SeededRng {
  next: () => number;
}

const mulberry32 = (seed: number): SeededRng => {
  let state = seed >>> 0;
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};

export interface GenerateKlinesOptions {
  count: number;
  seed?: number;
  basePrice?: number;
  volatility?: number;
  interval?: string;
  symbol?: string;
  endTime?: number;
}

export const generateKlines = (opts: GenerateKlinesOptions): TestKline[] => {
  const count = opts.count;
  const seed = opts.seed ?? 42;
  const basePrice = opts.basePrice ?? 50_000;
  const volatility = opts.volatility ?? 0.004;
  const interval = opts.interval ?? '1h';
  const symbol = opts.symbol ?? 'BTCUSDT';
  const intervalMs = INTERVAL_MS[interval] ?? 60_000;
  const endTime = opts.endTime ?? Math.floor(Date.now() / intervalMs) * intervalMs;

  const rng = mulberry32(seed);
  const klines: TestKline[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const openTime = endTime - (count - 1 - i) * intervalMs;
    const closeTime = openTime + intervalMs - 1;
    const drift = (rng.next() - 0.5) * 2 * volatility;
    const open = price;
    const close = price * (1 + drift);
    const wick = Math.abs(drift) * price * 1.5;
    const high = Math.max(open, close) + wick * rng.next();
    const low = Math.min(open, close) - wick * rng.next();
    const volume = 100 + rng.next() * 900;
    const quoteVolume = volume * ((open + close) / 2);
    const trades = Math.floor(50 + rng.next() * 450);
    const takerBuyBase = volume * (0.4 + rng.next() * 0.2);

    klines.push({
      symbol,
      interval,
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      trades,
      takerBuyBaseVolume: takerBuyBase,
      takerBuyQuoteVolume: takerBuyBase * ((open + close) / 2),
    });

    price = close;
  }

  return klines;
};

export const nextKline = (prev: TestKline, seed: number): TestKline => {
  const rng = mulberry32(seed);
  const intervalMs = (prev.closeTime - prev.openTime) + 1;
  const drift = (rng.next() - 0.5) * 0.008;
  const open = prev.close;
  const close = open * (1 + drift);
  const wick = Math.abs(drift) * open * 1.5;
  return {
    ...prev,
    openTime: prev.openTime + intervalMs,
    closeTime: prev.closeTime + intervalMs,
    open,
    high: Math.max(open, close) + wick * rng.next(),
    low: Math.min(open, close) - wick * rng.next(),
    close,
    volume: 100 + rng.next() * 900,
  };
};
