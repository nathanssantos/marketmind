import type { Candle } from '@shared/types';
import { useEffect, useRef, useState } from 'react';
import type { RSIResult } from '../utils/rsi';

export const useRSIWorker = (candles: Candle[], period: number = 2, enabled: boolean = false) => {
  const [rsiData, setRSIData] = useState<RSIResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || candles.length === 0) {
      setRSIData(null);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/rsi.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const worker = workerRef.current;

    const handleMessage = (e: MessageEvent<RSIResult>) => {
      setRSIData(e.data);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ candles, period });

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [candles, period, enabled]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return rsiData;
};
