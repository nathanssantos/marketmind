import { workerPool } from '@/renderer/utils/WorkerPool';
import type { OBVResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'obv';

interface OBVParams {
  smaPeriod?: number;
}

export const useOBVWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: OBVParams = {}
) => {
  const { smaPeriod } = params;
  const [data, setData] = useState<OBVResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(
        WORKER_KEY,
        () =>
          new Worker(new URL('../workers/obv.worker.ts', import.meta.url), {
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

    const handleMessage = (e: MessageEvent<OBVResult>) => {
      setData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, smaPeriod });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, smaPeriod, enabled]);

  return data;
};
