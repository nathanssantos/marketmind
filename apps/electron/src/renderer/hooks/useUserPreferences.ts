import { useCallback, useMemo } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

type PreferenceCategory = 'trading' | 'ui' | 'chart' | 'notifications' | 'recent';

export const useUserPreferences = <T = unknown>(category: PreferenceCategory) => {
  const utils = trpc.useUtils();

  const { data: preferences, isLoading, error } = trpc.preferences.getByCategory.useQuery(
    { category },
    { staleTime: QUERY_CONFIG.STALE_TIME.LONG }
  );

  const setMutation = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category });
      utils.preferences.getAll.invalidate();
    },
  });

  const deleteMutation = trpc.preferences.delete.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category });
      utils.preferences.getAll.invalidate();
    },
  });

  const bulkSetMutation = trpc.preferences.bulkSet.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category });
      utils.preferences.getAll.invalidate();
    },
  });

  const deleteCategoryMutation = trpc.preferences.deleteCategory.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category });
      utils.preferences.getAll.invalidate();
    },
  });

  const get = useCallback(
    <V = T>(key: string, defaultValue: V): V => {
      if (!preferences) return defaultValue;
      const value = preferences[key];
      return (value as V) ?? defaultValue;
    },
    [preferences]
  );

  const set = useCallback(
    async (key: string, value: unknown) => {
      await setMutation.mutateAsync({ category, key, value });
    },
    [category, setMutation]
  );

  const remove = useCallback(
    async (key: string) => {
      await deleteMutation.mutateAsync({ category, key });
    },
    [category, deleteMutation]
  );

  const bulkSet = useCallback(
    async (prefs: Record<string, unknown>) => {
      await bulkSetMutation.mutateAsync({ category, preferences: prefs });
    },
    [category, bulkSetMutation]
  );

  const clearCategory = useCallback(async () => {
    await deleteCategoryMutation.mutateAsync({ category });
  }, [category, deleteCategoryMutation]);

  return useMemo(
    () => ({
      preferences: (preferences ?? {}) as Record<string, T>,
      isLoading,
      error,
      get,
      set,
      remove,
      bulkSet,
      clearCategory,
      isSaving: setMutation.isPending || bulkSetMutation.isPending,
      isDeleting: deleteMutation.isPending || deleteCategoryMutation.isPending,
    }),
    [
      preferences,
      isLoading,
      error,
      get,
      set,
      remove,
      bulkSet,
      clearCategory,
      setMutation.isPending,
      bulkSetMutation.isPending,
      deleteMutation.isPending,
      deleteCategoryMutation.isPending,
    ]
  );
};

export const useTradingPreferences = () => useUserPreferences('trading');
export const useUIPreferences = () => useUserPreferences('ui');
export const useChartPreferences = () => useUserPreferences('chart');
export const useNotificationPreferences = () => useUserPreferences('notifications');
export const useRecentPreferences = () => useUserPreferences('recent');

export const useAllPreferences = () => {
  const utils = trpc.useUtils();

  const { data: allPreferences, isLoading, error } = trpc.preferences.getAll.useQuery(
    undefined,
    { staleTime: QUERY_CONFIG.STALE_TIME.LONG }
  );

  const clearAllMutation = trpc.preferences.clearAll.useMutation({
    onSuccess: () => {
      utils.preferences.invalidate();
    },
  });

  const clearAll = useCallback(async () => {
    await clearAllMutation.mutateAsync();
  }, [clearAllMutation]);

  return {
    preferences: allPreferences ?? {},
    isLoading,
    error,
    clearAll,
    isClearing: clearAllMutation.isPending,
  };
};
