import type { AIAnalysisResponse, AIMessage, AIProviderType, Candle } from '@shared/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIService } from '../services/ai';
import { useAIStore, type AISettings, type Conversation } from '../store/aiStore';
import { useAI } from './useAI';

vi.mock('../store/aiStore');

describe('useAI', () => {
  const mockConversationId = 'conv-1';
  const mockMessages: AIMessage[] = [
    { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
  ];

  const mockSettings: AISettings = {
    provider: 'openai' as AIProviderType,
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
  };

  interface MockStore {
    conversations: Conversation[];
    activeConversationId: string | null;
    settings: AISettings | null;
    isLoading: boolean;
    error: string | null;
    lastAnalysis: unknown;
    setSettings: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
    createConversation: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
    setActiveConversation: ReturnType<typeof vi.fn>;
    updateConversationTitle: ReturnType<typeof vi.fn>;
    addMessage: ReturnType<typeof vi.fn>;
    clearMessages: ReturnType<typeof vi.fn>;
    setLoading: ReturnType<typeof vi.fn>;
    setError: ReturnType<typeof vi.fn>;
    setLastAnalysis: ReturnType<typeof vi.fn>;
    getActiveConversation: ReturnType<typeof vi.fn>;
    exportConversation: ReturnType<typeof vi.fn>;
    importConversation: ReturnType<typeof vi.fn>;
  }

  let mockStore: MockStore;
  let mockAIService: AIService;

  beforeEach(() => {
    const sendMessageMock = vi.fn<(messages: AIMessage[], images?: string[]) => Promise<AIAnalysisResponse>>()
      .mockResolvedValue({ text: 'AI response' });
    
    const analyzeChartMock = vi.fn<(candles: Candle[], symbol?: string) => Promise<AIAnalysisResponse>>()
      .mockResolvedValue({ text: 'Chart analysis' });

    mockAIService = {
      sendMessage: sendMessageMock,
      analyzeChart: analyzeChartMock,
      getConfig: vi.fn().mockReturnValue(mockSettings),
      getProviderType: vi.fn().mockReturnValue('openai'),
    } as unknown as AIService;

    mockStore = {
      conversations: [
        { id: mockConversationId, title: 'Test', messages: mockMessages, createdAt: Date.now(), updatedAt: Date.now() },
      ],
      activeConversationId: mockConversationId,
      settings: mockSettings,
      isLoading: false,
      error: null,
      lastAnalysis: null,
      setSettings: vi.fn(),
      updateSettings: vi.fn(),
      createConversation: vi.fn().mockReturnValue('new-conv-id'),
      deleteConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      updateConversationTitle: vi.fn(),
      addMessage: vi.fn(),
      clearMessages: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setLastAnalysis: vi.fn(),
      getActiveConversation: vi.fn().mockReturnValue({
        id: mockConversationId,
        title: 'Test',
        messages: mockMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      exportConversation: vi.fn(),
      importConversation: vi.fn(),
    };

    vi.mocked(useAIStore).mockReturnValue(mockStore);
  });

  it('should return store state', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    expect(result.current.conversations).toEqual(mockStore.conversations);
    expect(result.current.activeConversationId).toBe(mockConversationId);
    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.isConfigured).toBe(true);
  });

  it('should indicate not configured when settings is null', () => {
    mockStore.settings = null;

    const { result } = renderHook(() => useAI({ service: mockAIService }));

    expect(result.current.isConfigured).toBe(false);
  });

  it('should send message successfully', async () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    let response;
    await act(async () => {
      response = await result.current.sendMessage('Test message');
    });

    expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    expect(mockStore.addMessage).toHaveBeenCalledWith(mockConversationId, {
      role: 'user',
      content: 'Test message',
    });
    expect(mockAIService.sendMessage).toHaveBeenCalled();
    expect(mockStore.addMessage).toHaveBeenCalledWith(
      mockConversationId,
      expect.objectContaining({
        role: 'assistant',
        content: 'AI response',
        model: 'gpt-4o',
      })
    );
    expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    expect(response).toEqual({ text: 'AI response' });
  });

  it('should send message with images', async () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));
    const images = ['data:image/png;base64,abc123'];

    await act(async () => {
      await result.current.sendMessage('Analyze this', images);
    });

    expect(mockStore.addMessage).toHaveBeenCalledWith(mockConversationId, {
      role: 'user',
      content: 'Analyze this',
      images,
    });
    expect(mockAIService.sendMessage).toHaveBeenCalledWith(mockMessages, images);
  });

  it('should handle sendMessage error when no service', async () => {
    mockStore.settings = null;
    const { result } = renderHook(() => useAI());

    await act(async () => {
      const response = await result.current.sendMessage('Test');
      expect(response).toBe(null);
    });

    expect(mockStore.setError).toHaveBeenCalledWith('AI service not configured or no active conversation');
  });

  it('should handle sendMessage error when no active conversation', async () => {
    mockStore.activeConversationId = null;
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    await act(async () => {
      const response = await result.current.sendMessage('Test');
      expect(response).toBe(null);
    });

    expect(mockStore.setError).toHaveBeenCalledWith('AI service not configured or no active conversation');
  });

  it('should analyze chart successfully', async () => {
    const chartRequest = {
      chartImage: 'data:image/png;base64,chart',
      candles: [],
      context: 'Analyze this chart',
    };

    const { result } = renderHook(() => useAI({ service: mockAIService }));

    let response;
    await act(async () => {
      response = await result.current.analyzeChart(chartRequest);
    });

    expect(mockAIService.analyzeChart).toHaveBeenCalledWith(chartRequest);
    expect(mockStore.setLastAnalysis).toHaveBeenCalledWith({ text: 'Chart analysis' });
    expect(response).toEqual({ text: 'Chart analysis' });
  });

  it('should analyze chart and add to conversation', async () => {
    const chartRequest = {
      chartImage: 'data:image/png;base64,chart',
      candles: [],
    };

    const { result } = renderHook(() => useAI({ service: mockAIService }));

    await act(async () => {
      await result.current.analyzeChart(chartRequest);
    });

    expect(mockStore.addMessage).toHaveBeenCalledWith(
      mockConversationId,
      expect.objectContaining({
        role: 'user',
        images: [chartRequest.chartImage],
      })
    );

    expect(mockStore.addMessage).toHaveBeenCalledWith(
      mockConversationId,
      expect.objectContaining({
        role: 'assistant',
        content: 'Chart analysis',
      })
    );
  });

  it('should analyzeChartSilent without adding to conversation', async () => {
    const chartRequest = {
      chartImage: 'data:image/png;base64,chart',
      candles: [],
    };

    const { result } = renderHook(() => useAI({ service: mockAIService }));

    await act(async () => {
      await result.current.analyzeChartSilent(chartRequest);
    });

    expect(mockAIService.analyzeChart).toHaveBeenCalledWith(chartRequest);
    expect(mockStore.setLastAnalysis).toHaveBeenCalled();
    
    const addMessageCalls = (mockStore.addMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(addMessageCalls.length).toBe(0);
  });

  it('should use quickAnalyze shortcut', async () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    await act(async () => {
      await result.current.quickAnalyze('data:image/png;base64,chart', 'Quick analysis');
    });

    expect(mockAIService.analyzeChart).toHaveBeenCalledWith({
      chartImage: 'data:image/png;base64,chart',
      candles: [],
      context: 'Quick analysis',
    });
  });

  it('should create and activate new conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    let newId;
    act(() => {
      newId = result.current.createConversation();
    });

    expect(mockStore.createConversation).toHaveBeenCalled();
    expect(mockStore.setActiveConversation).toHaveBeenCalledWith('new-conv-id');
    expect(newId).toBe('new-conv-id');
  });

  it('should configure settings', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));
    const newSettings = {
      provider: 'anthropic' as AIProviderType,
      model: 'claude-sonnet-4-5-20250514',
    };

    act(() => {
      result.current.configure(newSettings);
    });

    expect(mockStore.setSettings).toHaveBeenCalledWith(newSettings);
  });

  it('should update partial settings', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));
    const partialSettings = { temperature: 0.9 };

    act(() => {
      result.current.updateConfig(partialSettings);
    });

    expect(mockStore.updateSettings).toHaveBeenCalledWith(partialSettings);
  });

  it('should delete conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    act(() => {
      result.current.deleteConversation('conv-to-delete');
    });

    expect(mockStore.deleteConversation).toHaveBeenCalledWith('conv-to-delete');
  });

  it('should clear messages', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    act(() => {
      result.current.clearMessages(mockConversationId);
    });

    expect(mockStore.clearMessages).toHaveBeenCalledWith(mockConversationId);
  });

  it('should use provided service over default', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    expect(result.current.isConfigured).toBe(true);
  });

  it('should handle 429 rate limit error for Gemini', async () => {
    mockStore.settings = {
      provider: 'gemini' as AIProviderType,
      model: 'gemini-2.0-flash-exp',
    };

    const geminiService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: geminiService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '⚠️ Limite de requisições do Gemini excedido (10 req/min). Aguarde 60s ou troque de modelo nas configurações.'
    );
  });

  it('should handle 429 rate limit error for other providers', async () => {
    mockStore.settings = {
      provider: 'openai' as AIProviderType,
      model: 'gpt-4o',
    };

    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('rate limit exceeded')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '⚠️ Taxa de requisições excedida no OpenAI. Aguarde alguns minutos.'
    );
  });

  it('should handle quota exceeded error', async () => {
    mockStore.settings = {
      provider: 'openai' as AIProviderType,
      model: 'gpt-4o',
    };

    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '⚠️ Limite de requisições excedido no OpenAI. Aguarde alguns minutos e tente novamente.'
    );
  });

  it('should handle unauthorized error', async () => {
    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('401 unauthorized')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '🔑 Chave API inválida para OpenAI. Verifique sua configuração.'
    );
  });

  it('should handle timeout error', async () => {
    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith('⏱️ Tempo limite excedido. Tente novamente.');
  });

  it('should handle network error', async () => {
    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('network error')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith('🌐 Erro de conexão. Verifique sua internet.');
  });

  it('should handle context length error', async () => {
    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('context_length exceeded')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '📏 Mensagem muito longa. Reduza o tamanho ou limpe o histórico.'
    );
  });

  it('should handle missing active conversation error', async () => {
    mockStore.getActiveConversation = vi.fn().mockReturnValue(null);

    const { result } = renderHook(() => useAI({ service: mockAIService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalled();
  });

  it('should handle analyzeChart error when no service', async () => {
    mockStore.settings = null;
    const { result } = renderHook(() => useAI());

    await act(async () => {
      const response = await result.current.analyzeChart({
        chartImage: 'data:image/png;base64,chart',
        candles: [],
      });
      expect(response).toBe(null);
    });

    expect(mockStore.setError).toHaveBeenCalledWith('AI service not configured');
  });

  it('should handle analyzeChart 429 error for Gemini', async () => {
    mockStore.settings = {
      provider: 'gemini' as AIProviderType,
      model: 'gemini-2.0-flash-exp',
    };

    const errorService = {
      ...mockAIService,
      analyzeChart: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.analyzeChart({
        chartImage: 'data:image/png;base64,chart',
        candles: [],
      });
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '⚠️ Limite de requisições do Gemini excedido (10 req/min). Aguarde 60s ou troque de modelo nas configurações.'
    );
  });

  it('should handle analyzeChartSilent error', async () => {
    const errorService = {
      ...mockAIService,
      analyzeChart: vi.fn().mockRejectedValue(new Error('API error')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      const response = await result.current.analyzeChartSilent({
        chartImage: 'data:image/png;base64,chart',
        candles: [],
      });
      expect(response).toBe(null);
    });

    expect(mockStore.setError).toHaveBeenCalled();
    expect(mockStore.setLoading).toHaveBeenCalledWith(false);
  });

  it('should handle Claude provider in error messages', async () => {
    mockStore.settings = {
      provider: 'anthropic' as AIProviderType,
      model: 'claude-sonnet-4-5-20250514',
    };

    const errorService = {
      ...mockAIService,
      sendMessage: vi.fn().mockRejectedValue(new Error('401 unauthorized')),
    } as unknown as AIService;

    const { result } = renderHook(() => useAI({ service: errorService }));

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(mockStore.setError).toHaveBeenCalledWith(
      '🔑 Chave API inválida para Claude. Verifique sua configuração.'
    );
  });

  it('should update conversation title', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    act(() => {
      result.current.updateConversationTitle(mockConversationId, 'New Title');
    });

    expect(mockStore.updateConversationTitle).toHaveBeenCalledWith(mockConversationId, 'New Title');
  });

  it('should export conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    act(() => {
      result.current.exportConversation(mockConversationId);
    });

    expect(mockStore.exportConversation).toHaveBeenCalledWith(mockConversationId);
  });

  it('should import conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));
    const conversationData = JSON.stringify({
      id: 'imported',
      title: 'Imported',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    act(() => {
      result.current.importConversation(conversationData);
    });

    expect(mockStore.importConversation).toHaveBeenCalledWith(conversationData);
  });

  it('should get active conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    expect(result.current.activeConversation).toBeDefined();
    expect(result.current.activeConversation?.id).toBe(mockConversationId);
  });

  it('should set active conversation', () => {
    const { result } = renderHook(() => useAI({ service: mockAIService }));

    act(() => {
      result.current.setActiveConversation('new-conv');
    });

    expect(mockStore.setActiveConversation).toHaveBeenCalledWith('new-conv');
  });
});
