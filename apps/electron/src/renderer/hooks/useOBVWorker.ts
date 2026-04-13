import type { OBVResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface OBVParams {
  smaPeriod?: number;
}

export const useOBVWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: OBVParams = {}
) => {
  const { smaPeriod } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, smaPeriod } : null,
    [klines, smaPeriod],
  );

  return useWorkerComputation<OBVResult>(
    'obv',
    () => new Worker(new URL('../workers/obv.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
