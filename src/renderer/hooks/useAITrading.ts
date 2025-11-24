import { useEffect, useRef, useCallback } from 'react';
import { useAIStore } from '@/renderer/store/aiStore';
import { useTradingStore } from '@/renderer/store/tradingStore';
import { AIService } from '@/renderer/services/ai/AIService';
import { AITradingAgent, type AITradingAgentConfig } from '@/renderer/services/ai/AITradingAgent';
import type { AITradingDecision, Candle } from '@shared/types';
import type { Timeframe } from '@/renderer/components/Chart/TimeframeSelector';

interface UseAITradingOptions {
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  candles: Candle[];
  getCurrentPrice: () => number | null;
}

export const useAITrading = (options: UseAITradingOptions) => {
  const agentRef = useRef<AITradingAgent | null>(null);
  const aiServiceRef = useRef<AIService | null>(null);

  const {
    isAutoTradingActive,
    tradingConfig,
    trades,
    tradingStats,
    analysisInProgress,
    tradingError,
    toggleAutoTrading,
    addTrade,
    updateTrade,
    setTradingAnalysisProgress,
    setTradingError,
    calculateTradingStats,
    settings,
  } = useAIStore();

  const { 
    addOrder, 
    getActiveWallet,
  } = useTradingStore();

  const getChartData = useCallback(() => {
    if (!options.symbol || options.candles.length === 0) return null;
    
    return {
      symbol: options.symbol,
      timeframe: options.timeframe,
      chartType: options.chartType,
      showVolume: true,
      movingAverages: [],
      candles: options.candles,
    };
  }, [options]);

  const getWalletBalance = useCallback(() => {
    const wallet = getActiveWallet();
    return wallet?.balance ?? 0;
  }, [getActiveWallet]);

  const executeTrade = useCallback(
    async (decision: AITradingDecision, quantity: number): Promise<string | null> => {
      try {
        const wallet = getActiveWallet();
        if (!wallet) throw new Error('No active wallet');

        const order = {
          walletId: wallet.id,
          symbol: options.symbol,
          type: decision.action === 'buy' ? ('long' as const) : ('short' as const),
          subType: 'limit' as const,
          quantity,
          entryPrice: decision.entryPrice,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          status: 'active' as const,
          expiration: {
            type: 'gtc' as const,
          },
        };

        addOrder(order);
        
        return wallet.id;
      } catch (error) {
        console.error('Failed to execute trade:', error);
        return null;
      }
    },
    [addOrder, getActiveWallet, options.symbol]
  );

  const startTrading = useCallback(async () => {
    if (agentRef.current?.isActive()) {
      return;
    }

    try {
      setTradingError(null);
      setTradingAnalysisProgress(true);

      if (!settings) {
        throw new Error('AI settings not configured');
      }

      const aiServiceConfig: {provider: typeof settings.provider, model?: string, temperature?: number, maxTokens?: number} = {
        provider: settings.provider,
      };
      if (settings.model) aiServiceConfig.model = settings.model;
      if (settings.temperature !== undefined) aiServiceConfig.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) aiServiceConfig.maxTokens = settings.maxTokens;

      const aiService = new AIService(aiServiceConfig);

      aiServiceRef.current = aiService;

      const agentConfig: AITradingAgentConfig = {
        config: tradingConfig,
        onTrade: (trade) => {
          addTrade(trade);
          calculateTradingStats();
        },
        onError: (error) => {
          setTradingError(error.message);
          console.error('Trading error:', error);
        },
        getCurrentPrice: options.getCurrentPrice,
        getChartData,
        getWalletBalance,
        executeTrade,
      };

      const agent = new AITradingAgent(agentConfig);
      agentRef.current = agent;

      await agent.start(aiService);
      
      if (!isAutoTradingActive) {
        toggleAutoTrading();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTradingError(errorMessage);
      console.error('Failed to start trading:', error);
    } finally {
      setTradingAnalysisProgress(false);
    }
  }, [
    tradingConfig,
    addTrade,
    calculateTradingStats,
    setTradingError,
    setTradingAnalysisProgress,
    toggleAutoTrading,
    isAutoTradingActive,
    options.getCurrentPrice,
    getChartData,
    getWalletBalance,
    executeTrade,
    settings,
  ]);

  const stopTrading = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.stop();
      agentRef.current = null;
    }

    if (isAutoTradingActive) {
      toggleAutoTrading();
    }

    setTradingAnalysisProgress(false);
  }, [isAutoTradingActive, toggleAutoTrading, setTradingAnalysisProgress]);

  const updateAgentConfig = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.updateConfig(tradingConfig);
    }
  }, [tradingConfig]);

  useEffect(() => {
    updateAgentConfig();
  }, [tradingConfig, updateAgentConfig]);

  useEffect(() => {
    if (!options.candles || options.candles.length === 0) return;
    
    const openTrades = trades.filter((trade) => trade.status === 'open');

    openTrades.forEach((trade) => {
      const currentPrice = options.getCurrentPrice();
      if (!currentPrice) return;

      const shouldClose =
        (trade.action === 'buy' &&
          (currentPrice <= trade.stopLoss || currentPrice >= trade.takeProfit)) ||
        (trade.action === 'sell' &&
          (currentPrice >= trade.stopLoss || currentPrice <= trade.takeProfit));

      if (shouldClose) {
        const pnl =
          trade.action === 'buy'
            ? (currentPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - currentPrice) * trade.quantity;

        const exitReason =
          trade.action === 'buy'
            ? currentPrice <= trade.stopLoss
              ? ('stop-loss' as const)
              : ('take-profit' as const)
            : currentPrice >= trade.stopLoss
              ? ('stop-loss' as const)
              : ('take-profit' as const);

        updateTrade(trade.id, {
          status: 'closed' as const,
          exitPrice: currentPrice,
          pnl,
          exitReason,
        });

        if (agentRef.current) {
          agentRef.current.recordTradeResult(pnl);
        }

        calculateTradingStats();
      }
    });
  }, [options.candles, trades, options.getCurrentPrice, updateTrade, calculateTradingStats]);

  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.stop();
      }
    };
  }, []);

  return {
    isActive: isAutoTradingActive,
    isAnalyzing: analysisInProgress,
    error: tradingError,
    stats: tradingStats,
    trades,
    config: tradingConfig,
    startTrading,
    stopTrading,
  };
};
