import { calculateMACD } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; fast: number; slow: number; signal: number }>) => {
  const { klines, fast, slow, signal } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateMACD(klines, fast, slow, signal);
  self.postMessage(result);
};
