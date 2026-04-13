import { calculateAutoFibonacci } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 50 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateAutoFibonacci(klines, lookback);
  self.postMessage(result);
};
