import { workerPool } from '@/renderer/utils/WorkerPool';
import type { StochasticResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';

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
  const currentHandlersRef = useRef<{ message: ((e: MessageEvent) => void) | null; error: ((e: ErrorEvent) => void) | null }>({
    message: null,
    error: null,
  });

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

    return () => {
      if (workerRef.current) {
        if (currentHandlersRef.current.message) {
          workerRef.current.removeEventListener('message', currentHandlersRef.current.message);
        }
        if (currentHandlersRef.current.error) {
          workerRef.current.removeEventListener('error', currentHandlersRef.current.error);
        }
      }
    };
  }, []);

  const calculateStochastic = useCallback((
    klines: Kline[],
    kPeriod: number,
    dPeriod: number
  ): Promise<StochasticResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      if (currentHandlersRef.current.message) {
        workerRef.current.removeEventListener('message', currentHandlersRef.current.message);
      }
      if (currentHandlersRef.current.error) {
        workerRef.current.removeEventListener('error', currentHandlersRef.current.error);
      }

      const handleMessage = (event: MessageEvent): void => {
        const { type, k, d } = event.data;

        if (type === 'stochasticResult') {
          workerRef.current?.removeEventListener('message', handleMessage);
          workerRef.current?.removeEventListener('error', handleError);
          currentHandlersRef.current = { message: null, error: null };
          resolve({ k, d });
        }
      };

      const handleError = (error: ErrorEvent): void => {
        workerRef.current?.removeEventListener('message', handleMessage);
        workerRef.current?.removeEventListener('error', handleError);
        currentHandlersRef.current = { message: null, error: null };
        reject(error);
      };

      currentHandlersRef.current = { message: handleMessage, error: handleError };
      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.addEventListener('error', handleError);

      workerRef.current.postMessage({
        type: 'calculateStochastic',
        klines,
        kPeriod,
        dPeriod,
      });
    });
  }, []);

  const terminate = useCallback((): void => {
    workerPool.terminate(WORKER_KEY);
  }, []);

  return { calculateStochastic, terminate };
};
