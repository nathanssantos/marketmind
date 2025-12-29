import type { DEMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useDEMAWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 21,
): DEMAResult | null => {
  const [result, setResult] = useState<DEMAResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/dema.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<DEMAResult>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines, period });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled, period]);

  return result;
};
