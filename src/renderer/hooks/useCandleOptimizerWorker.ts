import { workerPool } from '@/renderer/utils/WorkerPool';
import type {
    OptimizerWorkerRequest,
    OptimizerWorkerResponse,
    SimplifiedCandle,
} from '@/renderer/workers/candleOptimizer.worker';
import type { Candle } from '@shared/types';
import { useCallback, useEffect, useRef } from 'react';

export interface OptimizedCandleData {
  detailed: Candle[];
  simplified: SimplifiedCandle[];
  timestampInfo: {
    first: number;
    last: number;
    total: number;
    timeframe: string;
  };
}

export interface UseCandleOptimizerWorkerReturn {
  optimizeCandles: (
    candles: Candle[],
    detailedCount?: number
  ) => Promise<OptimizedCandleData>;
  terminate: () => void;
}

export const useCandleOptimizerWorker = (): UseCandleOptimizerWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<
    Map<number, (result: OptimizedCandleData) => void>
  >(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const WORKER_KEY = 'candleOptimizer';
    
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(
          new URL('../workers/candleOptimizer.worker.ts', import.meta.url),
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
          callback(result);
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

  const optimizeCandles = useCallback(
    (candles: Candle[], detailedCount?: number): Promise<OptimizedCandleData> => {
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
          type: 'optimizeCandles',
          candles,
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
    optimizeCandles,
    terminate,
  };
};
