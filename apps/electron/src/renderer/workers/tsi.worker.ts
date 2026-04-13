import { computeTSI } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; longPeriod?: number; shortPeriod?: number; signalPeriod?: number }>) => {
  const { klines, longPeriod = 25, shortPeriod = 13, signalPeriod = 13 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeTSI(klines, longPeriod, shortPeriod, signalPeriod);
  self.postMessage(result);
};
