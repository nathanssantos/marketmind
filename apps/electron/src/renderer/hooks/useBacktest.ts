import type { Kline } from '@shared/types';
import type { BacktestConfig, BacktestResult } from '@shared/types/backtesting';
import { useCallback, useState } from 'react';
import { BacktestOrchestrator } from '../services/backtesting';

interface UseBacktestReturn {
  result: BacktestResult | null;
  isRunning: boolean;
  progress: number;
  error: string | null;
  runBacktest: (config: BacktestConfig, klines: Kline[]) => Promise<void>;
  reset: () => void;
}

export const useBacktest = (): UseBacktestReturn => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(async (config: BacktestConfig, klines: Kline[]) => {
    setIsRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const orchestrator = new BacktestOrchestrator();
      const backtestResult = await orchestrator.runBacktest(
        config,
        klines,
        (progressValue) => setProgress(progressValue)
      );

      if (backtestResult.status === 'FAILED') {
        setError(backtestResult.error || 'Backtest failed');
      }

      setResult(backtestResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setIsRunning(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    result,
    isRunning,
    progress,
    error,
    runBacktest,
    reset,
  };
};
