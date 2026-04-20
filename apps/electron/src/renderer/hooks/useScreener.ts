import type { AssetClass, MarketType, ScreenerConfig, ScreenerPreset, ScreenerResponse, TimeInterval } from '@marketmind/types';
import { useCallback, useMemo } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { useScreenerStore } from '../store/screenerStore';
import { trpc } from '../utils/trpc';

export const useScreener = () => {
  const utils = trpc.useUtils();
  const {
    isScreenerOpen,
    activePresetId,
    customFilters,
    assetClass,
    marketType,
    interval,
    sortBy,
    sortDirection,
  } = useScreenerStore();

  const config: ScreenerConfig = useMemo(() => ({
    assetClass,
    marketType,
    interval,
    filters: customFilters,
    sortBy,
    sortDirection,
  }), [assetClass, marketType, interval, customFilters, sortBy, sortDirection]);

  const isPresetMode = activePresetId !== null;

  const customQuery = trpc.screener.run.useQuery(config, {
    enabled: isScreenerOpen && !isPresetMode,
    staleTime: QUERY_CONFIG.STALE_TIME.SLOW,
  });

  const presetQuery = trpc.screener.runPreset.useQuery(
    { presetId: activePresetId ?? '', assetClass, marketType, interval },
    {
      enabled: isScreenerOpen && isPresetMode,
      staleTime: QUERY_CONFIG.STALE_TIME.SLOW,
    },
  );

  const presetsQuery = trpc.screener.getPresets.useQuery(
    { assetClass },
    { enabled: isScreenerOpen, staleTime: QUERY_CONFIG.STALE_TIME.LONG },
  );

  const indicatorsQuery = trpc.screener.getAvailableIndicators.useQuery(
    { assetClass },
    { enabled: isScreenerOpen, staleTime: QUERY_CONFIG.STALE_TIME.PERMANENT },
  );

  const savedQuery = trpc.screener.getSavedScreeners.useQuery(undefined, {
    enabled: isScreenerOpen,
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });

  const saveMutation = trpc.screener.saveScreener.useMutation({
    onSuccess: () => {
      void utils.screener.getSavedScreeners.invalidate();
    },
  });

  const deleteMutation = trpc.screener.deleteScreener.useMutation({
    onSuccess: () => {
      void utils.screener.getSavedScreeners.invalidate();
    },
  });

  const activeQuery = isPresetMode ? presetQuery : customQuery;

  const results: ScreenerResponse | undefined = activeQuery.data as ScreenerResponse | undefined;
  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching;
  const error = activeQuery.error;

  const refetch = useCallback(() => {
    if (isPresetMode) {
      void presetQuery.refetch();
    } else {
      void customQuery.refetch();
    }
  }, [isPresetMode, presetQuery, customQuery]);

  const saveScreener = useCallback(
    async (name: string) => saveMutation.mutateAsync({ name, config }),
    [saveMutation, config],
  );

  const deleteScreener = useCallback(
    async (id: string) => deleteMutation.mutateAsync({ id }),
    [deleteMutation],
  );

  const presets = useMemo<ScreenerPreset[]>(
    () => (presetsQuery.data as ScreenerPreset[] | undefined) ?? [],
    [presetsQuery.data],
  );

  return {
    results,
    isLoading,
    isFetching,
    error,
    refetch,
    presets,
    indicators: indicatorsQuery.data ?? [],
    savedScreeners: savedQuery.data ?? [],
    saveScreener,
    deleteScreener,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useScannerPreset = (
  presetId: string | null,
  options: {
    assetClass: AssetClass;
    marketType: MarketType;
    interval: TimeInterval;
    enabled?: boolean;
    staleTime?: number;
  },
) => {
  const presetsQuery = trpc.screener.getPresets.useQuery(
    { assetClass: options.assetClass },
    { staleTime: QUERY_CONFIG.STALE_TIME.LONG },
  );

  const resultsQuery = trpc.screener.runPreset.useQuery(
    { presetId: presetId!, assetClass: options.assetClass, marketType: options.marketType, interval: options.interval },
    {
      enabled: !!presetId && (options.enabled ?? true),
      staleTime: options.staleTime ?? QUERY_CONFIG.STALE_TIME.SLOW,
    },
  );

  return {
    presets: (presetsQuery.data as ScreenerPreset[] | undefined) ?? [],
    results: resultsQuery.data as ScreenerResponse | undefined,
    isLoading: resultsQuery.isLoading,
    isFetching: resultsQuery.isFetching,
    error: resultsQuery.error,
    refetch: resultsQuery.refetch,
  };
};
