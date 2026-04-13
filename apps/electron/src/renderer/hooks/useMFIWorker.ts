import type { MFIResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useMFIWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 14,
): MFIResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<MFIResult>(
    'mfi',
    () => new Worker(new URL('../workers/mfi.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
