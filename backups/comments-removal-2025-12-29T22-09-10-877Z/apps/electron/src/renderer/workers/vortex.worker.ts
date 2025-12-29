import { calculateVortex } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface WorkerMessage {
  klines: Kline[];
  period?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { klines, period = 14 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateVortex(klines, period);
  self.postMessage(result);
};
