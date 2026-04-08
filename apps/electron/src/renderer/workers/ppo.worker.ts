import { calculatePPO } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; fastPeriod?: number; slowPeriod?: number; signalPeriod?: number }>) => {
  const { klines, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculatePPO(klines, fastPeriod, slowPeriod, signalPeriod);
  self.postMessage(result);
};
