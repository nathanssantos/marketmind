import type { Kline } from '@marketmind/types';
import { optimizeKlines } from '../utils/klineOptimization';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; detailedCount?: number }>) => {
  const { klines, detailedCount } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = optimizeKlines(klines, detailedCount);
  self.postMessage(result);
};
