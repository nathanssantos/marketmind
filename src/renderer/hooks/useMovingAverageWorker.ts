import { workerPool } from '@/renderer/utils/WorkerPool';
import type { Kline } from '@shared/types';
import { useCallback, useEffect, useRef } from 'react';
import type { MAWorkerRequest, WorkerResponse } from '../workers/movingAverages.worker';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  enabled: boolean;
}

export interface MovingAverageResult {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  values: (number | null)[];
}

export interface UseMovingAverageWorkerReturn {
  calculateMovingAverages: (
    klines: Kline[],
    configs: MovingAverageConfig[]
  ) => Promise<MovingAverageResult[]>;
  terminate: () => void;
}

export const useMovingAverageWorker = (): UseMovingAverageWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<
    Map<number, (results: MovingAverageResult[]) => void>
  >(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const WORKER_KEY = 'movingAverages';
    
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(
          new URL('../workers/movingAverages.worker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }
    
    workerRef.current = workerPool.get(WORKER_KEY);

    const messageHandler = (event: MessageEvent<WorkerResponse>) => {
      const { type, results } = event.data;

      if (type === 'result') {
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();

        callbacks.forEach((callback) => {
          callback(results);
        });
      }
    };
    
    if (workerRef.current) {
      workerRef.current.addEventListener('message', messageHandler);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', messageHandler);
      }
      pendingCallbacksRef.current.clear();
    };
  }, []);

  const calculateMovingAverages = useCallback(
    (klines: Kline[], configs: MovingAverageConfig[]): Promise<MovingAverageResult[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || klines.length === 0) {
          resolve([]);
          return;
        }

        const requestId = requestIdRef.current++;
        pendingCallbacksRef.current.set(requestId, resolve);

        const request: MAWorkerRequest = {
          type: 'calculate',
          klines,
          configs,
        };

        workerRef.current.postMessage(request);
      });
    },
    []
  );

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    pendingCallbacksRef.current.clear();
  }, []);

  return {
    calculateMovingAverages,
    terminate,
  };
};
