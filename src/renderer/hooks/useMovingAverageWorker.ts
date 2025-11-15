import type { Candle } from '@shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkerRequest, WorkerResponse } from '../workers/movingAverages.worker';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  enabled: boolean;
}

export interface MovingAverageResult {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  values: (number | null)[];
}

export const useMovingAverageWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [results, setResults] = useState<MovingAverageResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/movingAverages.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.type === 'result') {
        setResults(event.data.results);
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculate = useCallback((candles: Candle[], configs: MovingAverageConfig[]) => {
    if (!workerRef.current || candles.length === 0) {
      setResults([]);
      return;
    }

    setIsCalculating(true);
    
    const request: WorkerRequest = {
      type: 'calculate',
      candles,
      configs,
    };

    workerRef.current.postMessage(request);
  }, []);

  return {
    calculate,
    results,
    isCalculating,
  };
};
