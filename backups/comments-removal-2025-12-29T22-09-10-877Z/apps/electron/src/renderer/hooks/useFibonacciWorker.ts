import type { FibonacciResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useFibonacciWorker = (
  klines: Kline[],
  enabled: boolean = true,
  lookback: number = 50,
): FibonacciResult | null => {
  const [result, setResult] = useState<FibonacciResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/fibonacci.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<FibonacciResult | null>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines, lookback });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled, lookback]);

  return result;
};
