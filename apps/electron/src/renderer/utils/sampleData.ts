import type { Kline } from '@marketmind/types';

const generateRandomKlines = (count: number, basePrice: number = 50000): Kline[] => {
  const klines: Kline[] = [];
  let currentPrice = basePrice;
  const startTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * currentPrice * volatility;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000000 + 500000;

    klines.push({
      openTime: startTime + i * 60000,
      closeTime: startTime + (i + 1) * 60000,
      open: open.toString(),
      high: high.toString(),
      low: low.toString(),
      close: close.toString(),
      volume: volume.toString(),
      quoteVolume: '0',
      trades: 0,
      takerBuyBaseVolume: '0',
      takerBuyQuoteVolume: '0',
    });

    currentPrice = close;
  }

  return klines;
};

export const SAMPLE_KLINES: Kline[] = generateRandomKlines(200, 50000);
