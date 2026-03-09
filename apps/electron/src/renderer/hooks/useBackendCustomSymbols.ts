import { trpc } from '../utils/trpc';

export const useBackendCustomSymbols = () => {
  const utils = trpc.useUtils();

  const customSymbols = trpc.customSymbol.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const createCustomSymbol = trpc.customSymbol.create.useMutation({
    onSuccess: () => utils.customSymbol.list.invalidate(),
  });

  const updateCustomSymbol = trpc.customSymbol.update.useMutation({
    onSuccess: () => utils.customSymbol.list.invalidate(),
  });

  const deleteCustomSymbolMutation = trpc.customSymbol.delete.useMutation({
    onSuccess: () => utils.customSymbol.list.invalidate(),
  });

  const deleteCustomSymbol = {
    ...deleteCustomSymbolMutation,
    mutateAsync: (id: number) => deleteCustomSymbolMutation.mutateAsync({ id }),
  };

  const rebalanceCustomSymbolMutation = trpc.customSymbol.rebalance.useMutation({
    onSuccess: () => utils.customSymbol.list.invalidate(),
  });

  const rebalanceCustomSymbol = {
    ...rebalanceCustomSymbolMutation,
    mutateAsync: (id: number) => rebalanceCustomSymbolMutation.mutateAsync({ id }),
  };

  return {
    customSymbols,
    createCustomSymbol,
    updateCustomSymbol,
    deleteCustomSymbol,
    rebalanceCustomSymbol,
  };
};
