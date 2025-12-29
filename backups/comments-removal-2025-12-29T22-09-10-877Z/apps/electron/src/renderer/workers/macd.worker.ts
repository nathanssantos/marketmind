import { calculateMACD, type MACDResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; fast: number; slow: number; signal: number }>) => {
  const { klines, fast, slow, signal } = event.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result: MACDResult = calculateMACD(klines, fast, slow, signal);
  self.postMessage(result);
};
