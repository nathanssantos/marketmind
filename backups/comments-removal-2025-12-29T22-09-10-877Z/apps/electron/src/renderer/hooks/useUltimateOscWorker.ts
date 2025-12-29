import type { UltimateOscillatorResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useUltimateOscWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  shortPeriod = 7,
  midPeriod = 14,
  longPeriod = 28,
): UltimateOscillatorResult | null => {
  const [data, setData] = useState<UltimateOscillatorResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/ultimateOsc.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (e: MessageEvent<UltimateOscillatorResult | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, shortPeriod, midPeriod, longPeriod });
  }, [klines, enabled, shortPeriod, midPeriod, longPeriod]);

  return data;
};
