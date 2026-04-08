import { computeMulti } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; emaPeriod?: number; atrPeriod?: number; multiplier?: number }>) => {
  const { klines, emaPeriod = 20, multiplier = 2 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeMulti('kc', klines, { period: emaPeriod, multiplier });
  self.postMessage(result);
};
