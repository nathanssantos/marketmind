import { calculateUltimateOscillator } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface WorkerMessage {
  klines: Kline[];
  shortPeriod?: number;
  midPeriod?: number;
  longPeriod?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { klines, shortPeriod = 7, midPeriod = 14, longPeriod = 28 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateUltimateOscillator(klines, shortPeriod, midPeriod, longPeriod);
  self.postMessage(result);
};
