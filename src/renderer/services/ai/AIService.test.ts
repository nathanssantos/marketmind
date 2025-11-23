import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from './AIService';

const mockSendMessage = vi.fn();
const mockAnalyzeChart = vi.fn();

vi.mock('./providers', () => {
  class MockAIProvider {
    sendMessage = mockSendMessage;
    analyzeChart = mockAnalyzeChart;
  }
  
  return {
    OpenAIProvider: MockAIProvider,
    ClaudeProvider: MockAIProvider,
    GeminiProvider: MockAIProvider,
  };
});

const mockSecureStorage = {
  getApiKey: vi.fn(),
  setApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  hasApiKey: vi.fn(),
  getAllApiKeys: vi.fn(),
  clearAllApiKeys: vi.fn(),
  isEncryptionAvailable: vi.fn(),
};

global.window = {
  electron: {
    secureStorage: mockSecureStorage,
  },
} as any;

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with openai provider', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      expect(service.getProviderType()).toBe('openai');
    });

    it('should create instance with anthropic provider', () => {
      const service = new AIService({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      expect(service.getProviderType()).toBe('anthropic');
    });

    it('should create instance with gemini provider', () => {
      const service = new AIService({
        provider: 'gemini',
        apiKey: 'test-key',
      });

      expect(service.getProviderType()).toBe('gemini');
    });

    it('should store config', () => {
      const config = {
        provider: 'openai' as const,
        apiKey: 'test-key',
        model: 'gpt-4o',
        temperature: 0.8,
        maxTokens: 2000,
      };

      const service = new AIService(config);
      const retrievedConfig = service.getConfig();

      expect(retrievedConfig).toEqual(config);
    });
  });

  describe('sendMessage', () => {
    it('should initialize provider and send message', async () => {
      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const expectedResponse: AIAnalysisResponse = {
        text: 'Hello! How can I help you?',
      };

      mockSendMessage.mockResolvedValue(expectedResponse);

      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const response = await service.sendMessage(messages);

      expect(response).toEqual(expectedResponse);
      expect(mockSendMessage).toHaveBeenCalledWith(messages, undefined);
    });

    it('should send message with images', async () => {
      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Analyze this', timestamp: Date.now() },
      ];
      const images = ['data:image/png;base64,abc123'];

      const expectedResponse: AIAnalysisResponse = {
        text: 'Analysis complete',
      };

      mockSendMessage.mockResolvedValue(expectedResponse);

      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const response = await service.sendMessage(messages, images);

      expect(response).toEqual(expectedResponse);
      expect(mockSendMessage).toHaveBeenCalledWith(messages, images);
    });

    it('should get API key from secure storage if not provided', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: true,
        apiKey: 'stored-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });

      const service = new AIService({
        provider: 'openai',
      });

      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).toHaveBeenCalledWith('openai');
    });

    it('should throw error if API key not found in secure storage', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: false,
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const service = new AIService({
        provider: 'openai',
      });

      await expect(service.sendMessage(messages)).rejects.toThrow(
        'API key not configured. Please set your API key in Settings.'
      );
    });

    it('should reuse cached API key on subsequent calls', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: true,
        apiKey: 'stored-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });

      const service = new AIService({
        provider: 'openai',
      });

      await service.sendMessage(messages);
      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyzeChart', () => {
    it('should analyze chart with request data', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [
          {
            timestamp: Date.now(),
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 1000,
          },
        ],
      };

      const expectedResponse: AIAnalysisResponse = {
        text: 'Chart analysis complete',
        signals: [{ signal: 'buy', confidence: 75 }],
        confidence: 75,
      };

      mockAnalyzeChart.mockResolvedValue(expectedResponse);

      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const response = await service.analyzeChart(request);

      expect(response).toEqual(expectedResponse);
      expect(mockAnalyzeChart).toHaveBeenCalledWith(request);
    });

    it('should initialize provider if not already initialized', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockAnalyzeChart.mockResolvedValue({ text: 'Analysis' });

      const service = new AIService({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      await service.analyzeChart(request);

      expect(mockAnalyzeChart).toHaveBeenCalled();
    });
  });

  describe('switchProvider', () => {
    it('should switch to new provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'openai-key',
      });

      await service.switchProvider({
        provider: 'anthropic',
        apiKey: 'anthropic-key',
      });

      expect(service.getProviderType()).toBe('anthropic');
    });

    it('should clear cached API key when switching provider', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: true,
        apiKey: 'stored-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });

      const service = new AIService({
        provider: 'openai',
      });

      await service.sendMessage(messages);

      mockSecureStorage.getApiKey.mockClear();
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: true,
        apiKey: 'new-stored-key',
      });

      await service.switchProvider({
        provider: 'anthropic',
      });

      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).toHaveBeenCalledWith('anthropic');
    });

    it('should update config when switching provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        temperature: 0.7,
      });

      await service.switchProvider({
        provider: 'gemini',
        apiKey: 'gemini-key',
        temperature: 0.9,
        maxTokens: 8000,
      });

      const config = service.getConfig();

      expect(config.provider).toBe('gemini');
      expect(config.temperature).toBe(0.9);
      expect(config.maxTokens).toBe(8000);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4096,
      });

      await service.updateConfig({
        temperature: 0.9,
      });

      const config = service.getConfig();

      expect(config.temperature).toBe(0.9);
      expect(config.provider).toBe('openai');
      expect(config.maxTokens).toBe(4096);
    });

    it('should clear API key cache when provider changes', async () => {
      mockSecureStorage.getApiKey.mockResolvedValueOnce({
        success: true,
        apiKey: 'openai-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });

      const service = new AIService({
        provider: 'openai',
      });

      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).toHaveBeenCalledWith('openai');

      mockSecureStorage.getApiKey.mockResolvedValueOnce({
        success: true,
        apiKey: 'gemini-key',
      });

      await service.updateConfig({ provider: 'gemini' });
      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).toHaveBeenCalledTimes(2);
      expect(mockSecureStorage.getApiKey).toHaveBeenNthCalledWith(2, 'gemini');
    });

    it('should not clear API key cache when provider stays the same', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue({
        success: true,
        apiKey: 'stored-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });

      const service = new AIService({
        provider: 'openai',
      });

      await service.sendMessage(messages);

      mockSecureStorage.getApiKey.mockClear();

      await service.updateConfig({ temperature: 0.9 });
      await service.sendMessage(messages);

      expect(mockSecureStorage.getApiKey).not.toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    it('should get provider type', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      expect(service.getProviderType()).toBe('openai');
    });

    it('should get config copy (not reference)', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        temperature: 0.7,
      });

      const config = service.getConfig();
      config.temperature = 1.0;

      expect(service.getConfig().temperature).toBe(0.7);
    });

    it('should get system prompt', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const prompt = service.getSystemPrompt();

      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('technical analyst');
    });

    it('should get chat system prompt', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const prompt = service.getChatSystemPrompt();

      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('AI assistant');
    });

    it('should get disclaimer', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const disclaimer = service.getDisclaimer();

      expect(disclaimer).toBeTruthy();
      expect(typeof disclaimer).toBe('string');
      expect(disclaimer).toContain('educational');
    });

    it('should get signal info', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const buySignal = service.getSignalInfo('buy');

      expect(buySignal).toBeTruthy();
      expect(buySignal.label).toBe('BUY');
      expect(buySignal.description).toBeTruthy();
      expect(buySignal.color).toBeTruthy();
    });

    it('should get all signal types', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const signals = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'] as const;

      signals.forEach(signal => {
        const info = service.getSignalInfo(signal);
        expect(info).toBeTruthy();
        expect(info.label).toBeTruthy();
        expect(info.description).toBeTruthy();
        expect(info.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('AI Studies control', () => {
    it('should pass enableAIStudies=true to provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        enableAIStudies: true,
      });

      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,test',
        candles: [],
      };

      mockAnalyzeChart.mockResolvedValue({
        text: 'Analysis with studies',
      });

      await service.analyzeChart(request);

      expect(mockAnalyzeChart).toHaveBeenCalled();
    });

    it('should pass enableAIStudies=false to provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        enableAIStudies: false,
      });

      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,test',
        candles: [],
      };

      mockAnalyzeChart.mockResolvedValue({
        text: 'Analysis without studies',
      });

      await service.analyzeChart(request);

      expect(mockAnalyzeChart).toHaveBeenCalled();
    });

    it('should update enableAIStudies dynamically', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        enableAIStudies: true,
      });

      service.setEnableAIStudies(false);
      
      expect(service.getConfig().enableAIStudies).toBe(false);
    });

    it('should update enableAIStudies on provider when set', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });
      await service.sendMessage(messages);

      service.setEnableAIStudies(true);

      expect(service.getConfig().enableAIStudies).toBe(true);
    });

    it('should default enableAIStudies to undefined', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      expect(service.getConfig().enableAIStudies).toBeUndefined();
    });
  });

  describe('Optimized prompts control', () => {
    it('should enable optimized prompts on provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });
      await service.sendMessage(messages);

      service.setOptimizedPrompts(true);

      expect(service.isUsingOptimizedPrompts()).toBe(true);
    });

    it('should disable optimized prompts on provider', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      mockSendMessage.mockResolvedValue({ text: 'Response' });
      await service.sendMessage(messages);

      service.setOptimizedPrompts(false);

      expect(service.isUsingOptimizedPrompts()).toBe(false);
    });

    it('should return true for optimized prompts when provider not initialized', () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      expect(service.isUsingOptimizedPrompts()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown provider type', async () => {
      const service = new AIService({
        provider: 'unknown' as any,
        apiKey: 'test-key',
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(service.sendMessage(messages)).rejects.toThrow('Unknown provider type');
    });

    it('should throw error if provider not initialized', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      mockSendMessage.mockImplementation(() => {
        throw new Error('Provider error');
      });

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(service.sendMessage(messages)).rejects.toThrow('Provider error');
    });

    it('should throw error if sendMessage called but provider fails to initialize', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      vi.spyOn(service as any, 'initializeProvider').mockResolvedValue(undefined);
      (service as any).provider = null;

      const messages: AIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(service.sendMessage(messages)).rejects.toThrow('AI provider not initialized');
    });

    it('should throw error if analyzeChart called but provider fails to initialize', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
      });

      vi.spyOn(service as any, 'initializeProvider').mockResolvedValue(undefined);
      (service as any).provider = null;

      const request: AIAnalysisRequest = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        candles: [],
      };

      await expect(service.analyzeChart(request)).rejects.toThrow('AI provider not initialized');
    });
  });
});
