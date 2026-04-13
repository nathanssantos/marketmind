import type { LiquidityLevel } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useLiquidityLevelsWorker = (
  klines: Kline[],
  enabled: boolean = true,
  lookback: number = 50,
): LiquidityLevel[] | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, lookback } : null,
    [klines, lookback],
  );

  return useWorkerComputation<LiquidityLevel[]>(
    'liquidityLevels',
    () => new Worker(new URL('../workers/liquidityLevels.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
