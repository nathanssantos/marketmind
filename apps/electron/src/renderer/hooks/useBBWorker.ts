import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface BBResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export const useBBWorker = (klines: Kline[], period: number = 20, stdDev: number = 2, enabled: boolean = false) => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period, stdDev } : null,
    [klines, period, stdDev],
  );

  return useWorkerComputation<BBResult>(
    `bb-${period}-${stdDev}`,
    () => new Worker(new URL('../workers/bb.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
