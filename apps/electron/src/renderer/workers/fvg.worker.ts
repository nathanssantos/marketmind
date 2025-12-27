import { calculateFVG, type FVGResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[] }>) => {
  const { klines } = event.data;
  const result: FVGResult = calculateFVG(klines);
  self.postMessage(result);
};
