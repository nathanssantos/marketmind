import type { IchimokuResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useIchimokuWorker = (
  klines: Kline[],
  enabled: boolean = true,
  tenkan: number = 9,
  kijun: number = 26,
  senkou: number = 52
): IchimokuResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, tenkan, kijun, senkou } : null,
    [klines, tenkan, kijun, senkou],
  );

  return useWorkerComputation<IchimokuResult>(
    'ichimoku',
    () => new Worker(new URL('../workers/ichimoku.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
