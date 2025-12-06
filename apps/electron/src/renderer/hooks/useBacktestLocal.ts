import type { Kline } from '@marketmind/types';
import type { BacktestConfig, BacktestResult } from '@marketmind/types';
import { useCallback, useState } from 'react';
import { BacktestOrchestrator } from '../services/backtesting';

export interface BacktestProgress {
  percent: number;
  currentKline: number;
  totalKlines: number;
  tradesFound: number;
  currentEquity: number;
  estimatedTimeRemaining: number;
}

interface UseBacktestLocalReturn {
  result: BacktestResult | null;
  isRunning: boolean;
  progress: BacktestProgress | null;
  error: string | null;
  runBacktest: (config: BacktestConfig, klines: Kline[]) => Promise<BacktestResult | null>;
  reset: () => void;
}

export const useBacktestLocal = (): UseBacktestLocalReturn => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(
    async (config: BacktestConfig, klines: Kline[]): Promise<BacktestResult | null> => {
      setIsRunning(true);
      setProgress(null);
      setError(null);
      setResult(null);

      const startTime = Date.now();
      let lastProgressUpdate = startTime;

      try {
        const orchestrator = new BacktestOrchestrator();

        const backtestResult = await orchestrator.runBacktest(
          config,
          klines,
          (progressPercent) => {
            const now = Date.now();
            const elapsed = now - startTime;
            const currentKline = Math.floor((progressPercent / 100) * klines.length);

            // Atualiza no máximo a cada 100ms para não sobrecarregar UI
            if (now - lastProgressUpdate >= 100) {
              const estimatedTotal = elapsed / (progressPercent / 100);
              const estimatedRemaining = Math.max(0, estimatedTotal - elapsed) / 1000;

              setProgress({
                percent: progressPercent,
                currentKline,
                totalKlines: klines.length,
                tradesFound: 0, // Será atualizado ao final
                currentEquity: config.initialCapital, // Será atualizado ao final
                estimatedTimeRemaining: estimatedRemaining,
              });

              lastProgressUpdate = now;
            }
          }
        );

        if (backtestResult.status === 'FAILED') {
          setError(backtestResult.error || 'Backtest failed');
          setIsRunning(false);
          return null;
        }

        // Atualiza progresso final
        setProgress({
          percent: 100,
          currentKline: klines.length,
          totalKlines: klines.length,
          tradesFound: backtestResult.trades.length,
          currentEquity: config.initialCapital + backtestResult.metrics.totalPnl,
          estimatedTimeRemaining: 0,
        });

        setResult(backtestResult);
        return backtestResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setIsRunning(false);
    setProgress(null);
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
