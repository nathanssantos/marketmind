import type { AIAnalysisRequest } from '@shared/types';
import { useCallback, useMemo } from 'react';
import { AIService, type AIServiceConfig } from '../services/ai';
import { useAIStore } from '../store/aiStore';

let defaultAIServiceInstance: AIService | null = null;

const getDefaultAIService = (config: AIServiceConfig): AIService => {
  if (!defaultAIServiceInstance || 
      defaultAIServiceInstance.getConfig().provider !== config.provider ||
      defaultAIServiceInstance.getConfig().model !== config.model) {
    defaultAIServiceInstance = new AIService(config);
  }
  return defaultAIServiceInstance;
};

const formatAIError = (error: Error, provider?: string): string => {
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
    return `🔑 Chave API inválida para ${providerName}. Verifique sua configuração.`;
  } else if (errorMessage.includes('timeout')) {
    return '⏱️ Tempo limite excedido. Tente novamente.';
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return '🌐 Erro de conexão. Verifique sua internet.';
  } else if (errorMessage.includes('context_length') || errorMessage.includes('too long')) {
    return '📏 Mensagem muito longa. Reduza o tamanho ou limpe o histórico.';
  }
  
  return errorMessage;
};

export interface UseAIOptions {
  service?: AIService;
}

export const useAI = (options?: UseAIOptions) => {
  const {
    conversations,
    activeConversationId,
    settings,
    isLoading,
    error,
    lastAnalysis,
    setSettings,
    updateSettings,
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    addMessage,
    clearMessages,
    setLoading,
    setError,
    setLastAnalysis,
    getActiveConversation,
    exportConversation,
    importConversation,
  } = useAIStore();

  const aiService = useMemo(() => {
    if (options?.service) {
      return options.service;
    }

    if (!settings) return null;

    try {
      const config: AIServiceConfig = {
        provider: settings.provider,
      };

      if (settings.model) config.model = settings.model;
      if (settings.temperature !== undefined) config.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) config.maxTokens = settings.maxTokens;

      return getDefaultAIService(config);
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      return null;
    }
  }, [settings, options?.service]);

  const isConfigured = useMemo(() => {
    return settings !== null;
  }, [settings]);

  const sendMessage = useCallback(
    async (content: string, images?: string[]) => {
      if (!aiService || !activeConversationId) {
        setError('AI service not configured or no active conversation');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const messageData: Parameters<typeof addMessage>[1] = {
          role: 'user',
          content,
        };

        if (images && images.length > 0) {
          messageData.images = images;
        }

        addMessage(activeConversationId, messageData);

        const conversation = getActiveConversation();
        if (!conversation) {
          throw new Error('Active conversation not found');
        }

        const response = await aiService.sendMessage(conversation.messages, images);

        const assistantMessage: Parameters<typeof addMessage>[1] = {
          role: 'assistant',
          content: response.text,
        };

        if (settings?.model) {
          assistantMessage.model = settings.model;
        }

        addMessage(activeConversationId, assistantMessage);

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? formatAIError(error, settings?.provider)
          : 'Unknown error';
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, activeConversationId, addMessage, getActiveConversation, setError, setLoading, settings]
  );

  const analyzeChart = useCallback(
    async (request: AIAnalysisRequest) => {
      if (!aiService) {
        setError('AI service not configured');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await aiService.analyzeChart(request);
        setLastAnalysis(response);

        if (activeConversationId) {
          addMessage(activeConversationId, {
            role: 'user',
            content: `[Chart Analysis Request] ${request.context || 'Analyzing chart...'}`,
            images: [request.chartImage],
          });

          const assistantMessage: Parameters<typeof addMessage>[1] = {
            role: 'assistant',
            content: response.text,
          };

          if (settings?.model) {
            assistantMessage.model = settings.model;
          }

          addMessage(activeConversationId, assistantMessage);
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? formatAIError(error, settings?.provider)
          : 'Unknown error';
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, activeConversationId, addMessage, setError, setLoading, setLastAnalysis, settings]
  );

  const analyzeChartSilent = useCallback(
    async (request: AIAnalysisRequest) => {
      if (!aiService) {
        setError('AI service not configured');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await aiService.analyzeChart(request);
        setLastAnalysis(response);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? formatAIError(error, settings?.provider)
          : 'Unknown error';
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, setError, setLoading, setLastAnalysis, settings]
  );

  const quickAnalyze = useCallback(
    async (chartImage: string, context?: string) => {
      const request: AIAnalysisRequest = {
        chartImage,
        candles: [],
      };

      if (context) {
        request.context = context;
      }

      return analyzeChart(request);
    },
    [analyzeChart]
  );

  const startNewConversation = useCallback(() => {
    const id = createConversation();
    setActiveConversation(id);
    return id;
  }, [createConversation, setActiveConversation]);

  const configure = useCallback(
    (newSettings: Parameters<typeof setSettings>[0]) => {
      setSettings(newSettings);
    },
    [setSettings]
  );

  const updateConfig = useCallback(
    (partialSettings: Parameters<typeof updateSettings>[0]) => {
      updateSettings(partialSettings);
    },
    [updateSettings]
  );

  return {
    conversations,
    activeConversationId,
    activeConversation: getActiveConversation(),
    settings,
    isConfigured,
    isLoading,
    error,
    lastAnalysis,

    configure,
    updateConfig,
    
    sendMessage,
    analyzeChart,
    analyzeChartSilent,
    quickAnalyze,

    createConversation: startNewConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    clearMessages,
    exportConversation,
    importConversation,
  };
};
