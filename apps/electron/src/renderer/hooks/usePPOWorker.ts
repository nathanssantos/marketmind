import type { PPOResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const usePPOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): PPOResult | null => {
  const [data, setData] = useState<PPOResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/ppo.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<PPOResult | null>) => {
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
