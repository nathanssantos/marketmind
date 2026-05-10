import type { PatternDefinition } from '@marketmind/trading-core';
import { trpc } from '../utils/trpc';

export interface UserPattern {
  id: string;
  patternId: string;
  label: string;
  definition: PatternDefinition;
  isCustom: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Wraps the userPatterns tRPC procedures. Mutations invalidate the list so
 * the popover and renderer pick up changes without a manual refetch.
 */
export const useUserPatterns = () => {
  const utils = trpc.useUtils();
  const invalidate = (): Promise<void> => utils.userPatterns.list.invalidate();

  const list = trpc.userPatterns.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const create = trpc.userPatterns.create.useMutation({ onSuccess: invalidate });
  const update = trpc.userPatterns.update.useMutation({ onSuccess: invalidate });
  const duplicate = trpc.userPatterns.duplicate.useMutation({ onSuccess: invalidate });
  const remove = trpc.userPatterns.delete.useMutation({ onSuccess: invalidate });
  const reset = trpc.userPatterns.reset.useMutation({ onSuccess: invalidate });

  return {
    patterns: (list.data ?? []) as UserPattern[],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    create, update, duplicate, remove, reset,
  };
};
