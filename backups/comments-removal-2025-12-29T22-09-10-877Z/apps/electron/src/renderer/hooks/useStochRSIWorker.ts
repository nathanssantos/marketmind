import { workerPool } from '@/renderer/utils/WorkerPool';
import type { StochRSIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

const WORKER_KEY = 'stochRsi';

interface StochRSIParams {
  rsiPeriod?: number;
  stochPeriod?: number;
  kSmooth?: number;
  dSmooth?: number;
}

export const useStochRSIWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: StochRSIParams = {}
) => {
  const { rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3 } = params;
  const [data, setData] = useState<StochRSIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(
        WORKER_KEY,
        () =>
          new Worker(new URL('../workers/stochRsi.worker.ts', import.meta.url), {
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

    const handleMessage = (e: MessageEvent<StochRSIResult>) => {
      setData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ klines, rsiPeriod, stochPeriod, kSmooth, dSmooth });

    return () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
      }
    };
  }, [klines, rsiPeriod, stochPeriod, kSmooth, dSmooth, enabled]);

  return data;
};
