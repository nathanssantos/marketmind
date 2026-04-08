import { calculateVortex } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 14 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateVortex(klines, period);
  self.postMessage(result);
};
