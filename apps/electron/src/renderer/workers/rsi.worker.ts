import { calculateRSI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period: number }>) => {
  const { klines, period } = e.data;
  const result = calculateRSI(klines, period);
  self.postMessage(result);
};
