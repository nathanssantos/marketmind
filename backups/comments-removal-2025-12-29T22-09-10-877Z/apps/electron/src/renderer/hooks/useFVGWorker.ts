import type { FVGResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useFVGWorker = (
  klines: Kline[],
  enabled: boolean = true,
): FVGResult | null => {
  const [result, setResult] = useState<FVGResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/fvg.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<FVGResult>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled]);

  return result;
};
