import type { Candle } from '@shared/types';
import { useCallback, useEffect, useRef } from 'react';
import { workerPool } from '@/renderer/utils/WorkerPool';
import type {
  BoundsWorkerRequest,
  BoundsWorkerResponse,
} from '@/renderer/workers/bounds.worker';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export interface UseBoundsWorkerReturn {
  calculateBounds: (
    candles: Candle[],
    viewportStart: number,
    viewportEnd: number
  ) => Promise<Bounds>;
  terminate: () => void;
}

export const useBoundsWorker = (): UseBoundsWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<Map<number, (bounds: Bounds) => void>>(
    new Map()
  );
  const requestIdRef = useRef(0);

  useEffect(() => {
    const WORKER_KEY = 'bounds';
    
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(
          new URL('../workers/bounds.worker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }
    
    workerRef.current = workerPool.get(WORKER_KEY);

    const messageHandler = (event: MessageEvent<BoundsWorkerResponse>) => {
      const { type, ...bounds } = event.data;

      if (type === 'boundsResult') {
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();

        callbacks.forEach((callback) => {
          callback(bounds);
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

  const calculateBounds = useCallback(
    (
      candles: Candle[],
      viewportStart: number,
      viewportEnd: number
    ): Promise<Bounds> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve({
            minPrice: 0,
            maxPrice: 0,
            minVolume: 0,
            maxVolume: 0,
          });
          return;
        }

        const requestId = requestIdRef.current++;
        pendingCallbacksRef.current.set(requestId, resolve);

        const request: BoundsWorkerRequest = {
          type: 'calculateBounds',
          candles,
          viewportStart,
          viewportEnd,
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
    calculateBounds,
    terminate,
  };
};
