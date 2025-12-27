import { calculateAutoFibonacci, type FibonacciResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 50 } = event.data;
  const result: FibonacciResult | null = calculateAutoFibonacci(klines, lookback);
  self.postMessage(result);
};
