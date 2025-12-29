import type { CCIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useCCIWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 20
): CCIResult | null => {
  const [result, setResult] = useState<CCIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/cci.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<CCIResult | null>) => {
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
