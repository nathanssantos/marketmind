import { calculateCMF } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface CMFWorkerMessage {
  klines: Kline[];
  period?: number;
}

self.onmessage = (e: MessageEvent<CMFWorkerMessage>) => {
  const { klines, period = 20 } = e.data;
  const result = calculateCMF(klines, period);
  self.postMessage(result);
};
