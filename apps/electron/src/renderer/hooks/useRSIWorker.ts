import { workerPool } from '@/renderer/utils/WorkerPool';
import type { RSIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'rsi';

export const useRSIWorker = (klines: Kline[], period: number = 2, enabled: boolean = false) => {
  const [rsiData, setRSIData] = useState<RSIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(new URL('../workers/rsi.worker.ts', import.meta.url), {
          type: 'module',
        })
      );
    }

    workerRef.current = workerPool.get(WORKER_KEY);
  }, []);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setRSIData(null);
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    const handleMessage = (e: MessageEvent<RSIResult>) => {
      setRSIData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, period });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, period, enabled]);

  return rsiData;
};
