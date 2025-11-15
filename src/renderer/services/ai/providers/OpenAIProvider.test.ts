import type { AIAnalysisRequest, AIMessage } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      
      constructor(config: { apiKey: string; dangerouslyAllowBrowser: boolean }) {
        expect(config.dangerouslyAllowBrowser).toBe(true);
      }
    },
  };
});

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default model', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create instance with custom config', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
        temperature: 0.9,
        maxTokens: 2000,
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is a doji candlestick?',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'A doji is a candlestick pattern...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response).toEqual({
        text: 'A doji is a candlestick pattern...',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'What is a doji candlestick?',
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });
    });

    it('should send message with multiple conversation turns', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is RSI?',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'RSI is a momentum indicator...',
          timestamp: Date.now(),
        },
        {
          id: '3',
          role: 'user',
          content: 'What values indicate overbought?',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'RSI above 70 indicates overbought conditions.',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response.text).toBe('RSI above 70 indicates overbought conditions.');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'What is RSI?' },
            { role: 'assistant', content: 'RSI is a momentum indicator...' },
            { role: 'user', content: 'What values indicate overbought?' },
          ],
        })
      );
    });

    it('should send message with images', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Analyze this chart',
          timestamp: Date.now(),
        },
      ];

      const images = ['data:image/png;base64,abc123'];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'The chart shows a bullish trend...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages, images);

      expect(response.text).toBe('The chart shows a bullish trend...');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this chart' },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,abc123',
                    detail: 'high',
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it('should send message with multiple images', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Compare these charts',
          timestamp: Date.now(),
        },
      ];

      const images = [
        'data:image/png;base64,abc123',
        'data:image/png;base64,def456',
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Chart comparison analysis...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await provider.sendMessage(messages, images);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Compare these charts' },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,abc123',
                    detail: 'high',
                  },
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,def456',
                    detail: 'high',
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it('should use custom model and temperature', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hi!' } }],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
        temperature: 0.5,
        maxTokens: 1000,
      });

      await provider.sendMessage(messages);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4-turbo',
        messages: expect.any(Array),
        temperature: 0.5,
        max_tokens: 1000,
      });
    });

    it('should handle empty response', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response.text).toBe('');
    });

    it('should handle API errors', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow(
        'Failed to get AI response: API rate limit exceeded'
      );
    });

    it('should handle non-Error rejections', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockRejectedValue('String error');

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow(
        'Failed to get AI response: Unknown error'
      );
    });
  });

  describe('analyzeChart', () => {
    it('should analyze chart successfully', async () => {
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

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Chart analysis: Bullish trend confirmed.',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.text).toBe('Chart analysis: Bullish trend confirmed.');

      const call = mockCreate.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.messages).toHaveLength(2);
      expect(call.messages[0].role).toBe('system');
      expect(call.messages[1].role).toBe('user');
      expect(call.messages[1].content).toBeInstanceOf(Array);
    });

    it('should include context in analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
        context: 'Bitcoin 1-hour chart showing recent breakout',
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Analysis with context...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[1];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('Bitcoin 1-hour chart showing recent breakout');
    });

    it('should include latest candle data', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [
          {
            timestamp: Date.now(),
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
            volume: 1234567,
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Price analysis...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[1];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('50000.00');
      expect(textContent?.text).toContain('51000.00');
      expect(textContent?.text).toContain('49500.00');
      expect(textContent?.text).toContain('50500.00');
    });

    it('should include news items', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
        news: [
          {
            id: '1',
            title: 'Bitcoin hits new high',
            description: 'Bitcoin reaches all-time high',
            url: 'https://example.com/news/1',
            source: 'CryptoNews',
            publishedAt: Date.now(),
            sentiment: 'positive',
          },
          {
            id: '2',
            title: 'Market volatility increases',
            description: 'Trading volumes surge amid volatility',
            url: 'https://example.com/news/2',
            source: 'FinanceDaily',
            publishedAt: Date.now(),
            sentiment: 'neutral',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'News-based analysis...',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[1];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('Bitcoin hits new high');
      expect(textContent?.text).toContain('CryptoNews');
    });

    it('should parse signal from response', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Analysis text\n**Current Signal**: BUY\n**Confidence**: 75%',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.confidence).toBe(75);
      expect(response.signals).toEqual([
        {
          signal: 'buy',
          confidence: 75,
        },
      ]);
    });

    it('should parse STRONG_BUY signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '**Current Signal**: STRONG BUY\n**Confidence**: 90',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.signals?.[0]?.signal).toBe('strong_buy');
      expect(response.confidence).toBe(90);
    });

    it('should parse SELL signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '**Current Signal**: SELL\n**Confidence**: 60',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.signals?.[0]?.signal).toBe('sell');
      expect(response.confidence).toBe(60);
    });

    it('should parse HOLD signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '**Current Signal**: HOLD\n**Confidence**: 50',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.signals?.[0]?.signal).toBe('hold');
      expect(response.confidence).toBe(50);
    });

    it('should handle response without signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Chart analysis without signal markers.',
            },
          },
        ],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.text).toBe('Chart analysis without signal markers.');
      expect(response.confidence).toBeUndefined();
      expect(response.signals).toBeUndefined();
    });

    it('should handle API errors during chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockRejectedValue(new Error('Invalid image format'));

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      });

      await expect(provider.analyzeChart(request)).rejects.toThrow(
        'Failed to analyze chart: Invalid image format'
      );
    });

    it('should use custom configuration for chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz789',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Analysis' } }],
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4-vision-preview',
        temperature: 0.3,
        maxTokens: 2048,
      });

      await provider.analyzeChart(request);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4-vision-preview',
        messages: expect.any(Array),
        temperature: 0.3,
        max_tokens: 2048,
      });
    });
  });
});
