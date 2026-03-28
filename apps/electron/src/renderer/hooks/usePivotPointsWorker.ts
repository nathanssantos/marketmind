import type { PivotAnalysis } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const usePivotPointsWorker = (
  klines: Kline[],
  enabled: boolean = true,
  lookback: number = 5,
): PivotAnalysis | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, lookback } : null,
    [klines, lookback],
  );

  return useWorkerComputation<PivotAnalysis>(
    'pivotPoints',
    () => new Worker(new URL('../workers/pivotPoints.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
