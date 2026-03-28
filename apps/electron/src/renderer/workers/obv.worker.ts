import { calculateOBV } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; smaPeriod?: number }>) => {
  const { klines, smaPeriod } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateOBV(klines, smaPeriod);
  self.postMessage(result);
};
