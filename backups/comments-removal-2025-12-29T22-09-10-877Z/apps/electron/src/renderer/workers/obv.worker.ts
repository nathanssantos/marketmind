import { calculateOBV } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface OBVWorkerMessage {
  klines: Kline[];
  smaPeriod?: number;
}

self.onmessage = (e: MessageEvent<OBVWorkerMessage>) => {
  const { klines, smaPeriod } = e.data;
  const result = calculateOBV(klines, smaPeriod);
  self.postMessage(result);
};
