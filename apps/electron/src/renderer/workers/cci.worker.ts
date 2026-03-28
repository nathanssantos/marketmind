import { calculateCCI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period: number }>) => {
  const { klines, period } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateCCI(klines, period);
  self.postMessage(result);
};
