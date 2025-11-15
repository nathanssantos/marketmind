import type { AIAnalysisRequest } from '@shared/types';
import { useCallback, useMemo } from 'react';
import { AIService, type AIServiceConfig } from '../services/ai';
import { useAIStore } from '../store/aiStore';

export const useAI = () => {
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
    if (!settings) return null;

    try {
      const config: AIServiceConfig = {
        provider: settings.provider,
        apiKey: settings.apiKey,
      };

      if (settings.model) config.model = settings.model;
      if (settings.temperature !== undefined) config.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) config.maxTokens = settings.maxTokens;

      return new AIService(config);
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      return null;
    }
  }, [settings]);

  const isConfigured = useMemo(() => {
    return settings !== null && settings.apiKey.length > 0;
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
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Mensagens mais amigáveis para erros comuns
          if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            errorMessage = '⚠️ Você excedeu a cota da API OpenAI. Verifique seu plano em https://platform.openai.com/account/billing';
          } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            errorMessage = '🔑 Chave API inválida. Verifique sua API key em https://platform.openai.com/api-keys';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = '⏱️ Tempo limite excedido. Tente novamente.';
          } else if (errorMessage.includes('network')) {
            errorMessage = '🌐 Erro de conexão. Verifique sua internet.';
          }
        }
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, activeConversationId, addMessage, getActiveConversation, setError, setLoading]
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
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Mensagens mais amigáveis para erros comuns
          if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            errorMessage = '⚠️ Você excedeu a cota da API OpenAI. Verifique seu plano em https://platform.openai.com/account/billing';
          } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            errorMessage = '🔑 Chave API inválida. Verifique sua API key em https://platform.openai.com/api-keys';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = '⏱️ Tempo limite excedido. Tente novamente.';
          } else if (errorMessage.includes('network')) {
            errorMessage = '🌐 Erro de conexão. Verifique sua internet.';
          }
        }
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, activeConversationId, addMessage, setError, setLoading, setLastAnalysis]
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
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Mensagens mais amigáveis para erros comuns
          if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            errorMessage = '⚠️ Você excedeu a cota da API OpenAI. Verifique seu plano em https://platform.openai.com/account/billing';
          } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            errorMessage = '🔑 Chave API inválida. Verifique sua API key em https://platform.openai.com/api-keys';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = '⏱️ Tempo limite excedido. Tente novamente.';
          } else if (errorMessage.includes('network')) {
            errorMessage = '🌐 Erro de conexão. Verifique sua internet.';
          }
        }
        
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiService, setError, setLoading, setLastAnalysis]
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
