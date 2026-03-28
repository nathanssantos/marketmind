import { calculateStochRSI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; rsiPeriod?: number; stochPeriod?: number; kSmooth?: number; dSmooth?: number }>) => {
  const { klines, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateStochRSI(klines, rsiPeriod, stochPeriod, kSmooth, dSmooth);
  self.postMessage(result);
};
