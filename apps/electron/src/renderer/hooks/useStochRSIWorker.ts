import type { StochRSIResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface StochRSIParams {
  rsiPeriod?: number;
  stochPeriod?: number;
  kSmooth?: number;
  dSmooth?: number;
}

export const useStochRSIWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: StochRSIParams = {}
) => {
  const { rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3 } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, rsiPeriod, stochPeriod, kSmooth, dSmooth } : null,
    [klines, rsiPeriod, stochPeriod, kSmooth, dSmooth],
  );

  return useWorkerComputation<StochRSIResult>(
    'stochRsi',
    () => new Worker(new URL('../workers/stochRsi.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
