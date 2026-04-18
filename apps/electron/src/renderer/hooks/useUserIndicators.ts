import { trpc } from '../utils/trpc';

export const useUserIndicators = () => {
  const utils = trpc.useUtils();
  const invalidate = (): Promise<void> => utils.userIndicators.list.invalidate();

  const list = trpc.userIndicators.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const create = trpc.userIndicators.create.useMutation({ onSuccess: invalidate });
  const update = trpc.userIndicators.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.userIndicators.delete.useMutation({ onSuccess: invalidate });
  const duplicate = trpc.userIndicators.duplicate.useMutation({ onSuccess: invalidate });
  const reset = trpc.userIndicators.reset.useMutation({ onSuccess: invalidate });

  return {
    indicators: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    create,
    update,
    remove,
    duplicate,
    reset,
  };
};
