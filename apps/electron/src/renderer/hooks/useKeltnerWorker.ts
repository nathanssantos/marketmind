import type { KeltnerResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface KeltnerParams {
  emaPeriod?: number;
  atrPeriod?: number;
  multiplier?: number;
}

export const useKeltnerWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: KeltnerParams = {}
) => {
  const { emaPeriod = 20, atrPeriod = 10, multiplier = 2 } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, emaPeriod, atrPeriod, multiplier } : null,
    [klines, emaPeriod, atrPeriod, multiplier],
  );

  return useWorkerComputation<KeltnerResult>(
    'keltner',
    () => new Worker(new URL('../workers/keltner.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
