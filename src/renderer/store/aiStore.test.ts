import { AIService } from '@/renderer/services/ai';
import type { AIProviderType, Candle } from '@shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartData } from './aiStore';
import { useAIStore } from './aiStore';

vi.mock('@/renderer/services/ai');

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.setState({
      conversations: [],
      activeConversationId: null,
      settings: null,
      isLoading: false,
      error: null,
      lastAnalysis: null,
      messages: [],
      provider: null,
      model: null,
      responseProcessor: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Settings Management', () => {
    it('should set AI settings', () => {
      const settings = {
        provider: 'openai' as AIProviderType,
        model: 'gpt-4o',
        temperature: 0.7,
      };

      useAIStore.getState().setSettings(settings);

      const state = useAIStore.getState();
      expect(state.settings).toEqual(settings);
      expect(state.provider).toBe('openai');
      expect(state.model).toBe('gpt-4o');
    });

    it('should update settings partially', () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      useAIStore.getState().updateSettings({ temperature: 0.5 });

      const state = useAIStore.getState();
      expect(state.settings?.temperature).toBe(0.5);
      expect(state.settings?.provider).toBe('openai');
    });

    it('should use default model when changing provider without specifying model', () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      useAIStore.getState().updateSettings({ provider: 'anthropic' });

      const state = useAIStore.getState();
      expect(state.settings?.provider).toBe('anthropic');
      expect(state.settings?.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should clear settings', () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      useAIStore.getState().clearSettings();

      const state = useAIStore.getState();
      expect(state.settings).toBeNull();
      expect(state.provider).toBeNull();
      expect(state.model).toBeNull();
    });
  });

  describe('Conversation Management', () => {
    it('should create a new conversation', () => {
      const id = useAIStore.getState().createConversation('Test Conversation');

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0]?.title).toBe('Test Conversation');
      expect(state.activeConversationId).toBe(id);
    });

    it('should create conversation with default title', () => {
      const id = useAIStore.getState().createConversation();

      const state = useAIStore.getState();
      expect(state.conversations[0]?.title).toBe('New Conversation');
    });

    it('should delete conversation', () => {
      const id = useAIStore.getState().createConversation('Test');
      useAIStore.getState().deleteConversation(id);

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(0);
      expect(state.activeConversationId).toBeNull();
    });

    it('should set active conversation', () => {
      const id = useAIStore.getState().createConversation('Test');
      useAIStore.getState().setActiveConversation(null);

      expect(useAIStore.getState().activeConversationId).toBeNull();

      useAIStore.getState().setActiveConversation(id);

      expect(useAIStore.getState().activeConversationId).toBe(id);
    });

    it('should update conversation title', () => {
      const id = useAIStore.getState().createConversation('Old Title');
      useAIStore.getState().updateConversationTitle(id, 'New Title');

      const state = useAIStore.getState();
      expect(state.conversations[0]?.title).toBe('New Title');
    });

    it('should get active conversation', () => {
      const id = useAIStore.getState().createConversation('Test');

      const conversation = useAIStore.getState().getActiveConversation();

      expect(conversation).toBeTruthy();
      expect(conversation?.id).toBe(id);
    });

    it('should return null for non-existent active conversation', () => {
      const conversation = useAIStore.getState().getActiveConversation();

      expect(conversation).toBeNull();
    });
  });

  describe('Message Management', () => {
    it('should add message to conversation', () => {
      const id = useAIStore.getState().createConversation('Test');

      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: 'Hello',
      });

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages).toHaveLength(1);
      expect(state.conversations[0]?.messages[0]?.content).toBe('Hello');
      expect(state.conversations[0]?.messages[0]?.id).toBeDefined();
      expect(state.conversations[0]?.messages[0]?.timestamp).toBeDefined();
    });

    it('should update conversation title based on first user message', () => {
      const id = useAIStore.getState().createConversation();

      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: 'What is the meaning of life?',
      });

      const state = useAIStore.getState();
      expect(state.conversations[0]?.title).toBe('What is the meaning of life?');
    });

    it('should truncate long titles', () => {
      useAIStore.getState().createConversation();
      const longMessage = 'a'.repeat(100);
      const id = useAIStore.getState().conversations[0]?.id!;

      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: longMessage,
      });

      const state = useAIStore.getState();
      expect(state.conversations[0]?.title).toHaveLength(53); // 50 chars + "..."
      expect(state.conversations[0]?.title).toContain('...');
    });

    it('should limit messages per conversation', () => {
      const id = useAIStore.getState().createConversation('Test');

      for (let i = 0; i < 150; i++) {
        useAIStore.getState().addMessage(id, {
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages.length).toBeLessThanOrEqual(100);
    });

    it('should update message content', () => {
      const id = useAIStore.getState().createConversation('Test');

      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: 'Original',
      });

      const messageId = useAIStore.getState().conversations[0]?.messages[0]?.id!;

      useAIStore.getState().updateMessage(id, messageId, 'Updated');

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages[0]?.content).toBe('Updated');
    });

    it('should delete message', () => {
      const id = useAIStore.getState().createConversation('Test');

      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: 'Message 1',
      });
      useAIStore.getState().addMessage(id, {
        role: 'user',
        content: 'Message 2',
      });

      const messageId = useAIStore.getState().conversations[0]?.messages[0]?.id!;

      useAIStore.getState().deleteMessage(id, messageId);

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages).toHaveLength(1);
      expect(state.conversations[0]?.messages[0]?.content).toBe('Message 2');
    });

    it('should clear all messages in conversation', () => {
      const id = useAIStore.getState().createConversation('Test');

      useAIStore.getState().addMessage(id, { role: 'user', content: 'Message 1' });
      useAIStore.getState().addMessage(id, { role: 'user', content: 'Message 2' });

      useAIStore.getState().clearMessages(id);

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages).toHaveLength(0);
      expect(state.conversations[0]?.title).toBe('New Conversation');
    });

    it('should get conversation messages', () => {
      const id = useAIStore.getState().createConversation('Test');

      useAIStore.getState().addMessage(id, { role: 'user', content: 'Message 1' });
      useAIStore.getState().addMessage(id, { role: 'user', content: 'Message 2' });

      const messages = useAIStore.getState().getConversationMessages(id);

      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('Message 1');
    });
  });

  describe('State Management', () => {
    it('should set loading state', () => {
      useAIStore.getState().setLoading(true);
      expect(useAIStore.getState().isLoading).toBe(true);

      useAIStore.getState().setLoading(false);
      expect(useAIStore.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      useAIStore.getState().setError('Test error');
      expect(useAIStore.getState().error).toBe('Test error');

      useAIStore.getState().setError(null);
      expect(useAIStore.getState().error).toBeNull();
    });

    it('should set last analysis', () => {
      const analysis = {
        text: 'Analysis result',
        model: 'gpt-4o',
        tokensUsed: 100,
      };

      useAIStore.getState().setLastAnalysis(analysis);
      expect(useAIStore.getState().lastAnalysis).toEqual(analysis);
    });

    it('should set response processor', () => {
      const processor = (response: string) => response.toUpperCase();

      useAIStore.getState().setResponseProcessor(processor);
      expect(useAIStore.getState().responseProcessor).toBe(processor);
    });
  });

  describe('Import/Export', () => {
    it('should export conversation', () => {
      const id = useAIStore.getState().createConversation();
      useAIStore.getState().addMessage(id, { role: 'user', content: 'Hello' });

      const exported = useAIStore.getState().exportConversation(id);
      const parsed = JSON.parse(exported);

      expect(parsed.title).toBe('Hello');
      expect(parsed.messages).toHaveLength(1);
    });

    it('should throw error when exporting non-existent conversation', () => {
      expect(() => {
        useAIStore.getState().exportConversation('non-existent');
      }).toThrow('Conversation not found');
    });

    it('should import conversation', () => {
      const id = useAIStore.getState().createConversation('Original');
      useAIStore.getState().addMessage(id, { role: 'user', content: 'Hello' });

      const exported = useAIStore.getState().exportConversation(id);

      useAIStore.setState({ conversations: [], activeConversationId: null });

      useAIStore.getState().importConversation(exported);

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0]?.title).toContain('(Imported)');
      expect(state.conversations[0]?.messages).toHaveLength(1);
    });

    it('should throw error when importing invalid data', () => {
      expect(() => {
        useAIStore.getState().importConversation('invalid json');
      }).toThrow('Invalid conversation data');
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      vi.mocked(AIService.prototype.sendMessage).mockResolvedValue({
        text: 'AI Response',
      });
    });

    it('should send message and add response', async () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      await useAIStore.getState().sendMessage('Hello');

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0]?.messages).toHaveLength(2);
      expect(state.conversations[0]?.messages[0]?.role).toBe('user');
      expect(state.conversations[0]?.messages[0]?.content).toBe('Hello');
      expect(state.conversations[0]?.messages[1]?.role).toBe('assistant');
      expect(state.conversations[0]?.messages[1]?.content).toBe('AI Response');
    });

    it('should set error when settings not configured', async () => {
      await useAIStore.getState().sendMessage('Hello');

      const state = useAIStore.getState();
      expect(state.error).toBe('Please configure AI settings first');
    });

    it('should create conversation if none active', async () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      await useAIStore.getState().sendMessage('Hello');

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.activeConversationId).toBeDefined();
    });

    it('should process response with custom processor', async () => {
      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      useAIStore.getState().setResponseProcessor((response) => response.toUpperCase());

      await useAIStore.getState().sendMessage('Hello');

      const state = useAIStore.getState();
      expect(state.conversations[0]?.messages[1]?.content).toBe('AI RESPONSE');
    });

    it('should handle API errors', async () => {
      vi.mocked(AIService.prototype.sendMessage).mockRejectedValue(
        new Error('API Error: 429 Too Many Requests')
      );

      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      await useAIStore.getState().sendMessage('Hello');

      const state = useAIStore.getState();
      expect(state.error).toContain('⚠️');
      expect(state.isLoading).toBe(false);
    });

    it('should include chart data in API call but not in stored message', async () => {
      const chartData: ChartData = {
        candles: [
          {
            timestamp: Date.now(),
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            volume: 1000,
          } as Candle,
        ],
        symbol: 'BTCUSDT',
        timeframe: '1h',
        chartType: 'candlestick',
        showVolume: true,
        movingAverages: [],
      };

      useAIStore.getState().setSettings({
        provider: 'openai',
        model: 'gpt-4o',
      });

      await useAIStore.getState().sendMessage('Analyze', chartData);

      const state = useAIStore.getState();
      const userMessage = state.conversations[0]?.messages[0];

      expect(userMessage?.content).toBe('Analyze');
      expect(userMessage?.content).not.toContain('CHART DATA');

      expect(vi.mocked(AIService.prototype.sendMessage)).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('CHART DATA'),
          }),
        ])
      );
    });
  });

  describe('clearAll', () => {
    it('should clear all state', () => {
      useAIStore.getState().createConversation('Test');
      useAIStore.getState().setSettings({ provider: 'openai' });
      useAIStore.getState().setLoading(true);
      useAIStore.getState().setError('Error');

      useAIStore.getState().clearAll();

      const state = useAIStore.getState();
      expect(state.conversations).toHaveLength(0);
      expect(state.activeConversationId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastAnalysis).toBeNull();
      expect(state.messages).toHaveLength(0);
    });
  });
});
