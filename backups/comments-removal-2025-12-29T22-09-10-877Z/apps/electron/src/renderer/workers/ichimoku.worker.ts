import { calculateIchimoku, type IchimokuResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; tenkan: number; kijun: number; senkou: number }>) => {
  const { klines, tenkan, kijun, senkou } = event.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result: IchimokuResult = calculateIchimoku(klines, tenkan, kijun, senkou);
  self.postMessage(result);
};
