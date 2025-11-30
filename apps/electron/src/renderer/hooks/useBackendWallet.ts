import { useCallback } from 'react';
import { trpc } from '../utils/trpc';

export const useBackendWallet = () => {
  const utils = trpc.useUtils();
  
  const { data: wallets, isLoading } = trpc.wallet.list.useQuery();
  
  const createMutation = trpc.wallet.create.useMutation({
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
  
  const testConnectionMutation = trpc.wallet.testConnection.useMutation();
  
  const createWallet = useCallback(
    async (data: { name: string; exchange: string; apiKey: string; apiSecret: string }) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation]
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
  
  const testConnection = useCallback(
    async (apiKey: string, apiSecret: string) => {
      return testConnectionMutation.mutateAsync({ apiKey, apiSecret });
    },
    [testConnectionMutation]
  );
  
  return {
    wallets: wallets ?? [],
    isLoading,
    createWallet,
    updateWallet,
    deleteWallet,
    syncBalance,
    testConnection,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSyncing: syncBalanceMutation.isPending,
    isTesting: testConnectionMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    syncError: syncBalanceMutation.error,
    testError: testConnectionMutation.error,
  };
};
