import { computeMulti } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; period: number; stdDev: number }>) => {
  const { klines, period, stdDev } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeMulti('bb', klines, { period, stdDev });
  self.postMessage(result);
};
