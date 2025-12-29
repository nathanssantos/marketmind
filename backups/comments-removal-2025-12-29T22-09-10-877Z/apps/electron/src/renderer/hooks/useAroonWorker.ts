import type { AroonResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useAroonWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 25,
): AroonResult | null => {
  const [data, setData] = useState<AroonResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/aroon.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<AroonResult | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, period });
  }, [klines, enabled, period]);

  return data;
};
