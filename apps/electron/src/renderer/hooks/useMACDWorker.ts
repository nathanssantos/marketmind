import type { MACDResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useMACDWorker = (
  klines: Kline[],
  enabled: boolean = true,
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, fast, slow, signal } : null,
    [klines, fast, slow, signal],
  );

  return useWorkerComputation<MACDResult>(
    'macd',
    () => new Worker(new URL('../workers/macd.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
