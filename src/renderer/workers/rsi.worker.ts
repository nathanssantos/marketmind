import type { Candle } from '@shared/types';
import { calculateRSI } from '../utils/rsi';

self.onmessage = (e: MessageEvent<{ candles: Candle[]; period: number }>) => {
  const { candles, period } = e.data;
  const result = calculateRSI(candles, period);
  self.postMessage(result);
};
