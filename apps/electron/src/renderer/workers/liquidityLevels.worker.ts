import { calculateLiquidityLevels } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 50 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const highs = klines.map((k) => parseFloat(k.high));
  const lows = klines.map((k) => parseFloat(k.low));
  const closes = klines.map((k) => parseFloat(k.close));

  const result = calculateLiquidityLevels(highs, lows, closes, { lookback });
  self.postMessage(result);
};
