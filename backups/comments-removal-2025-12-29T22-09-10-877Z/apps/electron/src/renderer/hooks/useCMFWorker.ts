import { workerPool } from '@/renderer/utils/WorkerPool';
import type { CMFResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'cmf';

interface CMFParams {
  period?: number;
}

export const useCMFWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: CMFParams = {}
) => {
  const { period = 20 } = params;
  const [data, setData] = useState<CMFResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(
        WORKER_KEY,
        () =>
          new Worker(new URL('../workers/cmf.worker.ts', import.meta.url), {
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

    const handleMessage = (e: MessageEvent<CMFResult>) => {
      setData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, period });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, period, enabled]);

  return data;
};
