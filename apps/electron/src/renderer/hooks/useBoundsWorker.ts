import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export const useBoundsWorker = (
  klines: Kline[],
  viewportStart: number,
  viewportEnd: number,
  enabled: boolean = true,
): Bounds | null => {
  const message = useMemo(
    () => klines.length > 0 ? { type: 'calculateBounds', klines, viewportStart, viewportEnd } : null,
    [klines, viewportStart, viewportEnd],
  );

  return useWorkerComputation<Bounds>(
    'bounds',
    () => new Worker(new URL('../workers/bounds.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
