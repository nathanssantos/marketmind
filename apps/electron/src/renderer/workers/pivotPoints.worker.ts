import { analyzePivots, type PivotAnalysis } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

self.onmessage = (event: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 5 } = event.data;
  const result: PivotAnalysis = analyzePivots(klines, { lookback });
  self.postMessage(result);
};
