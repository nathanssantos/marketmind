import { calculateParabolicSAR } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; afStart?: number; afIncrement?: number; afMax?: number }>) => {
  const { klines, afStart = 0.02, afIncrement = 0.02, afMax = 0.2 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateParabolicSAR(klines, afStart, afIncrement, afMax);
  self.postMessage(result);
};
