import type { ParabolicSARResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface ParabolicSARParams {
  afStart?: number;
  afIncrement?: number;
  afMax?: number;
}

export const useParabolicSARWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: ParabolicSARParams = {}
) => {
  const { afStart = 0.02, afIncrement = 0.02, afMax = 0.2 } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, afStart, afIncrement, afMax } : null,
    [klines, afStart, afIncrement, afMax],
  );

  return useWorkerComputation<ParabolicSARResult>(
    'parabolicSar',
    () => new Worker(new URL('../workers/parabolicSar.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
