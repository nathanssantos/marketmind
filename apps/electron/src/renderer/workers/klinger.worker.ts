import { calculateKlinger } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; fastPeriod?: number; slowPeriod?: number; signalPeriod?: number }>) => {
  const { klines, fastPeriod = 34, slowPeriod = 55, signalPeriod = 13 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateKlinger(klines, fastPeriod, slowPeriod, signalPeriod);
  self.postMessage(result);
};
