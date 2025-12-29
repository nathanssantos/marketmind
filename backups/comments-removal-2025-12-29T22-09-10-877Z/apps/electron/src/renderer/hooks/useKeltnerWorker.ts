import { workerPool } from '@/renderer/utils/WorkerPool';
import type { KeltnerResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'keltner';

interface KeltnerParams {
  emaPeriod?: number;
  atrPeriod?: number;
  multiplier?: number;
}

export const useKeltnerWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: KeltnerParams = {}
) => {
  const { emaPeriod = 20, atrPeriod = 10, multiplier = 2 } = params;
  const [data, setData] = useState<KeltnerResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(
        WORKER_KEY,
        () =>
          new Worker(new URL('../workers/keltner.worker.ts', import.meta.url), {
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

    const handleMessage = (e: MessageEvent<KeltnerResult>) => {
      setData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, emaPeriod, atrPeriod, multiplier });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, emaPeriod, atrPeriod, multiplier, enabled]);

  return data;
};
