import { calculateKeltner } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; emaPeriod?: number; atrPeriod?: number; multiplier?: number }>) => {
  const { klines, emaPeriod = 20, atrPeriod = 10, multiplier = 2 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateKeltner(klines, emaPeriod, atrPeriod, multiplier);
  self.postMessage(result);
};
