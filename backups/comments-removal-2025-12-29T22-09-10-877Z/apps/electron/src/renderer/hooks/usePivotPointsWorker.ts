import type { PivotAnalysis } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const usePivotPointsWorker = (
  klines: Kline[],
  enabled: boolean = true,
  lookback: number = 5,
): PivotAnalysis | null => {
  const [result, setResult] = useState<PivotAnalysis | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/pivotPoints.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<PivotAnalysis>) => {
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
