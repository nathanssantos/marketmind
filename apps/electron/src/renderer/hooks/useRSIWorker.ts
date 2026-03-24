import { workerPool } from '@/renderer/utils/WorkerPool';
import type { RSIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useRSIWorker = (klines: Kline[], period: number = 2, enabled: boolean = false) => {
  const [rsiData, setRSIData] = useState<RSIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerKey = `rsi-${period}`;

  useEffect(() => {
    if (!workerPool.has(workerKey)) {
      workerPool.register(workerKey, () =>
        new Worker(new URL('../workers/rsi.worker.ts', import.meta.url), {
          type: 'module',
        })
      );
    }

    workerRef.current = workerPool.get(workerKey);
  }, [workerKey]);

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
