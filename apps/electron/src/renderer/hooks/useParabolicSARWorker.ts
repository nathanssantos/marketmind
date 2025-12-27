import { workerPool } from '@/renderer/utils/WorkerPool';
import type { ParabolicSARResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'parabolicSar';

interface ParabolicSARParams {
  afStart?: number;
  afIncrement?: number;
  afMax?: number;
}

export const useParabolicSARWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: ParabolicSARParams = {}
) => {
  const { afStart = 0.02, afIncrement = 0.02, afMax = 0.2 } = params;
  const [data, setData] = useState<ParabolicSARResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(
        WORKER_KEY,
        () =>
          new Worker(new URL('../workers/parabolicSar.worker.ts', import.meta.url), {
            type: 'module',
          })
      );
    }

    workerRef.current = workerPool.get(WORKER_KEY);
  }, []);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setData(null);
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    const handleMessage = (e: MessageEvent<ParabolicSARResult>) => {
      setData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, afStart, afIncrement, afMax });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, afStart, afIncrement, afMax, enabled]);

  return data;
};
