import { computeSupertrend } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; period: number; multiplier: number }>) => {
  const { klines, period, multiplier } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeSupertrend(klines, period, multiplier);
  self.postMessage(result);
};
