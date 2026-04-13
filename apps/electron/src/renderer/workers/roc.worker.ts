import { computeSingle } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 12 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const values = await computeSingle('roc', klines, { period });
  self.postMessage({ values });
};
