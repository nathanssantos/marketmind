import { calculateAO } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; fastPeriod?: number; slowPeriod?: number }>) => {
  const { klines, fastPeriod = 5, slowPeriod = 34 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateAO(klines, fastPeriod, slowPeriod);
  self.postMessage(result);
};
