import type { IchimokuResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useIchimokuWorker = (
  klines: Kline[],
  enabled: boolean = true,
  tenkan: number = 9,
  kijun: number = 26,
  senkou: number = 52
): IchimokuResult | null => {
  const [result, setResult] = useState<IchimokuResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/ichimoku.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<IchimokuResult | null>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines, tenkan, kijun, senkou });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled, tenkan, kijun, senkou]);

  return result;
};
