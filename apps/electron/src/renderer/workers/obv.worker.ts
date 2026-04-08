import { computeOBV } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; smaPeriod?: number }>) => {
  const { klines, smaPeriod } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeOBV(klines, smaPeriod);
  self.postMessage(result);
};
