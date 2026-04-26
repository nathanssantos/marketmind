import type {
  BacktestCompletePayload,
  BacktestFailedPayload,
  BacktestProgressPayload,
  SimpleBacktestInput,
} from '@marketmind/types';
import { useCallback, useState } from 'react';
import { trpc } from '../utils/trpc';
import { useSocketEvent } from './socket/useSocketEvent';

export type BacktestRunStatus = 'idle' | 'running' | 'success' | 'failed';

interface BacktestRunState {
  backtestId: string | null;
  resultId: string | null;
  status: BacktestRunStatus;
  progress: BacktestProgressPayload | null;
  error: string | null;
}

const INITIAL_STATE: BacktestRunState = {
  backtestId: null,
  resultId: null,
  status: 'idle',
  progress: null,
  error: null,
};

export const useBacktestRun = () => {
  const [state, setState] = useState<BacktestRunState>(INITIAL_STATE);

  const runMutation = trpc.backtest.run.useMutation();

  const resultQuery = trpc.backtest.getResult.useQuery(
    { id: state.resultId ?? '' },
    { enabled: !!state.resultId },
  );

  const start = useCallback(
    async (input: SimpleBacktestInput) => {
      setState({ ...INITIAL_STATE, status: 'running' });
      try {
        const { backtestId } = await runMutation.mutateAsync(input);
        setState((prev) => ({ ...prev, backtestId }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start backtest';
        setState({ ...INITIAL_STATE, status: 'failed', error: message });
      }
    },
    [runMutation],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  useSocketEvent(
    'backtest:progress',
    (payload: BacktestProgressPayload) => {
      setState((prev) => {
        if (prev.backtestId !== payload.backtestId) return prev;
        return { ...prev, progress: payload };
      });
    },
    state.status === 'running',
  );

  useSocketEvent(
    'backtest:complete',
    (payload: BacktestCompletePayload) => {
      setState((prev) => {
        if (prev.backtestId !== payload.backtestId) return prev;
        return { ...prev, status: 'success', resultId: payload.resultId };
      });
    },
    state.status === 'running',
  );

  useSocketEvent(
    'backtest:failed',
    (payload: BacktestFailedPayload) => {
      setState((prev) => {
        if (prev.backtestId !== payload.backtestId) return prev;
        return { ...prev, status: 'failed', error: payload.error };
      });
    },
    state.status === 'running',
  );

  return {
    status: state.status,
    progress: state.progress,
    backtestId: state.backtestId,
    error: state.error,
    result: resultQuery.data,
    isFetchingResult: resultQuery.isLoading && !!state.resultId,
    start,
    reset,
  } as const;
};
