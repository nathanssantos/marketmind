import { calculateIchimoku } from '../lib/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (e: MessageEvent<{ klines: Kline[]; tenkan: number; kijun: number; senkou: number }>) => {
  const { klines, tenkan, kijun, senkou } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = calculateIchimoku(klines, tenkan, kijun, senkou);
  self.postMessage(result);
};
