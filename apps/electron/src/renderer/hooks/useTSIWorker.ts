import type { TSIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useTSIWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  longPeriod = 25,
  shortPeriod = 13,
  signalPeriod = 13,
): TSIResult | null => {
  const [data, setData] = useState<TSIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/tsi.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<TSIResult | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, longPeriod, shortPeriod, signalPeriod });
  }, [klines, enabled, longPeriod, shortPeriod, signalPeriod]);

  return data;
};
