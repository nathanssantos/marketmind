import type { UltimateOscillatorResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useUltimateOscWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  shortPeriod = 7,
  midPeriod = 14,
  longPeriod = 28,
): UltimateOscillatorResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, shortPeriod, midPeriod, longPeriod } : null,
    [klines, shortPeriod, midPeriod, longPeriod],
  );

  return useWorkerComputation<UltimateOscillatorResult>(
    'ultimateOsc',
    () => new Worker(new URL('../workers/ultimateOsc.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
