import type { IndicatorParamValue } from '@marketmind/trading-core';
import { useIndicatorStore } from '../store/indicatorStore';
import { trpc } from '../utils/trpc';

/**
 * Wraps the userIndicators tRPC procedures so that mutations also keep the
 * client-side `indicatorStore` instances in sync. Without this, the chart
 * would happily render with stale params / orphan references after the user
 * edits, deletes, or resets a userIndicator.
 *
 * Specifically:
 *   - `update`: re-applies the new params onto every active instance whose
 *     `userIndicatorId` matches. Without this, changing color / period /
 *     line width in the dialog wouldn't visibly update the chart until the
 *     user toggled the indicator off and on again.
 *   - `remove`: drops any instance referring to the deleted indicator, so
 *     callers (like the Settings → Indicators library) don't have to
 *     remember to do it themselves. The popover already did this — now the
 *     library inherits the fix for free.
 *   - `reset`: wipes all client-side instances. `useAutoActivateDefaultIndicators`
 *     re-populates the chart on the next render once the new server-side
 *     list arrives.
 */
export const useUserIndicators = () => {
  const utils = trpc.useUtils();
  const invalidate = (): Promise<void> => utils.userIndicators.list.invalidate();

  const list = trpc.userIndicators.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const create = trpc.userIndicators.create.useMutation({ onSuccess: invalidate });

  const update = trpc.userIndicators.update.useMutation({
    onSuccess: (_, variables) => {
      if (variables.params) {
        const store = useIndicatorStore.getState();
        const params = variables.params as Record<string, IndicatorParamValue>;
        for (const inst of store.instances) {
          if (inst.userIndicatorId !== variables.id) continue;
          // Replace (not merge) so dropped keys don't linger. The dialog
          // always sends the full param record.
          store.updateInstance(inst.id, { params: { ...params } });
        }
      }
      return invalidate();
    },
  });

  const remove = trpc.userIndicators.delete.useMutation({
    onSuccess: (_, variables) => {
      useIndicatorStore.getState().removeInstancesByUserIndicatorId(variables.id);
      return invalidate();
    },
  });

  const duplicate = trpc.userIndicators.duplicate.useMutation({ onSuccess: invalidate });

  const reset = trpc.userIndicators.reset.useMutation({
    onSuccess: () => {
      const store = useIndicatorStore.getState();
      for (const inst of [...store.instances]) {
        store.removeInstance(inst.id);
      }
      return invalidate();
    },
  });

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
