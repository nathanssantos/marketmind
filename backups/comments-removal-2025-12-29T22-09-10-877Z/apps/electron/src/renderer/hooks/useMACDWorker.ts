import type { MACDResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';

export const useMACDWorker = (
  klines: Kline[],
  enabled: boolean = true,
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDResult | null => {
  const [result, setResult] = useState<MACDResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setResult(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/macd.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<MACDResult | null>) => {
      setResult(event.data);
    };

    worker.postMessage({ klines, fast, slow, signal });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [klines, enabled, fast, slow, signal]);

  return result;
};
