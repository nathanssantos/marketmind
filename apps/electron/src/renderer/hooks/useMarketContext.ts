import type { AITradingContext, ContextAggregatorConfig, TradingSetup } from '@marketmind/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';

export const useMarketContext = () => {
  const queryClient = useQueryClient();

  const buildContext = useMutation({
    mutationFn: async ({ symbol, detectedSetups }: { symbol: string; detectedSetups?: TradingSetup[] }) => {
      return await trpc.aiTrading.buildContext.query({
        symbol,
        detectedSetups: detectedSetups || [],
      });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['marketContext', variables.symbol], data);
    },
  });

  const getContextConfig = useQuery({
    queryKey: ['marketContextConfig'],
    queryFn: () => trpc.aiTrading.getContextConfig.query(),
    staleTime: 5 * 60 * 1000,
  });

  const updateContextConfig = useMutation({
    mutationFn: (config: Partial<ContextAggregatorConfig>) => 
      trpc.aiTrading.updateContextConfig.mutate(config),
    onSuccess: (data: { config: ContextAggregatorConfig }) => {
      queryClient.setQueryData(['marketContextConfig'], data.config);
    },
  });

  const getContext = (symbol: string) => {
    return queryClient.getQueryData<AITradingContext>(['marketContext', symbol]);
  };

  const invalidateContext = (symbol: string) => {
    return queryClient.invalidateQueries({ queryKey: ['marketContext', symbol] });
  };

  return {
    buildContext,
    getContextConfig,
    updateContextConfig,
    getContext,
    invalidateContext,
  };
};
