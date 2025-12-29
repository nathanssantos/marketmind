import { calculateKeltner } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface KeltnerWorkerMessage {
  klines: Kline[];
  emaPeriod?: number;
  atrPeriod?: number;
  multiplier?: number;
}

self.onmessage = (e: MessageEvent<KeltnerWorkerMessage>) => {
  const { klines, emaPeriod = 20, atrPeriod = 10, multiplier = 2 } = e.data;
  const result = calculateKeltner(klines, emaPeriod, atrPeriod, multiplier);
  self.postMessage(result);
};
