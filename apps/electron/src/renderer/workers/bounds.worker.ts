import type { Kline } from '@marketmind/types';
import { calculateBounds } from '../utils/boundsCalculation';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; viewportStart: number; viewportEnd: number }>) => {
  const { klines, viewportStart, viewportEnd } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateBounds(klines, viewportStart, viewportEnd);
  self.postMessage(result);
};
