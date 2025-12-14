import type { MarketContextConfig } from '@marketmind/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';

interface UpdateConfigInput {
  enabled?: boolean;
  shadowMode?: boolean;
  fearGreed?: {
    enabled?: boolean;
    thresholdLow?: number;
    thresholdHigh?: number;
    action?: 'reduce_size' | 'block' | 'penalize' | 'warn_only';
    sizeReduction?: number;
  };
  fundingRate?: {
    enabled?: boolean;
    threshold?: number;
    action?: 'reduce_size' | 'block' | 'penalize' | 'warn_only';
    penalty?: number;
  };
  btcDominance?: {
    enabled?: boolean;
    changeThreshold?: number;
    action?: 'reduce_size' | 'block' | 'penalize' | 'warn_only';
    sizeReduction?: number;
  };
  openInterest?: {
    enabled?: boolean;
    changeThreshold?: number;
    action?: 'reduce_size' | 'block' | 'penalize' | 'warn_only';
  };
}

export const useMarketContextConfig = (walletId: string) => {
  const queryClient = useQueryClient();

  const config = useQuery({
    queryKey: ['marketContextConfig', walletId],
    queryFn: () => trpc.marketContext.getConfig.query({ walletId }),
    enabled: !!walletId,
    staleTime: 60 * 1000,
  });

  const updateConfig = useMutation({
    mutationFn: (updates: UpdateConfigInput) =>
      trpc.marketContext.updateConfig.mutate({ walletId, config: updates }),
    onSuccess: (data: MarketContextConfig) => {
      queryClient.setQueryData(['marketContextConfig', walletId], data);
    },
  });

  const marketData = useQuery({
    queryKey: ['marketContextData', 'BTCUSDT'],
    queryFn: () => trpc.marketContext.getMarketData.query({ symbol: 'BTCUSDT' }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const testFilter = useMutation({
    mutationFn: ({ symbol, direction }: { symbol: string; direction: 'LONG' | 'SHORT' }) =>
      trpc.marketContext.testFilter.query({ walletId, symbol, direction }),
  });

  return {
    config: config.data,
    isLoadingConfig: config.isLoading,
    updateConfig,
    marketData: marketData.data,
    isLoadingMarketData: marketData.isLoading,
    testFilter,
    invalidateConfig: () => queryClient.invalidateQueries({ queryKey: ['marketContextConfig', walletId] }),
  };
};
