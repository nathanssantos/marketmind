import { calculateHMA, type HMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; period?: number }>) => {
  const { klines, period = 20 } = event.data;
  const result: HMAResult = calculateHMA(klines, period);
  self.postMessage(result);
};
