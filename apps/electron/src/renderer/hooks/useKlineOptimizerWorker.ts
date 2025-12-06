import { workerPool } from '@/renderer/utils/WorkerPool';
import type {
  OptimizerWorkerRequest,
  OptimizerWorkerResponse,
  SimplifiedKline,
} from '@/renderer/workers/klineOptimizer.worker';
import type { Kline } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';

export interface OptimizedKlineData {
  detailed: Kline[];
  simplified: SimplifiedKline[];
  timestampInfo: {
    first: number;
    last: number;
    total: number;
    timeframe: string;
  };
}

export interface UseKlineOptimizerWorkerReturn {
  optimizeKlines: (
    klines: Kline[],
    detailedCount?: number
  ) => Promise<OptimizedKlineData>;
  terminate: () => void;
}

export const useKlineOptimizerWorker = (): UseKlineOptimizerWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<
    Map<number, (result: OptimizedKlineData) => void>
  >(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const WORKER_KEY = 'klineOptimizer';
    
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(
          new URL('../workers/klineOptimizer.worker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }
    
    workerRef.current = workerPool.get(WORKER_KEY);

    const messageHandler = (
      event: MessageEvent<OptimizerWorkerResponse>
    ) => {
      const { type, ...result } = event.data;

      if (type === 'optimizedResult') {
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();

        callbacks.forEach((callback) => {
          callback(result as unknown as OptimizedKlineData);
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

  const optimizeKlines = useCallback(
    (klines: Kline[], detailedCount?: number): Promise<OptimizedKlineData> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve({
            detailed: [],
            simplified: [],
            timestampInfo: {
              first: 0,
              last: 0,
              total: 0,
              timeframe: 'unknown',
            },
          });
          return;
        }

        const requestId = requestIdRef.current++;
        pendingCallbacksRef.current.set(requestId, resolve);

        const request: OptimizerWorkerRequest = {
          type: 'optimizeKlines',
          klines,
          ...(detailedCount !== undefined && { detailedCount }),
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
    optimizeKlines,
    terminate,
  };
};
