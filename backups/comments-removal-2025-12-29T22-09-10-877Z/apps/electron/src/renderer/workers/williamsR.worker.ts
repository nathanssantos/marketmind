import { calculateWilliamsR, type WilliamsRResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period: number }>) => {
  const { klines, period } = event.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result: WilliamsRResult = calculateWilliamsR(klines, period);
  self.postMessage(result);
};
