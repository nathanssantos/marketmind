import type { Timeframe } from '@/renderer/components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '@/renderer/components/Chart/useMovingAverageRenderer';
import { AIService } from '@/renderer/services/ai';
import type { AIAnalysisResponse, AIMessage, AIProviderType, Candle } from '@shared/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash-exp',
};

const MAX_MESSAGES_PER_CONVERSATION = 100;
const MAX_STORED_CONVERSATIONS = 50;

export interface ChartData {
  candles: Candle[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  symbol?: string;
  studyDataId?: string;
}

export interface AISettings {
  provider: AIProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedCandlesCount?: number;
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
  enableAIStudies: boolean;
  
  responseProcessor: ((response: string) => string) | null;

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
  updateConversationStudyDataId: (id: string, studyDataId: string | undefined) => void;

  addMessage: (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
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
  setResponseProcessor: (processor: ((response: string) => string) | null) => void;
  toggleAIStudies: () => void;

  clearAll: () => void;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateTitle = (messages: AIMessage[]): string => {
  if (messages.length === 0) return 'New Conversation';
  
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';
  
  const preview = firstUserMessage.content.slice(0, 50);
  return preview.length < firstUserMessage.content.length 
    ? `${preview}...` 
    : preview;
};

const formatAIError = (error: Error, provider?: AIProviderType): string => {
  let errorMessage = error.message;
  
  const providerName = provider === 'anthropic' ? 'Claude' : 
                      provider === 'openai' ? 'OpenAI' : 
                      provider === 'gemini' ? 'Gemini' : 'AI';
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota')) {
    if (provider === 'gemini') {
      const waitTime = errorMessage.match(/retry in (\d+)/i)?.[1] || '60';
      if (errorMessage.includes('limit: 0') || errorMessage.includes('Quota exceeded')) {
        return `⚠️ **Cota do Gemini 2.0 Flash Exp esgotada**\n\n` +
          `O tier gratuito tem limite de **10 requisições por minuto**.\n\n` +
          `**Soluções:**\n` +
          `• Aguarde ${waitTime} segundos e tente novamente\n` +
          `• Ou vá em Settings > AI Configuration e troque para **Gemini 1.5 Flash** (mais rápido e barato)\n` +
          `• Ou use outro provedor (OpenAI/Claude)`;
      } else {
        return `⚠️ Limite de requisições do Gemini excedido (10 req/min). Aguarde ${waitTime}s ou troque de modelo nas configurações.`;
      }
    } else {
      return `⚠️ Limite de requisições excedido no ${providerName}. Aguarde alguns minutos e tente novamente.`;
    }
  } else if (errorMessage.includes('rate limit')) {
    return `⚠️ Taxa de requisições excedida no ${providerName}. Aguarde alguns minutos.`;
  } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('invalid') || errorMessage.includes('API key')) {
    return `🔑 Invalid API key for ${providerName}. Check your settings.`;
  } else if (errorMessage.includes('timeout')) {
    return '⏱️ Request timeout. Try again.';
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return '🌐 Connection error. Check your internet.';
  } else if (errorMessage.includes('context_length') || errorMessage.includes('too long')) {
    return '📏 Message too long. Reduce size or clear history.';
  }
  
  return errorMessage;
};

const formatChartDataContext = (chartData: ChartData): string => {
  const recentCandles = chartData.candles.slice(-100);
  const lastCandle = recentCandles[recentCandles.length - 1];
  
  if (!lastCandle) return '';

  const visibleMAs = chartData.movingAverages.filter(ma => ma.visible);
  
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);
  const volumes = recentCandles.map(c => c.volume);
  
  const highestPrice = Math.max(...highs);
  const lowestPrice = Math.min(...lows);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const priceRange = ((highestPrice - lowestPrice) / lowestPrice * 100).toFixed(2);
  
  const first = recentCandles[0];
  const last = recentCandles[recentCandles.length - 1];
  const overallChange = first && last ? ((last.close - first.close) / first.close * 100).toFixed(2) : '0';
  
  const bullishCount = recentCandles.filter(c => c.close > c.open).length;
  const bearishCount = recentCandles.length - bullishCount;
  
