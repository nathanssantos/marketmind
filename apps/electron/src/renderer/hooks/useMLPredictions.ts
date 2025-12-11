import { useCallback } from 'react';
import { trpc } from '../utils/trpc';
import type { Interval } from '@marketmind/types';

interface Setup {
  id: string;
  type: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  riskRewardRatio: number;
  volumeConfirmation: boolean;
  indicatorConfluence: number;
  openTime: number;
  klineIndex: number;
}

interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

interface MarketContext {
  fundingRate?: number;
  openInterest?: number;
  openInterestChange1h?: number;
  openInterestChange24h?: number;
  takerBuyRatio?: number;
  fearGreedIndex?: number;
  btcDominance?: number;
  btcDominanceChange24h?: number;
  btcDominanceChange7d?: number;
  longLiquidations24h?: number;
  shortLiquidations24h?: number;
}

interface PredictionResult {
  probability: number;
  confidence: number;
  label: number;
  latencyMs: number;
}

interface EnhancedSetupResult {
  id: string;
  type: string;
  direction: 'LONG' | 'SHORT';
  originalConfidence: number;
  mlConfidence?: number;
  confidence: number;
  blendedConfidence?: number;
  mlPrediction?: PredictionResult;
}

interface RankedSetupResult {
  rank: number;
  setupId: string;
  setupType: string;
  direction: 'LONG' | 'SHORT';
  probability: number;
  confidence: number;
  label: number;
}

export const useMLPredictions = () => {
  const utils = trpc.useUtils();

  const statusQuery = trpc.ml.getStatus.useQuery(undefined, {
    staleTime: 60000,
  });

  const modelInfoQuery = trpc.ml.getModelInfo.useQuery(undefined, {
    staleTime: 300000,
  });

  const initializeMutation = trpc.ml.initialize.useMutation({
    onSuccess: () => {
      utils.ml.getStatus.invalidate();
      utils.ml.getModelInfo.invalidate();
    },
  });

  const predictSetupMutation = trpc.ml.predictSetup.useMutation();

  const enhanceConfidenceMutation = trpc.ml.enhanceConfidence.useMutation();

  const filterSetupsMutation = trpc.ml.filterSetups.useMutation();

  const rankSetupsMutation = trpc.ml.rankSetups.useMutation();

  const clearCacheMutation = trpc.ml.clearCache.useMutation();

  const disposeMutation = trpc.ml.dispose.useMutation({
    onSuccess: () => {
      utils.ml.getStatus.invalidate();
      utils.ml.getModelInfo.invalidate();
    },
  });

  const initialize = useCallback(
    async (modelType?: 'setup-classifier' | 'confidence-enhancer') => {
      return initializeMutation.mutateAsync({ modelType });
    },
    [initializeMutation]
  );

  const predictSetup = useCallback(
    async (
      symbol: string,
      interval: Interval,
      klines: Kline[],
      setup: Setup,
      marketContext?: MarketContext
    ): Promise<{ setupId: string; prediction: PredictionResult }> => {
      return predictSetupMutation.mutateAsync({
        symbol,
        interval,
        klines,
        setup,
        marketContext,
      });
    },
    [predictSetupMutation]
  );

  const enhanceSetups = useCallback(
    async (
      klines: Kline[],
      setups: Setup[],
      blendWeight?: number
    ): Promise<EnhancedSetupResult[]> => {
      return enhanceConfidenceMutation.mutateAsync({
        klines,
        setups,
        blendWeight,
      });
    },
    [enhanceConfidenceMutation]
  );

  const filterSetups = useCallback(
    async (
      klines: Kline[],
      setups: Setup[],
      minProbability?: number
    ): Promise<{
      original: number;
      filtered: number;
      setups: Array<{
        id: string;
        type: string;
        direction: 'LONG' | 'SHORT';
        confidence: number;
      }>;
    }> => {
      return filterSetupsMutation.mutateAsync({
        klines,
        setups,
        minProbability,
      });
    },
    [filterSetupsMutation]
  );

  const rankSetups = useCallback(
    async (klines: Kline[], setups: Setup[]): Promise<RankedSetupResult[]> => {
      return rankSetupsMutation.mutateAsync({
        klines,
        setups,
      });
    },
    [rankSetupsMutation]
  );

  const clearCache = useCallback(async () => {
    return clearCacheMutation.mutateAsync();
  }, [clearCacheMutation]);

  const dispose = useCallback(async () => {
    return disposeMutation.mutateAsync();
  }, [disposeMutation]);

  return {
    isReady: statusQuery.data?.isReady ?? false,
    cacheSize: statusQuery.data?.cacheSize ?? 0,
    modelInfo: modelInfoQuery.data,
    isLoading: statusQuery.isLoading || initializeMutation.isPending,
    error: statusQuery.error || initializeMutation.error,

    initialize,
    predictSetup,
    enhanceSetups,
    filterSetups,
    rankSetups,
    clearCache,
    dispose,

    isPredicting: predictSetupMutation.isPending,
    isEnhancing: enhanceConfidenceMutation.isPending,
    isFiltering: filterSetupsMutation.isPending,
    isRanking: rankSetupsMutation.isPending,
  };
};

export const useMLModel = () => {
  const utils = trpc.useUtils();

  const modelsQuery = trpc.ml.listModels.useQuery(undefined, {
    staleTime: 300000,
  });

  const featureInfoQuery = trpc.ml.getFeatureInfo.useQuery(undefined, {
    staleTime: 600000,
  });

  const switchModelMutation = trpc.ml.switchModel.useMutation({
    onSuccess: () => {
      utils.ml.getStatus.invalidate();
      utils.ml.getModelInfo.invalidate();
    },
  });

  const recordOutcomeMutation = trpc.ml.recordOutcome.useMutation();

  const switchModel = useCallback(
    async (modelId: string) => {
      return switchModelMutation.mutateAsync({ modelId });
    },
    [switchModelMutation]
  );

  const recordOutcome = useCallback(
    async (predictionId: string, actualLabel: number) => {
      return recordOutcomeMutation.mutateAsync({ predictionId, actualLabel });
    },
    [recordOutcomeMutation]
  );

  return {
    models: modelsQuery.data ?? [],
    featureInfo: featureInfoQuery.data,
    isLoading: modelsQuery.isLoading,
    error: modelsQuery.error,

    switchModel,
    isSwitching: switchModelMutation.isPending,

    recordOutcome,
    isRecording: recordOutcomeMutation.isPending,
  };
};
