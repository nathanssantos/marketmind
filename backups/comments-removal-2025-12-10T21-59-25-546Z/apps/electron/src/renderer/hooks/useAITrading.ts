import type { Timeframe } from '@/renderer/components/Chart/TimeframeSelector';
import { AIService } from '@/renderer/services/ai/AIService';
import { AITradingAgent, type AITradingAgentConfig } from '@/renderer/services/ai/AITradingAgent';
import { useAIStore } from '@/renderer/store/aiStore';
import { useTradingStore } from '@/renderer/store/tradingStore';
import type { AITradingDecision, Kline } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';
import { useSetupDetection } from './useSetupDetection';

interface UseAITradingOptions {
  symbol: string;
  timeframe: Timeframe;
  chartType: 'kline' | 'line';
  klines: Kline[];
  getCurrentPrice: () => number | null;
}

export const useAITrading = (options: UseAITradingOptions) => {
  const agentRef = useRef<AITradingAgent | null>(null);
  const aiServiceRef = useRef<AIService | null>(null);

  const setupDetector = useSetupDetection({
    symbol: options.symbol,
    interval: options.timeframe as any,
    enableRealtimeUpdates: false,
  });

  const isAutoTradingActive = useAIStore((state) => state.isAutoTradingActive);
  const tradingConfig = useAIStore((state) => state.tradingConfig);
  const trades = useAIStore((state) => state.trades);
  const tradingStats = useAIStore((state) => state.tradingStats);
  const analysisInProgress = useAIStore((state) => state.analysisInProgress);
  const tradingError = useAIStore((state) => state.tradingError);
  const addTrade = useAIStore((state) => state.addTrade);
  const updateTrade = useAIStore((state) => state.updateTrade);
  const setTradingAnalysisProgress = useAIStore((state) => state.setTradingAnalysisProgress);
  const setTradingError = useAIStore((state) => state.setTradingError);
  const calculateTradingStats = useAIStore((state) => state.calculateTradingStats);
  const settings = useAIStore((state) => state.settings);

  const addOrder = useTradingStore((state) => state.addOrder);
  const getActiveWallet = useTradingStore((state) => state.getActiveWallet);

  const getChartData = useCallback(() => {
    if (!options.symbol || options.klines.length === 0) return null;
    
    return {
      symbol: options.symbol,
      timeframe: options.timeframe,
      chartType: options.chartType,
      showVolume: true,
      movingAverages: [],
      klines: options.klines,
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
          orderDirection: decision.action === 'buy' ? ('long' as const) : ('short' as const),
          subType: 'limit' as const,
          quantity,
          entryPrice: decision.entryPrice,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          status: 'FILLED' as const,
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
    console.log('[useAITrading] startTrading called');
    console.log('[useAITrading] Agent active?', agentRef.current?.isActive());
    
    if (agentRef.current?.isActive()) {
      console.log('[useAITrading] Agent already active, skipping');
      return;
    }

    try {
      setTradingError(null);
      setTradingAnalysisProgress(true);

      console.log('[useAITrading] Settings:', settings);
      if (!settings) {
        throw new Error('AI settings not configured');
      }

      const aiServiceConfig: {provider: typeof settings.provider, model?: string, temperature?: number, maxTokens?: number} = {
        provider: settings.provider,
      };
      if (settings.model) aiServiceConfig.model = settings.model;
      if (settings.temperature !== undefined) aiServiceConfig.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) aiServiceConfig.maxTokens = settings.maxTokens;

      console.log('[useAITrading] Creating AIService with config:', aiServiceConfig);
      const aiService = new AIService(aiServiceConfig);

      aiServiceRef.current = aiService;

      const agentConfig: AITradingAgentConfig = {
        config: tradingConfig,
        onTrade: (trade) => {
          console.log('[useAITrading] New trade:', trade);
          addTrade(trade);
          calculateTradingStats();
        },
        onError: (error) => {
          console.error('[useAITrading] Trading error:', error);
          setTradingError(error.message);
        },
        getCurrentPrice: options.getCurrentPrice,
        getChartData,
        getWalletBalance,
        executeTrade,
        detectSetups: setupDetector.detectSetups,
      };

      console.log('[useAITrading] Creating agent with config:', agentConfig);
      const agent = new AITradingAgent(agentConfig);
      agentRef.current = agent;

      console.log('[useAITrading] Starting agent...');
      await agent.start(aiService);
      console.log('[useAITrading] Agent started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[useAITrading] Failed to start trading:', error);
      setTradingError(errorMessage);
    } finally {
      setTradingAnalysisProgress(false);
    }
  }, [
    tradingConfig,
    addTrade,
    calculateTradingStats,
    setTradingError,
    setTradingAnalysisProgress,
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

    setTradingAnalysisProgress(false);
  }, [setTradingAnalysisProgress]);

  const updateAgentConfig = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.updateConfig(tradingConfig);
    }
  }, [tradingConfig]);

  useEffect(() => {
    updateAgentConfig();
  }, [tradingConfig, updateAgentConfig]);

  useEffect(() => {
    if (!options.klines || options.klines.length === 0) return;
    
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
  }, [options.klines, trades, options.getCurrentPrice, updateTrade, calculateTradingStats]);

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
