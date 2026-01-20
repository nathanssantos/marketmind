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
      utils.wallet.list.invalidate();
    },
  });

  const createPaperMutation = trpc.wallet.createPaper.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const updateMutation = trpc.wallet.update.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const deleteMutation = trpc.wallet.delete.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const syncBalanceMutation = trpc.wallet.syncBalance.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const syncTransfersMutation = trpc.wallet.syncTransfers.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
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
    isCreating: createMutation.isPending,
    isCreatingPaper: createPaperMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSyncing: syncBalanceMutation.isPending,
    isSyncingTransfers: syncTransfersMutation.isPending,
    createError: createMutation.error,
    createPaperError: createPaperMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    syncError: syncBalanceMutation.error,
    syncTransfersError: syncTransfersMutation.error,
  };
};
