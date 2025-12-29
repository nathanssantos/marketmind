import type { AOResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useAOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 5,
  slowPeriod = 34,
): AOResult | null => {
  const [data, setData] = useState<AOResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/ao.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<AOResult | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, fastPeriod, slowPeriod });
  }, [klines, enabled, fastPeriod, slowPeriod]);

  return data;
};
