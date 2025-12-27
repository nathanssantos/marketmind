import { calculateDonchian } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface DonchianWorkerMessage {
  klines: Kline[];
  period?: number;
}

self.onmessage = (e: MessageEvent<DonchianWorkerMessage>) => {
  const { klines, period = 20 } = e.data;
  const result = calculateDonchian(klines, period);
  self.postMessage(result);
};
