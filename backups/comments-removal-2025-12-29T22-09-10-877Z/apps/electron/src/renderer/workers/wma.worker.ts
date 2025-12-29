import { calculateWMA, type WMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 20 } = event.data;
  const result: WMAResult = calculateWMA(klines, period);
  self.postMessage(result);
};
