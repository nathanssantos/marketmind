import type { CMOResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useCMOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 14,
): CMOResult | null => {
  const [data, setData] = useState<CMOResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/cmo.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<CMOResult | null>) => {
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
