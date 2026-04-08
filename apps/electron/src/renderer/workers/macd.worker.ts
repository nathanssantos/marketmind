import { computeMulti } from './pineWorkerService';
import type { Kline } from '@marketmind/types';

self.onmessage = async (e: MessageEvent<{ klines: Kline[]; fast: number; slow: number; signal: number }>) => {
  const { klines, fast, slow, signal } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  const result = await computeMulti('macd', klines, { fastPeriod: fast, slowPeriod: slow, signalPeriod: signal });
  self.postMessage({ macd: result['line'], signal: result['signal'], histogram: result['histogram'] });
};
