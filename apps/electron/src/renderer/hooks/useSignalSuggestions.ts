import { useCallback, useEffect } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';
import { usePollingInterval } from './usePollingInterval';

export const useSignalSuggestions = (walletId: string, userId?: string) => {
  const utils = trpc.useUtils();
  const { on, off } = useWebSocket();
  const pollingInterval = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL);

  const { data: suggestions, isLoading } = trpc.signalSuggestions.list.useQuery(
    { walletId, status: 'pending' },
    {
      enabled: !!walletId,
      refetchInterval: pollingInterval,
      staleTime: QUERY_CONFIG.STALE_TIME.FAST,
    }
  );

  useEffect(() => {
    if (!userId) return;

    const handleNewSuggestion = () => {
      void utils.signalSuggestions.list.invalidate();
    };

    on('signal-suggestion', handleNewSuggestion);

    return () => {
      off('signal-suggestion', handleNewSuggestion);
    };
  }, [userId, on, off, utils]);

  const acceptMutation = trpc.signalSuggestions.accept.useMutation({
    onSuccess: () => {
      void utils.signalSuggestions.list.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
    },
  });

  const rejectMutation = trpc.signalSuggestions.reject.useMutation({
    onSuccess: () => {
      void utils.signalSuggestions.list.invalidate();
    },
  });

  const accept = useCallback(
    async (id: string, positionSizePercent?: number) => {
      return acceptMutation.mutateAsync({ id, positionSizePercent });
    },
    [acceptMutation]
  );

  const reject = useCallback(
    async (id: string) => {
      return rejectMutation.mutateAsync({ id });
    },
    [rejectMutation]
  );

  return {
    suggestions: suggestions ?? [],
    isLoading,
    accept,
    reject,
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
