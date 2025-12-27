import type { KlingerResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useKlingerWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 34,
  slowPeriod = 55,
  signalPeriod = 13,
): KlingerResult | null => {
  const [data, setData] = useState<KlingerResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/klinger.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<KlingerResult | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, fastPeriod, slowPeriod, signalPeriod });
  }, [klines, enabled, fastPeriod, slowPeriod, signalPeriod]);

  return data;
};
