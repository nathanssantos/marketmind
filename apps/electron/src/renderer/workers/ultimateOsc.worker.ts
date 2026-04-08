import { calculateUltimateOscillator } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; shortPeriod?: number; midPeriod?: number; longPeriod?: number }>) => {
  const { klines, shortPeriod = 7, midPeriod = 14, longPeriod = 28 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateUltimateOscillator(klines, shortPeriod, midPeriod, longPeriod);
  self.postMessage(result);
};
