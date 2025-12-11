import type { AITradingContext, TradingSetup } from '@marketmind/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarketContext } from './useMarketContext';

vi.mock('../services/trpc', () => ({
  trpc: {
    aiTrading: {
      buildContext: {
        query: vi.fn(),
      },
      getContextConfig: {
        query: vi.fn(),
      },
      updateContextConfig: {
        mutate: vi.fn(),
      },
    },
  },
}));

import { trpc } from '../services/trpc';

const mockBuildContextQuery = vi.mocked(trpc.aiTrading.buildContext.query);
const mockGetContextConfigQuery = vi.mocked(trpc.aiTrading.getContextConfig.query);
const mockUpdateContextConfigMutate = vi.mocked(trpc.aiTrading.updateContextConfig.mutate);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMarketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildContext', () => {
    it('should build market context successfully', async () => {
      const mockContext: AITradingContext = {
        detectedSetups: [],
        news: [],
        calendarEvents: [],
        fearGreedIndex: 50,
        btcDominance: 45.5,
        marketSentiment: 'neutral',
        volatility: 0.15,
        liquidityLevel: 'medium',
      };

      mockBuildContextQuery.mockResolvedValue(mockContext);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.buildContext.mutate({ symbol: 'BTCUSDT' });

      await waitFor(() => {
        expect(result.current.buildContext.isSuccess).toBe(true);
      });

      expect(mockBuildContextQuery).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        detectedSetups: [],
      });
    });

    it('should build context with detected setups', async () => {
      const mockSetups: TradingSetup[] = [
        {
          id: 'setup-1',
          type: 'setup91',
          direction: 'LONG',
          openTime: Date.now(),
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          riskRewardRatio: 2,
          confidence: 75,
          volumeConfirmation: true,
          indicatorConfluence: 3,
          klineIndex: 100,
          setupData: {},
          visible: true,
          source: 'algorithm',
        },
      ];

      const mockContext: AITradingContext = {
        detectedSetups: mockSetups,
        news: [],
        calendarEvents: [],
        fearGreedIndex: 65,
        btcDominance: 46.2,
        marketSentiment: 'bullish',
        volatility: 0.12,
        liquidityLevel: 'high',
      };

      mockBuildContextQuery.mockResolvedValue(mockContext);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.buildContext.mutate({ symbol: 'ETHUSDT', detectedSetups: mockSetups });

      await waitFor(() => {
        expect(result.current.buildContext.isSuccess).toBe(true);
      });

      expect(mockBuildContextQuery).toHaveBeenCalledWith({
        symbol: 'ETHUSDT',
        detectedSetups: mockSetups,
      });
    });

    it('should cache context after successful build', async () => {
      const mockContext: AITradingContext = {
        detectedSetups: [],
        news: [],
        calendarEvents: [],
        fearGreedIndex: 50,
        btcDominance: 45.5,
        marketSentiment: 'neutral',
        volatility: 0.15,
        liquidityLevel: 'medium',
      };

      mockBuildContextQuery.mockResolvedValue(mockContext);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.buildContext.mutate({ symbol: 'BTCUSDT' });

      await waitFor(() => {
        expect(result.current.buildContext.isSuccess).toBe(true);
      });

      const cachedContext = result.current.getContext('BTCUSDT');
      expect(cachedContext).toEqual(mockContext);
    });

    it('should handle build context errors', async () => {
      mockBuildContextQuery.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.buildContext.mutate({ symbol: 'BTCUSDT' });

      await waitFor(() => {
        expect(result.current.buildContext.isError).toBe(true);
      });

      expect(result.current.buildContext.error).toBeInstanceOf(Error);
    });
  });

  describe('getContextConfig', () => {
    it('should fetch context configuration', async () => {
      const mockConfig = {
        newsLookbackHours: 24,
        eventsLookforwardDays: 7,
        enableFearGreedIndex: true,
        enableBTCDominance: true,
        enableFundingRate: true,
        enableOpenInterest: true,
      };

      mockGetContextConfigQuery.mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.getContextConfig.isSuccess).toBe(true);
      });

      expect(result.current.getContextConfig.data).toEqual(mockConfig);
    });

    it('should handle config fetch errors', async () => {
      mockGetContextConfigQuery.mockRejectedValue(new Error('Config Error'));

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.getContextConfig.isError).toBe(true);
      });
    });
  });

  describe('updateContextConfig', () => {
    it('should update context configuration', async () => {
      const newConfig = {
        newsLookbackHours: 48,
        enableFearGreedIndex: false,
      };

      const mockResponse = {
        success: true,
        config: {
          newsLookbackHours: 48,
          eventsLookforwardDays: 7,
          enableFearGreedIndex: false,
          enableBTCDominance: true,
          enableFundingRate: true,
          enableOpenInterest: true,
        },
      };

      mockUpdateContextConfigMutate.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.updateContextConfig.mutate(newConfig);

      await waitFor(() => {
        expect(result.current.updateContextConfig.isSuccess).toBe(true);
      });

      expect(mockUpdateContextConfigMutate).toHaveBeenCalledWith(newConfig);
    });

    it('should handle config update errors', async () => {
      mockUpdateContextConfigMutate.mockRejectedValue(
        new Error('Update Error')
      );

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.updateContextConfig.mutate({ newsLookbackHours: 48 });

      await waitFor(() => {
        expect(result.current.updateContextConfig.isError).toBe(true);
      });
    });
  });

  describe('cache management', () => {
    it('should return cached context', async () => {
      const mockContext: AITradingContext = {
        detectedSetups: [],
        news: [],
        calendarEvents: [],
        fearGreedIndex: 50,
        btcDominance: 45.5,
        marketSentiment: 'neutral',
        volatility: 0.15,
        liquidityLevel: 'medium',
      };

      mockBuildContextQuery.mockResolvedValue(mockContext);

      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      result.current.buildContext.mutate({ symbol: 'BTCUSDT' });

      await waitFor(() => {
        expect(result.current.buildContext.isSuccess).toBe(true);
      });

      const cached = result.current.getContext('BTCUSDT');
      expect(cached).toEqual(mockContext);
    });

    it('should return undefined for non-cached symbol', () => {
      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      const cached = result.current.getContext('NONEXISTENT');
      expect(cached).toBeUndefined();
    });

    it('should invalidate cached context', async () => {
      const { result } = renderHook(() => useMarketContext(), {
        wrapper: createWrapper(),
      });

      await result.current.invalidateContext('BTCUSDT');

      expect(result.current.getContext('BTCUSDT')).toBeUndefined();
    });
  });
});
