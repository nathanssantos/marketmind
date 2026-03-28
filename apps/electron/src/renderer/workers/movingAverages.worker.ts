import { calculateMovingAverages, type MAConfig } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; configs: MAConfig[] }>) => {
  const { klines, configs } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateMovingAverages(klines, configs);
  self.postMessage(result);
};
