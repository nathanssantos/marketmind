import type { Timeframe } from '@/renderer/components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '@/renderer/components/Chart/useMovingAverageRenderer';
import { AIService } from '@/renderer/services/ai';
import type { AIAnalysisResponse, AIMessage, AIProviderType, AITrade, AITradingConfig, AITradingStats, Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
import { create } from 'zustand';
import { useAISettingsStore, type AISettings, DEFAULT_MODELS } from './aiSettingsStore';
import { useAITradingStore, DEFAULT_TRADING_CONFIG, DEFAULT_TRADING_STATS } from './aiTradingStore';
import { useConversationStore, type Conversation } from './conversationStore';

export { DEFAULT_MODELS };
export type { AISettings, Conversation };

export interface ChartData {
  klines: Kline[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'kline' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
}

interface AIState {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AISettings | null;
  isLoading: boolean;
  error: string | null;
  lastAnalysis: AIAnalysisResponse | null;

  messages: AIMessage[];
  provider: AIProviderType | null;
  model: string | null;
  enableAIPatterns: boolean;

  responseProcessor: ((response: string) => Promise<string>) | null;

  isAutoTradingActive: boolean;
  tradingConfig: AITradingConfig;
  trades: AITrade[];
  tradingStats: AITradingStats | null;
  lastAnalysisTime: Date | null;
  lastTradeTime: Date | null;
  analysisInProgress: boolean;
  tradingError: string | null;

  setSettings: (settings: AISettings) => void;
  updateSettings: (partialSettings: Partial<AISettings>) => void;
  clearSettings: () => void;

  createConversation: (title?: string, symbol?: string) => string;
  startNewConversation: (symbol?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setActiveConversationBySymbol: (symbol: string) => void;
  restoreActiveConversation: () => void;
  updateConversationTitle: (id: string, title: string) => void;
  updateConversationPatternDataId: (id: string, patternDataId: string | undefined) => void;

  addMessage: (conversationId: string, message: Omit<AIMessage, 'id' | 'openTime'>) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearMessages: (conversationId: string) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastAnalysis: (analysis: AIAnalysisResponse | null) => void;

  getActiveConversation: () => Conversation | null;
  getConversationMessages: (id: string) => AIMessage[];
  getConversationsBySymbol: (symbol: string) => Conversation[];

  exportConversation: (id: string) => string;
  importConversation: (data: string) => void;

  sendMessage: (content: string, chartData?: ChartData) => Promise<void>;
  setResponseProcessor: (processor: ((response: string) => Promise<string>) | null) => void;
  toggleAIPatterns: () => void;

  toggleAutoTrading: () => void;
  updateTradingConfig: (config: Partial<AITradingConfig>) => void;
  addTrade: (trade: AITrade) => void;
  updateTrade: (tradeId: string, updates: Partial<AITrade>) => void;
  setTradingAnalysisProgress: (inProgress: boolean) => void;
  setTradingError: (error: string | null) => void;
  calculateTradingStats: () => void;
  clearTradingHistory: () => void;

  syncWithElectron: () => Promise<void>;
  saveToElectron: () => Promise<void>;
  clearAll: () => void;
}

const loadFromElectron = async (): Promise<{
  conversations?: Conversation[];
  activeConversationId?: string | null;
  settings?: AISettings | null;
  enableAIPatterns?: boolean;
  isAutoTradingActive?: boolean;
  tradingConfig?: AITradingConfig;
  trades?: AITrade[];
  tradingStats?: AITradingStats | null;
}> => {
  try {
    const result = await window.electron.secureStorage.getAIData();
    if (result.success && result.data) {
      return {
        conversations: result.data.conversations,
        activeConversationId: result.data.activeConversationId,
        settings: result.data.settings,
        enableAIPatterns: result.data.enableAIPatterns,
        isAutoTradingActive: result.data.isAutoTradingActive || false,
        tradingConfig: result.data.tradingConfig || DEFAULT_TRADING_CONFIG,
        trades: result.data.trades || [],
        tradingStats: result.data.tradingStats || DEFAULT_TRADING_STATS,
      };
    }
  } catch (error) {
    console.error('Failed to load AI data from Electron:', error);
  }
  return {};
};

const saveToElectron = async (state: AIState): Promise<void> => {
  try {
    await window.electron.secureStorage.setAIData({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      settings: state.settings,
      enableAIPatterns: state.enableAIPatterns,
      isAutoTradingActive: state.isAutoTradingActive,
      tradingConfig: state.tradingConfig,
      trades: state.trades,
      tradingStats: state.tradingStats,
    });
  } catch (error) {
    console.error('Failed to save AI data to Electron:', error);
  }
};

const formatAIError = (error: Error, provider?: AIProviderType, model?: string): string => {
  const errorMessage = error.message;

  const providerName = provider === 'anthropic' ? 'Claude' :
                      provider === 'openai' ? 'OpenAI' :
                      provider === 'gemini' ? 'Gemini' : 'AI';

  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota')) {
    if (provider === 'gemini') {
      const waitTime = errorMessage.match(/retry in (\d+)/i)?.[1] || '60';

      if (model === 'gemini-2.0-flash-exp') {
        return `⚠️ **Cota do Gemini 2.0 Flash Exp esgotada**\n\n` +
          `O tier gratuito tem limite de **10 requisições por minuto**.\n\n` +
          `**Soluções:**\n` +
          `• Aguarde ${waitTime} segundos e tente novamente\n` +
          `• Ou vá em Settings > AI Configuration e troque para:\n` +
          `  - **Gemini 3 Pro** (melhor raciocínio)\n` +
          `  - **Gemini 1.5 Flash** (mais rápido e barato)\n` +
          `• Ou use outro provedor (OpenAI/Claude)`;
      } else if (model === 'gemini-3-pro-preview') {
        return `⚠️ **Limite de requisições do Gemini 3 Pro excedido**\n\n` +
          `**Soluções:**\n` +
          `• Aguarde ${waitTime} segundos e tente novamente\n` +
          `• Ou reduza a frequência de requisições\n` +
          `• Ou considere usar Gemini 1.5 Flash (mais barato e com limite maior)`;
      } else if (model?.includes('1.5-pro')) {
        return `⚠️ **Limite de requisições do Gemini 1.5 Pro excedido**\n\n` +
          `Limite: 360 req/min\n\n` +
          `**Soluções:**\n` +
          `• Aguarde ${waitTime} segundos\n` +
          `• Ou use Gemini 1.5 Flash (limite de 1000 req/min)`;
      } else if (model?.includes('1.5-flash')) {
        return `⚠️ **Limite de requisições do Gemini 1.5 Flash excedido**\n\n` +
          `Limite: 1000 req/min\n\n` +
          `**Aguarde ${waitTime} segundos e tente novamente**`;
      } else {
        return `⚠️ Limite de requisições do Gemini excedido. Aguarde ${waitTime}s ou troque de modelo nas configurações.`;
      }
    } else if (provider === 'openai') {
      return `⚠️ **Limite de requisições do OpenAI excedido**\n\n` +
        `**Soluções:**\n` +
        `• Aguarde alguns minutos\n` +
        `• Verifique seu plano na OpenAI (Tier 1/2/3/4/5)\n` +
        `• Considere usar Gemini (mais econômico)`;
    } else if (provider === 'anthropic') {
      return `⚠️ **Limite de requisições do Claude excedido**\n\n` +
        `**Soluções:**\n` +
        `• Aguarde alguns minutos\n` +
        `• Verifique seus créditos na Anthropic\n` +
        `• Considere usar Gemini (mais econômico)`;
    } else {
      return `⚠️ Limite de requisições excedido no ${providerName}. Aguarde alguns minutos e tente novamente.`;
    }
  } else if (errorMessage.includes('rate limit')) {
    return `⚠️ Taxa de requisições excedida no ${providerName}. Aguarde alguns minutos.`;
  } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('invalid') || errorMessage.includes('API key')) {
    return `🔑 **Chave de API inválida para ${providerName}**\n\n` +
      `Vá em Settings > AI Configuration e verifique sua API key.`;
  } else if (errorMessage.includes('timeout')) {
    return '⏱️ **Timeout na requisição**\n\nA AI demorou muito para responder. Tente novamente.';
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return '🌐 **Erro de conexão**\n\nVerifique sua internet e tente novamente.';
  } else if (errorMessage.includes('context_length') || errorMessage.includes('too long')) {
    return `📏 **Mensagem muito longa**\n\n` +
      `A conversa excedeu o limite de ${model?.includes('1.5-pro') ? '2M' : '1M'} tokens.\n\n` +
      `**Soluções:**\n` +
      `• Clique em "Clear Chat" para limpar o histórico\n` +
      `• Ou reduza o tamanho da mensagem`;
  }

  return errorMessage;
};

const formatChartDataContext = (chartData: ChartData): string => {
  const recentKlines = chartData.klines.slice(-100);
  const lastKline = recentKlines[recentKlines.length - 1];

  if (!lastKline) return '';

  const visibleMAs = chartData.movingAverages.filter(ma => ma.visible);

  const highs = recentKlines.map(c => getKlineHigh(c));
  const lows = recentKlines.map(c => getKlineLow(c));
  const volumes = recentKlines.map(c => getKlineVolume(c));

  const highestPrice = Math.max(...highs);
  const lowestPrice = Math.min(...lows);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const priceRange = ((highestPrice - lowestPrice) / lowestPrice * 100).toFixed(2);

  const first = recentKlines[0];
  const last = recentKlines[recentKlines.length - 1];
  const overallChange = first && last ? ((getKlineClose(last) - getKlineClose(first)) / getKlineClose(first) * 100).toFixed(2) : '0';

  const bullishCount = recentKlines.filter(c => getKlineClose(c) > getKlineOpen(c)).length;
  const bearishCount = recentKlines.length - bullishCount;

  let context = `\n\n--- CHART DATA CONTEXT ---\n`;
  context += `Market: ${chartData.symbol}\n`;
  context += `Timeframe: ${chartData.timeframe}\n`;
  context += `Chart Type: ${chartData.chartType}\n`;
  context += `Data Points: ${chartData.klines.length} klines\n`;
  context += `\n=== CURRENT MARKET STATE ===\n`;
  context += `Current Price: $${getKlineClose(lastKline).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Open: $${getKlineOpen(lastKline).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `High: $${getKlineHigh(lastKline).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Low: $${getKlineLow(lastKline).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Volume: ${getKlineVolume(lastKline).toLocaleString()}\n`;
  context += `Current Kline Change: ${((getKlineClose(lastKline) - getKlineOpen(lastKline)) / getKlineOpen(lastKline) * 100).toFixed(2)}%\n`;

  context += `\n=== STATISTICAL ANALYSIS (Last 100 klines) ===\n`;
  context += `Highest Price: $${highestPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Lowest Price: $${lowestPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Price Range: ${priceRange}%\n`;
  context += `Overall Trend: ${parseFloat(overallChange) > 0 ? '📈 Bullish' : '📉 Bearish'} (${overallChange}%)\n`;
  context += `Average Volume: ${avgVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
  context += `Bullish Klines: ${bullishCount} (${(bullishCount / recentKlines.length * 100).toFixed(1)}%)\n`;
  context += `Bearish Klines: ${bearishCount} (${(bearishCount / recentKlines.length * 100).toFixed(1)}%)\n`;

  context += `\n=== TIMESTAMP INFORMATION FOR DRAWING PATTERNS ===\n`;
  context += `⚠️ IMPORTANT: When creating patterns (support, resistance, zones), use these timestamps:\n`;
  context += `First Kline Timestamp: ${recentKlines[0]?.openTime} (${new Date(recentKlines[0]?.openTime || 0).toISOString()})\n`;
  context += `Last Kline Timestamp: ${lastKline.openTime} (${new Date(lastKline.openTime).toISOString()})\n`;
  context += `Timeframe: ${chartData.timeframe} (use appropriate timestamps based on this interval)\n`;
  context += `Total Visible Klines: ${chartData.klines.length}\n`;

  if (visibleMAs.length > 0) {
    context += `\n=== ACTIVE INDICATORS ===\n`;
    visibleMAs.forEach(ma => {
      context += `• ${ma.type}(${ma.period}) - ${ma.color}\n`;
    });
  }

  context += `\n=== RECENT PRICE ACTION (Last 20 klines) ===\n`;
  recentKlines.slice(-20).forEach((kline, i) => {
    const change = ((getKlineClose(kline) - getKlineOpen(kline)) / getKlineOpen(kline) * 100).toFixed(2);
    const trend = getKlineClose(kline) > getKlineOpen(kline) ? '📗' : '📕';
    const volumeRatio = (getKlineVolume(kline) / avgVolume).toFixed(2);
    const timestamp = new Date(kline.openTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    context += `${i + 1}. ${trend} ${timestamp} | O: $${getKlineOpen(kline).toFixed(2)} H: $${getKlineHigh(kline).toFixed(2)} L: $${getKlineLow(kline).toFixed(2)} C: $${getKlineClose(kline).toFixed(2)} | Δ${change}% | Vol: ${volumeRatio}x avg\n`;
  });

  context += `\n--- END CHART DATA ---\n\n`;

  return context;
};

export const useAIStore = create<AIState>((set, get) => {
  const conversationStore = useConversationStore.getState();
  const settingsStore = useAISettingsStore.getState();
  const tradingStore = useAITradingStore.getState();

  const setWithSync = (
    partial: Partial<AIState> | ((state: AIState) => Partial<AIState>)
  ): void => {
    set(partial);
    void saveToElectron(get());
  };

  return {
    conversations: conversationStore.conversations,
    activeConversationId: conversationStore.activeConversationId,
    settings: settingsStore.settings,
    isLoading: false,
    error: null,
    lastAnalysis: null,
    messages: conversationStore.messages,
    provider: settingsStore.provider,
    model: settingsStore.model,
    enableAIPatterns: settingsStore.enableAIPatterns,
    responseProcessor: null,

    isAutoTradingActive: tradingStore.isAutoTradingActive,
    tradingConfig: tradingStore.tradingConfig,
    trades: tradingStore.trades,
    tradingStats: tradingStore.tradingStats,
    lastAnalysisTime: tradingStore.lastAnalysisTime,
    lastTradeTime: tradingStore.lastTradeTime,
    analysisInProgress: tradingStore.analysisInProgress,
    tradingError: tradingStore.tradingError,

    setSettings: (settings) => {
      useAISettingsStore.getState().setSettings(settings);
      setWithSync({
        settings,
        provider: settings.provider,
        model: settings.model || null,
      });
    },

    updateSettings: (partialSettings) => {
      useAISettingsStore.getState().updateSettings(partialSettings);
      const newSettings = useAISettingsStore.getState().settings;
      set({
        settings: newSettings,
        provider: newSettings?.provider || null,
        model: newSettings?.model || null,
      });
    },

    clearSettings: () => {
      useAISettingsStore.getState().clearSettings();
      set({
        settings: null,
        provider: null,
        model: null,
      });
    },

    setResponseProcessor: (processor) => set({ responseProcessor: processor }),

    toggleAIPatterns: () => {
      useAISettingsStore.getState().toggleAIPatterns();
      set((state) => ({ enableAIPatterns: !state.enableAIPatterns }));
    },

    createConversation: (title, symbol) => {
      const id = useConversationStore.getState().createConversation(title, symbol);
      set((state) => ({
        conversations: [...state.conversations, useConversationStore.getState().conversations.find(c => c.id === id)!],
        activeConversationId: id,
      }));
      return id;
    },

    startNewConversation: (symbol) => {
      const newId = useConversationStore.getState().startNewConversation(symbol);
      set({
        activeConversationId: newId,
        messages: [],
        conversations: useConversationStore.getState().conversations,
      });
      return newId;
    },

    deleteConversation: (id) => {
      useConversationStore.getState().deleteConversation(id);
      const convState = useConversationStore.getState();
      set({
        conversations: convState.conversations,
        activeConversationId: convState.activeConversationId,
        messages: convState.messages,
      });
    },

    setActiveConversation: (id) => {
      useConversationStore.getState().setActiveConversation(id);
      const convState = useConversationStore.getState();
      set({
        activeConversationId: id,
        messages: convState.messages,
      });
    },

    setActiveConversationBySymbol: (symbol) => {
      useConversationStore.getState().setActiveConversationBySymbol(symbol);
      const convState = useConversationStore.getState();
      set({
        activeConversationId: convState.activeConversationId,
        messages: convState.messages,
        conversations: convState.conversations,
      });
    },

    restoreActiveConversation: () => {
      useConversationStore.getState().restoreActiveConversation();
      set({ messages: useConversationStore.getState().messages });
    },

    updateConversationTitle: (id, title) => {
      useConversationStore.getState().updateConversationTitle(id, title);
      set({ conversations: useConversationStore.getState().conversations });
    },

    updateConversationPatternDataId: (id, patternDataId) => {
      useConversationStore.getState().updateConversationPatternDataId(id, patternDataId);
      set({ conversations: useConversationStore.getState().conversations });
    },

    addMessage: (conversationId, message) => {
      useConversationStore.getState().addMessage(conversationId, message);
      set({ conversations: useConversationStore.getState().conversations });
    },

    updateMessage: (conversationId, messageId, content) => {
      useConversationStore.getState().updateMessage(conversationId, messageId, content);
      set({ conversations: useConversationStore.getState().conversations });
    },

    deleteMessage: (conversationId, messageId) => {
      useConversationStore.getState().deleteMessage(conversationId, messageId);
      set({ conversations: useConversationStore.getState().conversations });
    },

    clearMessages: (conversationId) => {
      useConversationStore.getState().clearMessages(conversationId);
      set({ conversations: useConversationStore.getState().conversations });
    },

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),

    getActiveConversation: () => useConversationStore.getState().getActiveConversation(),

    getConversationMessages: (id) => useConversationStore.getState().getConversationMessages(id),

    getConversationsBySymbol: (symbol) => useConversationStore.getState().getConversationsBySymbol(symbol),

    exportConversation: (id) => useConversationStore.getState().exportConversation(id),

    importConversation: (data) => {
      useConversationStore.getState().importConversation(data);
      const convState = useConversationStore.getState();
      set({
        conversations: convState.conversations,
        activeConversationId: convState.activeConversationId,
      });
    },

    sendMessage: async (content, chartData) => {
      const state = get();
      const { settings, enableAIPatterns } = state;

      if (!settings?.provider) {
        set({ error: 'Please configure AI settings first' });
        return;
      }

      let conversationId = state.activeConversationId;
      const currentSymbol = chartData?.symbol;

      if (!conversationId) {
        conversationId = get().createConversation(undefined, currentSymbol);
      } else {
        const activeConversation = get().getActiveConversation();
        if (activeConversation && currentSymbol && activeConversation.symbol !== currentSymbol) {
          conversationId = get().createConversation(undefined, currentSymbol);
        }
      }

      const userMessage: Partial<AIMessage> = {
        role: 'user',
        content,
      };
      if (settings.model) userMessage.model = settings.model;

      get().addMessage(conversationId, userMessage as Omit<AIMessage, 'id' | 'openTime'>);

      const conversation = get().getActiveConversation();
      if (!conversation) return;

      set({
        isLoading: true,
        error: null,
        messages: conversation.messages,
      });

      try {
        const aiService = new AIService({
          ...settings,
          enableAIPatterns,
        });

        const messagesForAPI = chartData
          ? [
              ...conversation.messages.slice(0, -1),
              {
                ...conversation.messages[conversation.messages.length - 1]!,
                content: content + formatChartDataContext(chartData)
              }
            ]
          : conversation.messages;

        const response = await aiService.sendMessage(messagesForAPI);

        let processedContent = response.text;
        if (state.responseProcessor) {
          processedContent = await state.responseProcessor(response.text);
        }

        const assistantMessage: Partial<AIMessage> = {
          role: 'assistant',
          content: processedContent,
        };
        if (settings.model) assistantMessage.model = settings.model;

        get().addMessage(conversationId, assistantMessage as Omit<AIMessage, 'id' | 'openTime'>);

        const updatedConversation = get().getActiveConversation();

        set({
          isLoading: false,
          messages: updatedConversation?.messages || [],
          lastAnalysis: response,
        });
      } catch (error) {
        const errorMessage = error instanceof Error
          ? formatAIError(error, settings.provider, settings.model)
          : 'Failed to send message';

        set({
          isLoading: false,
          error: errorMessage,
        });
      }
    },

    toggleAutoTrading: () => {
      useAITradingStore.getState().toggleAutoTrading();
      const tradState = useAITradingStore.getState();
      setWithSync({
        isAutoTradingActive: tradState.isAutoTradingActive,
        tradingError: tradState.tradingError,
      });
    },

    updateTradingConfig: (config) => {
      useAITradingStore.getState().updateTradingConfig(config);
      setWithSync({
        tradingConfig: useAITradingStore.getState().tradingConfig,
      });
    },

    addTrade: (trade) => {
      useAITradingStore.getState().addTrade(trade);
      const tradState = useAITradingStore.getState();
      setWithSync({
        trades: tradState.trades,
        lastTradeTime: tradState.lastTradeTime,
      });
    },

    updateTrade: (tradeId, updates) => {
      useAITradingStore.getState().updateTrade(tradeId, updates);
      setWithSync({
        trades: useAITradingStore.getState().trades,
      });
    },

    setTradingAnalysisProgress: (inProgress) => {
      useAITradingStore.getState().setTradingAnalysisProgress(inProgress);
      set({ analysisInProgress: inProgress });
    },

    setTradingError: (error) => {
      useAITradingStore.getState().setTradingError(error);
      set({ tradingError: error });
    },

    calculateTradingStats: () => {
      useAITradingStore.getState().calculateTradingStats();
      set({ tradingStats: useAITradingStore.getState().tradingStats });
    },

    clearTradingHistory: () => {
      useAITradingStore.getState().clearTradingHistory();
      const tradState = useAITradingStore.getState();
      setWithSync({
        trades: tradState.trades,
        tradingStats: tradState.tradingStats,
        lastTradeTime: tradState.lastTradeTime,
      });
    },

    clearAll: () => {
      useConversationStore.getState().clearAll();
      setWithSync({
        conversations: [],
        activeConversationId: null,
        isLoading: false,
        error: null,
        lastAnalysis: null,
        messages: [],
      });
    },

    syncWithElectron: async () => {
      const data = await loadFromElectron();

      if (data.conversations) {
        useConversationStore.getState().loadFromStorage({
          conversations: data.conversations,
          activeConversationId: data.activeConversationId,
        });
      }

      if (data.settings) {
        useAISettingsStore.getState().loadFromStorage({
          settings: data.settings,
          enableAIPatterns: data.enableAIPatterns,
          provider: data.settings.provider,
          model: data.settings.model || null,
        });
      }

      useAITradingStore.getState().loadFromStorage({
        isAutoTradingActive: data.isAutoTradingActive,
        tradingConfig: data.tradingConfig,
        trades: data.trades,
        tradingStats: data.tradingStats,
      });

      set({
        conversations: data.conversations || [],
        activeConversationId: data.activeConversationId || null,
        settings: data.settings || null,
        enableAIPatterns: data.enableAIPatterns ?? true,
        provider: data.settings?.provider || null,
        model: data.settings?.model || null,
        isAutoTradingActive: data.isAutoTradingActive || false,
        tradingConfig: data.tradingConfig || DEFAULT_TRADING_CONFIG,
        trades: data.trades || [],
        tradingStats: data.tradingStats || DEFAULT_TRADING_STATS,
      });
    },

    saveToElectron: async () => {
      await saveToElectron(get());
    },
  };
});

useAIStore.subscribe((state, prevState) => {
  const hasChanged =
    state.conversations !== prevState.conversations ||
    state.activeConversationId !== prevState.activeConversationId ||
    state.settings !== prevState.settings ||
    state.enableAIPatterns !== prevState.enableAIPatterns;

  if (hasChanged) {
    void saveToElectron(state);
  }
});
