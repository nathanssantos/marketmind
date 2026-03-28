import { workerPool } from '@/renderer/utils/WorkerPool';
import { useEffect, useRef, useState, useCallback } from 'react';

let globalRequestId = 0;

export const useWorkerComputation = <TResult>(
  workerKey: string,
  workerFactory: () => Worker,
  message: Record<string, unknown> | null,
  enabled: boolean,
): TResult | null => {
  const [result, setResult] = useState<TResult | null>(null);
  const activeRequestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  const factory = useCallback(workerFactory, [workerKey]);

  useEffect(() => {
    if (!workerPool.has(workerKey)) workerPool.register(workerKey, factory);
    workerRef.current = workerPool.get(workerKey);
  }, [workerKey, factory]);

  useEffect(() => {
    if (!enabled || !message) {
      setResult(null);
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    const requestId = ++globalRequestId;
    activeRequestIdRef.current = requestId;

    const handleMessage = (e: MessageEvent) => {
      if (activeRequestIdRef.current !== requestId) return;
      setResult(e.data as TResult);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [workerKey, message, enabled]);

  return result;
};
