import { computeSingle } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 14 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const values = await computeSingle('mfi', klines, { period });
  self.postMessage(values);
};
