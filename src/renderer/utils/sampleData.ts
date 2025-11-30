import type { Kline } from '@shared/types';

const generateRandomCandles = (count: number, basePrice: number = 50000): Kline[] => {
  const candles: Kline[] = [];
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

    candles.push({
      timestamp: startTime + i * 60000,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
};

export const SAMPLE_CANDLES: Kline[] = generateRandomCandles(200, 50000);
