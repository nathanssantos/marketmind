import { useEffect, useRef, useState } from 'react';

export const useWorkerComputation = <TResult>(
  workerKey: string,
  workerFactory: () => Worker,
  message: Record<string, unknown> | null,
  enabled: boolean,
): TResult | null => {
  const [result, setResult] = useState<TResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const factoryRef = useRef(workerFactory);
  factoryRef.current = workerFactory;

  useEffect(() => {
    const worker = factoryRef.current();
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [workerKey]);

  useEffect(() => {
    if (!enabled || !message) {
      setResult(null);
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    const handleMessage = (e: MessageEvent) => {
      setResult(e.data as TResult);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [message, enabled]);

  return result;
};
