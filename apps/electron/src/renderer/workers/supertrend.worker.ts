import { calculateSupertrend } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period: number; multiplier: number }>) => {
  const { klines, period, multiplier } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateSupertrend(klines, period, multiplier);
  self.postMessage(result);
};
