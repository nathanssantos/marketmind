import { calculateHMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 20 } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateHMA(klines, period);
  self.postMessage(result);
};
