import { workerPool } from '@/renderer/utils/WorkerPool';
import type { Kline } from '@shared/types';
import { useEffect, useRef } from 'react';
import type { StochasticResult } from '../utils/stochastic';

const WORKER_KEY = 'stochastic';

export interface UseStochasticWorkerReturn {
  calculateStochastic: (
    klines: Kline[],
    kPeriod: number,
    dPeriod: number
  ) => Promise<StochasticResult>;
  terminate: () => void;
}

export const useStochasticWorker = (): UseStochasticWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () =>
        new Worker(
          new URL('../workers/stochastic.worker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }

    workerRef.current = workerPool.get(WORKER_KEY);
  }, []);

  const calculateStochastic = (
    klines: Kline[],
    kPeriod: number,
    dPeriod: number
  ): Promise<StochasticResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent): void => {
        const { type, k, d } = event.data;
        
        if (type === 'stochasticResult') {
          workerRef.current?.removeEventListener('message', handleMessage);
          resolve({ k, d });
        }
      };

      const handleError = (error: ErrorEvent): void => {
        workerRef.current?.removeEventListener('error', handleError);
        reject(error);
      };

      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.addEventListener('error', handleError);

      workerRef.current.postMessage({
        type: 'calculateStochastic',
        klines,
        kPeriod,
        dPeriod,
      });
    });
  };

  const terminate = (): void => {
    workerPool.terminate(WORKER_KEY);
  };

  return { calculateStochastic, terminate };
};
