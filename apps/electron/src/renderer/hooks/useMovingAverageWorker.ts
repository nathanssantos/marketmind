import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  enabled: boolean;
}

export interface MovingAverageResult {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  values: (number | null)[];
}

export const useMovingAverageWorker = (
  klines: Kline[],
  configs: MovingAverageConfig[],
  enabled: boolean = true,
): MovingAverageResult[] | null => {
  const message = useMemo(
    () => klines.length > 0 && configs.length > 0 ? { type: 'calculate', klines, configs } : null,
    [klines, configs],
  );

  return useWorkerComputation<MovingAverageResult[]>(
    'movingAverages',
    () => new Worker(new URL('../workers/movingAverages.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
