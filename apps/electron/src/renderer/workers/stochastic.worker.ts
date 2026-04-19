import { computeMulti } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; kPeriod: number; kSmoothing: number; dPeriod: number }>) => {
  const { klines, kPeriod, kSmoothing, dPeriod } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeMulti('stoch', klines, { period: kPeriod, smoothK: kSmoothing, smoothD: dPeriod });
  self.postMessage(result);
};
