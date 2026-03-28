import { calculateStochastic } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; kPeriod: number; kSmoothing: number; dPeriod: number }>) => {
  const { klines, kPeriod, kSmoothing, dPeriod } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateStochastic(klines, kPeriod, kSmoothing, dPeriod);
  self.postMessage(result);
};
