import type { SupertrendResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useSupertrendWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 10,
  multiplier: number = 3
): SupertrendResult | null => {
  const [result, setResult] = useState<SupertrendResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/supertrend.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<SupertrendResult | null>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines, period, multiplier });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled, period, multiplier]);

  return result;
};
