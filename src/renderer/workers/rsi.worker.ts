import type { Kline } from '@shared/types';
import { calculateRSI } from '../utils/rsi';

self.onmessage = (e: MessageEvent<{ candles: Kline[]; period: number }>) => {
  const { candles, period } = e.data;
  const result = calculateRSI(candles, period);
  self.postMessage(result);
};
