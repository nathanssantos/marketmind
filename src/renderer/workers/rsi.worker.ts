import type { Kline } from '@shared/types';
import { calculateRSI } from '../utils/rsi';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; period: number }>) => {
  const { klines, period } = e.data;
  const result = calculateRSI(klines, period);
  self.postMessage(result);
};
