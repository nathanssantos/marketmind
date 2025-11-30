import type { AIAnalysisRequest } from '@shared/types';
import { useCallback, useMemo } from 'react';
import { useChartContext } from '../context/ChartContext';
import { AIService, type AIServiceConfig } from '../services/ai';
import { useAIStore } from '../store/aiStore';
import { useUIStore } from '../store/uiStore';

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
  const errorMessage = error.message;
  
  const providerName = provider === 'anthropic' ? 'Claude' : 
                      provider === 'openai' ? 'OpenAI' : 
                      provider === 'gemini' ? 'Gemini' : 'AI';
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota')) {
    if (provider === 'gemini') {
      const waitTime = errorMessage.match(/retry in (\d+)/i)?.[1] || '60';
      if (errorMessage.includes('limit: 0') || errorMessage.includes('Quota exceeded')) {
        return `⚠️ **Gemini 2.0 Flash Exp quota exhausted**\n\n` +
          `The free tier has a limit of **10 requests per minute**.\n\n` +
          `**Solutions:**\n` +
          `• Wait ${waitTime} seconds and try again\n` +
          `• Or go to Settings > AI Configuration and switch to **Gemini 1.5 Flash** (faster and cheaper)\n` +
          `• Or use another provider (OpenAI/Claude)`;
      } else {
        return `⚠️ Gemini request limit exceeded (10 req/min). Wait ${waitTime}s or switch model in settings.`;
      }
    } else {
      return `⚠️ Request limit exceeded on ${providerName}. Wait a few minutes and try again.`;
    }
  } else if (errorMessage.includes('rate limit')) {
    return `⚠️ Rate limit exceeded on ${providerName}. Wait a few minutes.`;
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
    enableAIPatterns,
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

  const { chartData } = useChartContext();
  const { patternDetectionMode } = useUIStore();

  const aiService = useMemo(() => {
    if (options?.service) {
      return options.service;
    }

    if (!settings) return null;

    try {
      const config: AIServiceConfig = {
        provider: settings.provider,
        enableAIPatterns,
        useAlgorithmicDetection: patternDetectionMode === 'hybrid' || patternDetectionMode === 'algorithmic-only',
      };

      if (settings.model) config.model = settings.model;
      if (settings.temperature !== undefined) config.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) config.maxTokens = settings.maxTokens;
      if (settings.detailedKlinesCount !== undefined) config.detailedKlinesCount = settings.detailedKlinesCount;

      return getDefaultAIService(config);
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      return null;
    }
  }, [settings, options?.service, enableAIPatterns, patternDetectionMode]);

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
        klines: chartData?.klines || [],
        ...(chartData?.news && { news: chartData.news }),
        ...(chartData?.events && { events: chartData.events }),
      };

      if (context) {
        request.context = context;
      }

      console.log('[AI Analysis] Request prepared:', {
        hasNews: !!request.news,
        newsCount: request.news?.length || 0,
        hasEvents: !!request.events,
        eventsCount: request.events?.length || 0,
        klinesCount: request.klines.length,
      });

      if (request.news && request.news.length > 0) {
        console.log('[AI Analysis] News articles being sent to AI:', 
          request.news.slice(0, 5).map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join('\n')
        );
      }

      if (request.events && request.events.length > 0) {
        console.log('[AI Analysis] Events being sent to AI:', 
          request.events.slice(0, 5).map((e, i) => `${i + 1}. ${e.title} (${e.type}, ${e.importance})`).join('\n')
        );
      }

      return analyzeChart(request);
    },
    [analyzeChart, chartData]
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