  let context = `\n\n--- CHART DATA CONTEXT ---\n`;
  context += `Market: ${chartData.symbol}\n`;
  context += `Timeframe: ${chartData.timeframe}\n`;
  context += `Chart Type: ${chartData.chartType}\n`;
  context += `Data Points: ${chartData.candles.length} candles\n`;
  context += `\n=== CURRENT MARKET STATE ===\n`;
  context += `Current Price: $${lastCandle.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Open: $${lastCandle.open.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `High: $${lastCandle.high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Low: $${lastCandle.low.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Volume: ${lastCandle.volume.toLocaleString()}\n`;
  context += `Current Candle Change: ${((lastCandle.close - lastCandle.open) / lastCandle.open * 100).toFixed(2)}%\n`;
  
  context += `\n=== STATISTICAL ANALYSIS (Last 100 candles) ===\n`;
  context += `Highest Price: $${highestPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Lowest Price: $${lowestPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  context += `Price Range: ${priceRange}%\n`;
  context += `Overall Trend: ${parseFloat(overallChange) > 0 ? '📈 Bullish' : '📉 Bearish'} (${overallChange}%)\n`;
  context += `Average Volume: ${avgVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
  context += `Bullish Candles: ${bullishCount} (${(bullishCount / recentCandles.length * 100).toFixed(1)}%)\n`;
  context += `Bearish Candles: ${bearishCount} (${(bearishCount / recentCandles.length * 100).toFixed(1)}%)\n`;
  
  context += `\n=== TIMESTAMP INFORMATION FOR DRAWING STUDIES ===\n`;
  context += `⚠️ IMPORTANT: When creating studies (support, resistance, zones), use these timestamps:\n`;
  context += `First Candle Timestamp: ${recentCandles[0]?.timestamp} (${new Date(recentCandles[0]?.timestamp || 0).toISOString()})\n`;
  context += `Last Candle Timestamp: ${lastCandle.timestamp} (${new Date(lastCandle.timestamp).toISOString()})\n`;
  context += `Timeframe: ${chartData.timeframe} (use appropriate timestamps based on this interval)\n`;
  context += `Total Visible Candles: ${chartData.candles.length}\n`;
  
  if (visibleMAs.length > 0) {
    context += `\n=== ACTIVE INDICATORS ===\n`;
    visibleMAs.forEach(ma => {
      context += `• ${ma.type}(${ma.period}) - ${ma.color}\n`;
    });
  }
  
  context += `\n=== RECENT PRICE ACTION (Last 20 candles) ===\n`;
  recentCandles.slice(-20).forEach((candle, i) => {
    const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
    const trend = candle.close > candle.open ? '�' : '�';
    const volumeRatio = (candle.volume / avgVolume).toFixed(2);
    const timestamp = new Date(candle.timestamp).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    context += `${i + 1}. ${trend} ${timestamp} | O: $${candle.open.toFixed(2)} H: $${candle.high.toFixed(2)} L: $${candle.low.toFixed(2)} C: $${candle.close.toFixed(2)} | Δ${change}% | Vol: ${volumeRatio}x avg\n`;
  });
  
  context += `\n--- END CHART DATA ---\n\n`;
  
  return context;
};

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      settings: { provider: 'openai', model: 'gpt-4o' },
      isLoading: false,
      error: null,
      lastAnalysis: null,
      messages: [],
      provider: 'openai',
      model: 'gpt-4o',
      enableAIStudies: true,
      responseProcessor: null,

      setSettings: (settings) => set({ 
        settings,
        provider: settings.provider,
        model: settings.model || null,
      }),
      
      updateSettings: (partialSettings) => set((state) => {
        const currentSettings = state.settings || { provider: 'openai' as AIProviderType, model: 'gpt-4o' };
        const newProvider = partialSettings.provider || currentSettings.provider;
        let newModel = partialSettings.model || currentSettings.model;
        
        if (partialSettings.provider && newProvider && !partialSettings.model) {
          newModel = DEFAULT_MODELS[newProvider];
        }
        
        const newSettings = { 
          ...currentSettings, 
          ...partialSettings, 
          ...(newModel ? { model: newModel } : {}) 
        };
        
        return {
          settings: newSettings,
          provider: newSettings.provider,
          model: newSettings.model || null,
        };
      }),

      clearSettings: () => set({ 
        settings: null,
        provider: null,
        model: null,
      }),

      setResponseProcessor: (processor) => set({ responseProcessor: processor }),

      toggleAIStudies: () => set((state) => ({ enableAIStudies: !state.enableAIStudies })),

      createConversation: (title, symbol) => {
        const id = generateId();
        const now = Date.now();
        
        const conversation: Conversation = {
          id,
          title: title || 'New Conversation',
          messages: [],
          createdAt: now,
          updatedAt: now,
          ...(symbol ? { symbol } : {}),
        };

        set((state) => ({
          conversations: [...state.conversations, conversation],
          activeConversationId: id,
        }));

        return id;
      },

      startNewConversation: (symbol) => {
        const newId = get().createConversation(undefined, symbol);
        set({ 
          activeConversationId: newId,
          messages: [],
        });
        return newId;
      },

      deleteConversation: (id) => set((state) => {
        const wasActive = state.activeConversationId === id;
        return {
          conversations: state.conversations.filter(c => c.id !== id),
          activeConversationId: wasActive ? null : state.activeConversationId,
          messages: wasActive ? [] : state.messages,
        };
      }),

      setActiveConversation: (id) => {
        const state = get();
        const conversation = state.conversations.find(c => c.id === id);
        set({ 
          activeConversationId: id,
          messages: conversation?.messages || [],
        });
      },

      setActiveConversationBySymbol: (symbol) => {
        const state = get();
        const conversationForSymbol = state.conversations
          .filter(c => c.symbol === symbol)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        
        if (conversationForSymbol) {
          set({ 
            activeConversationId: conversationForSymbol.id,
            messages: conversationForSymbol.messages,
          });
        } else {
          const newId = get().createConversation(undefined, symbol);
          set({ 
            activeConversationId: newId,
            messages: [],
          });
        }
      },

      restoreActiveConversation: () => {
        const state = get();
        if (!state.activeConversationId) return;
        
        const conversation = state.conversations.find(c => c.id === state.activeConversationId);
        if (conversation) {
          set({ messages: conversation.messages });
        }
      },

      updateConversationTitle: (id, title) => set((state) => ({
        conversations: state.conversations.map(c =>
          c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        ),
      })),

      updateConversationStudyDataId: (id, studyDataId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== id) return c;
          const updated: Conversation = { ...c, updatedAt: Date.now() };
          if (studyDataId !== undefined) {
            updated.studyDataId = studyDataId;
          } else {
            delete updated.studyDataId;
          }
          return updated;
        }),
      })),

      addMessage: (conversationId, message) => set((state) => {
        const conversations = state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          const newMessage: AIMessage = {
            ...message,
            id: generateId(),
            timestamp: Date.now(),
          };

          let updatedMessages = [...c.messages, newMessage];
          
          if (updatedMessages.length > MAX_MESSAGES_PER_CONVERSATION) {
            updatedMessages = updatedMessages.slice(-MAX_MESSAGES_PER_CONVERSATION);
          }
          
          const title = c.title === 'New Conversation' 
            ? generateTitle(updatedMessages)
            : c.title;

          return {
            ...c,
            messages: updatedMessages,
            title,
            updatedAt: Date.now(),
          };
        });

        let limitedConversations = conversations;
        if (limitedConversations.length > MAX_STORED_CONVERSATIONS) {
          limitedConversations = limitedConversations
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_STORED_CONVERSATIONS);
        }

        return { conversations: limitedConversations };
      }),

      updateMessage: (conversationId, messageId, content) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === messageId ? { ...m, content } : m
            ),
            updatedAt: Date.now(),
          };
        }),
      })),

      deleteMessage: (conversationId, messageId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: c.messages.filter(m => m.id !== messageId),
            updatedAt: Date.now(),
          };
        }),
      })),

      clearMessages: (conversationId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: [],
            title: 'New Conversation',
            updatedAt: Date.now(),
          };
        }),
      })),

      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),

      getActiveConversation: () => {
        const state = get();
        if (!state.activeConversationId) return null;
        
        return state.conversations.find(c => c.id === state.activeConversationId) || null;
      },

      getConversationMessages: (id) => {
        const conversation = get().conversations.find(c => c.id === id);
        return conversation?.messages || [];
      },

      getConversationsBySymbol: (symbol) => {
        return get().conversations
          .filter(c => c.symbol === symbol)
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      exportConversation: (id) => {
        const conversation = get().conversations.find(c => c.id === id);
        if (!conversation) throw new Error('Conversation not found');
        
        return JSON.stringify(conversation, null, 2);
      },

      importConversation: (data) => {
        try {
          const conversation = JSON.parse(data) as Conversation;
          
          const newId = generateId();
          const importedConversation: Conversation = {
            ...conversation,
            id: newId,
            title: `${conversation.title} (Imported)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          set((state) => ({
            conversations: [...state.conversations, importedConversation],
            activeConversationId: newId,
          }));
        } catch (error) {
          throw new Error('Invalid conversation data');
        }
      },

      sendMessage: async (content, chartData) => {
        const state = get();
        const { settings, enableAIStudies } = state;

        if (!settings || !settings.provider) {
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
        
        get().addMessage(conversationId, userMessage as Omit<AIMessage, 'id' | 'timestamp'>);

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
            enableAIStudies,
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
            processedContent = state.responseProcessor(response.text);
          }

          const assistantMessage: Partial<AIMessage> = {
            role: 'assistant',
            content: processedContent,
          };
          if (settings.model) assistantMessage.model = settings.model;
          
          get().addMessage(conversationId, assistantMessage as Omit<AIMessage, 'id' | 'timestamp'>);

          const updatedConversation = get().getActiveConversation();
          
          set({ 
            isLoading: false,
            messages: updatedConversation?.messages || [],
            lastAnalysis: response,
          });
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? formatAIError(error, settings.provider)
            : 'Failed to send message';
          
          set({ 
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      clearAll: () => set({
        conversations: [],
        activeConversationId: null,
        isLoading: false,
        error: null,
        lastAnalysis: null,
        messages: [],
      }),
    }),
    {
      name: 'marketmind-ai-storage',
      version: 1,
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        settings: state.settings,
        provider: state.provider,
        model: state.model,
        enableAIStudies: state.enableAIStudies,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
        if (!state.settings || !state.settings.provider) {
          state.settings = { provider: 'openai', model: 'gpt-4o' };
          state.provider = 'openai';
          state.model = 'gpt-4o';
        } else if (!state.provider) {
          state.provider = state.settings.provider;
          state.model = state.settings.model || null;
        }
      },
    }
  )
);
