import { analyzePivots } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 5 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = analyzePivots(klines, { lookback });
  self.postMessage(result);
};
