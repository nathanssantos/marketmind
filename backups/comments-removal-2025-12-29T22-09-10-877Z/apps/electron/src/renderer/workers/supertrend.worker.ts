import { calculateSupertrend, type SupertrendResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period: number; multiplier: number }>) => {
  const { klines, period, multiplier } = event.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result: SupertrendResult = calculateSupertrend(klines, period, multiplier);
  self.postMessage(result);
};
