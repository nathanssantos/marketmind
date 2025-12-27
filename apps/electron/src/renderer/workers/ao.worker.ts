import { calculateAO } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface WorkerMessage {
  klines: Kline[];
  fastPeriod?: number;
  slowPeriod?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { klines, fastPeriod = 5, slowPeriod = 34 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateAO(klines, fastPeriod, slowPeriod);
  self.postMessage(result);
};
