import { calculateParabolicSAR } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface ParabolicSARWorkerMessage {
  klines: Kline[];
  afStart?: number;
  afIncrement?: number;
  afMax?: number;
}

self.onmessage = (e: MessageEvent<ParabolicSARWorkerMessage>) => {
  const { klines, afStart = 0.02, afIncrement = 0.02, afMax = 0.2 } = e.data;
  const result = calculateParabolicSAR(klines, afStart, afIncrement, afMax);
  self.postMessage(result);
};
