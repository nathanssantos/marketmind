import { calculateStochRSI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface StochRSIWorkerMessage {
  klines: Kline[];
  rsiPeriod?: number;
  stochPeriod?: number;
  kSmooth?: number;
  dSmooth?: number;
}

self.onmessage = (e: MessageEvent<StochRSIWorkerMessage>) => {
  const { klines, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3 } = e.data;
  const result = calculateStochRSI(klines, rsiPeriod, stochPeriod, kSmooth, dSmooth);
  self.postMessage(result);
};
