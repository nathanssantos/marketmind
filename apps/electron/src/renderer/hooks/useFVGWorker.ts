import type { FVGResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useFVGWorker = (
  klines: Kline[],
  enabled: boolean = true,
): FVGResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines } : null,
    [klines],
  );

  return useWorkerComputation<FVGResult>(
    'fvg',
    () => new Worker(new URL('../workers/fvg.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
