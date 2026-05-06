import { useCallback, useMemo } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

const EMPTY_WALLETS: never[] = [];

export const useBackendWallet = () => {
  const utils = trpc.useUtils();

  const { data: wallets, isLoading } = trpc.wallet.list.useQuery(undefined, {
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });

  const createMutation = trpc.wallet.create.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
    },
  });

  const createPaperMutation = trpc.wallet.createPaper.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
    },
  });

  const updateMutation = trpc.wallet.update.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
    },
  });

  const deleteMutation = trpc.wallet.delete.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
    },
  });

  const syncBalanceMutation = trpc.wallet.syncBalance.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.futuresTrading.getPositions.invalidate();
    },
  });

  const syncTransfersMutation = trpc.wallet.syncTransfers.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
    },
  });

  // Force a full backfill of income events from wallet creation (capped
  // at 6 months by Binance's API horizon). For wallets connected before
  // v1.12 — the previous 30-day lookback silently truncated history,
  // skewing lifetime PnL numbers in the Analytics modal. Re-running this
  // re-fetches every available page; idempotent thanks to the
  // (walletId, binanceTranId) unique index.
  const fullResyncIncomeMutation = trpc.wallet.fullResyncIncome.useMutation({
    onSuccess: () => {
      void utils.wallet.list.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getEquityCurve.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    },
  });

  const createWallet = useCallback(
    async (data: { name: string; apiKey: string; apiSecret: string; walletType: 'testnet' | 'live' }) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  const createPaperWallet = useCallback(
    async (data: { name: string; initialBalance?: string; currency?: string }) => {
      return createPaperMutation.mutateAsync(data);
    },
    [createPaperMutation]
  );
  
  const updateWallet = useCallback(
    async (id: string, data: { name?: string; apiKey?: string; apiSecret?: string }) => {
      return updateMutation.mutateAsync({ id, ...data });
    },
    [updateMutation]
  );
  
  const deleteWallet = useCallback(
    async (id: string) => {
      return deleteMutation.mutateAsync({ id });
    },
    [deleteMutation]
  );
  
  const syncBalance = useCallback(
    async (id: string) => {
      return syncBalanceMutation.mutateAsync({ id });
    },
    [syncBalanceMutation]
  );

  const syncTransfers = useCallback(
    async (id: string) => {
      return syncTransfersMutation.mutateAsync({ id });
    },
    [syncTransfersMutation]
  );

  const fullResyncIncome = useCallback(
    async (id: string) => {
      return fullResyncIncomeMutation.mutateAsync({ id });
    },
    [fullResyncIncomeMutation]
  );

  const stableWallets = useMemo(() => wallets ?? EMPTY_WALLETS, [wallets]);

  return {
    wallets: stableWallets,
    isLoading,
    createWallet,
    createPaperWallet,
    updateWallet,
    deleteWallet,
    syncBalance,
    syncTransfers,
    fullResyncIncome,
    isCreating: createMutation.isPending,
    isCreatingPaper: createPaperMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSyncing: syncBalanceMutation.isPending,
    isSyncingTransfers: syncTransfersMutation.isPending,
    isResyncingIncome: fullResyncIncomeMutation.isPending,
    createError: createMutation.error,
    createPaperError: createPaperMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    syncError: syncBalanceMutation.error,
    syncTransfersError: syncTransfersMutation.error,
    resyncIncomeError: fullResyncIncomeMutation.error,
  };
};
