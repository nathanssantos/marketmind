import { calculateDEMA, type DEMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 21 } = event.data;
  const result: DEMAResult = calculateDEMA(klines, period);
  self.postMessage(result);
};
