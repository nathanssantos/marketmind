import type { ADXResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useADXWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 14
): ADXResult | null => {
  const [result, setResult] = useState<ADXResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/adx.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<ADXResult | null>) => {
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
