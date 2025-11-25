import type { Candle } from '@shared/types';
import { useEffect, useRef } from 'react';
import type { StochasticResult } from '../utils/stochastic';

export interface UseStochasticWorkerReturn {
  calculateStochastic: (
    candles: Candle[],
    kPeriod: number,
    dPeriod: number
  ) => Promise<StochasticResult>;
  terminate: () => void;
}

export const useStochasticWorker = (): UseStochasticWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/stochastic.worker.ts', import.meta.url),
      { type: 'module' }
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculateStochastic = (
    candles: Candle[],
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
        candles,
        kPeriod,
        dPeriod,
      });
    });
  };

  const terminate = (): void => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  return { calculateStochastic, terminate };
};
