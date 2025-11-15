import type { AIAnalysisRequest, AIMessage } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeProvider } from './ClaudeProvider';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = {
        create: mockCreate,
      };
      
      constructor(config: { apiKey: string; dangerouslyAllowBrowser: boolean }) {
        expect(config.dangerouslyAllowBrowser).toBe(true);
      }
    },
  };
});

describe('ClaudeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default model', () => {
      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(ClaudeProvider);
    });

    it('should create instance with custom config', () => {
      const provider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
        temperature: 0.9,
        maxTokens: 8000,
      });

      expect(provider).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is a hammer candlestick?',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'A hammer is a bullish reversal pattern...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response).toEqual({
        text: 'A hammer is a bullish reversal pattern...',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: 'What is a hammer candlestick?',
          },
        ],
        system: 'What is a hammer candlestick?',
      });
    });

    it('should send message with multiple conversation turns', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is MACD?',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'MACD is a trend-following momentum indicator...',
          timestamp: Date.now(),
        },
        {
          id: '3',
          role: 'user',
          content: 'How do I interpret it?',
          timestamp: Date.now(),
        },
      ];

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'MACD crossovers signal trend changes...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response.text).toBe('MACD crossovers signal trend changes...');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'What is MACD?' },
            { role: 'assistant', content: 'MACD is a trend-following momentum indicator...' },
            { role: 'user', content: 'How do I interpret it?' },
          ],
        })
      );
    });

    it('should send message with images', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Analyze this pattern',
          timestamp: Date.now(),
        },
      ];

      const images = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='];

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This shows a bullish engulfing pattern...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages, images);

      expect(response.text).toBe('This shows a bullish engulfing pattern...');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this pattern' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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
          content: 'Compare these patterns',
          timestamp: Date.now(),
        },
      ];

      const images = [
        'data:image/png;base64,abc123',
        'data:image/png;base64,def456',
      ];

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Pattern comparison analysis...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await provider.sendMessage(messages, images);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Compare these patterns' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'abc123',
                  },
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'def456',
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
        content: [{ type: 'text', text: 'Hi there!' }],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
        temperature: 0.5,
        maxTokens: 2000,
      });

      await provider.sendMessage(messages);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-opus-4-20250514',
        max_tokens: 2000,
        temperature: 0.5,
        messages: expect.any(Array),
        system: expect.any(String),
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
        content: [],
      });

      const provider = new ClaudeProvider({
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

      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow(
        'Failed to get AI response: Rate limit exceeded'
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

      const provider = new ClaudeProvider({
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
        chartImage: 'data:image/png;base64,chartdata123',
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
        content: [
          {
            type: 'text',
            text: 'Technical analysis: Strong upward momentum detected.',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.text).toBe('Technical analysis: Strong upward momentum detected.');

      const call = mockCreate.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0].role).toBe('user');
      expect(Array.isArray(call.messages[0].content)).toBe(true);
    });

    it('should include context in analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
        context: 'Ethereum 4-hour chart showing potential reversal',
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Context-aware analysis...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      expect(call.system).toBeTruthy();
      
      const userMessage = call?.messages[0];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('Ethereum 4-hour chart showing potential reversal');
    });

    it('should include latest candle data', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [
          {
            timestamp: Date.now(),
            open: 3000,
            high: 3100,
            low: 2950,
            close: 3050,
            volume: 987654,
          },
        ],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Price analysis...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[0];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('3000.00');
      expect(textContent?.text).toContain('3100.00');
      expect(textContent?.text).toContain('2950.00');
      expect(textContent?.text).toContain('3050.00');
    });

    it('should include news items', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
        news: [
          {
            id: '1',
            title: 'Ethereum upgrade announced',
            description: 'Major network upgrade coming soon',
            url: 'https://example.com/news/1',
            source: 'CryptoTimes',
            publishedAt: Date.now(),
            sentiment: 'positive',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'News-influenced analysis...',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[0];
      const textContent = userMessage?.content.find((c: { type: string }) => c.type === 'text');
      
      expect(textContent?.text).toContain('Ethereum upgrade announced');
      expect(textContent?.text).toContain('CryptoTimes');
    });

    it('should parse BUY signal from response', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Analysis text\n**Current Signal**: BUY\n**Confidence**: 80%',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.confidence).toBe(80);
      expect(response.signals).toEqual([
        {
          signal: 'buy',
          confidence: 80,
        },
      ]);
    });

    it('should parse STRONG_SELL signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '**Current Signal**: STRONG SELL\n**Confidence**: 85',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.signals?.[0]?.signal).toBe('strong_sell');
      expect(response.confidence).toBe(85);
    });

    it('should parse HOLD signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '**Current Signal**: HOLD\n**Confidence**: 55',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.signals?.[0]?.signal).toBe('hold');
      expect(response.confidence).toBe(55);
    });

    it('should handle response without signal', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'General market analysis without specific signals.',
          },
        ],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.text).toBe('General market analysis without specific signals.');
      expect(response.confidence).toBeUndefined();
      expect(response.signals).toBeUndefined();
    });

    it('should handle API errors during chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockRejectedValue(new Error('Image too large'));

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await expect(provider.analyzeChart(request)).rejects.toThrow(
        'Failed to analyze chart: Image too large'
      );
    });

    it('should use custom configuration for chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Analysis' }],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
        temperature: 0.3,
        maxTokens: 8192,
      });

      await provider.analyzeChart(request);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-opus-4-20250514',
        max_tokens: 8192,
        temperature: 0.3,
        messages: expect.any(Array),
        system: expect.any(String),
      });
    });

    it('should convert image URLs to base64 format', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,rawImageData',
        candles: [],
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Analysis' }],
      });

      const provider = new ClaudeProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockCreate.mock.calls[0]?.[0];
      const userMessage = call?.messages[0];
      const imageContent = userMessage?.content.find((c: { type: string }) => c.type === 'image');
      
      expect(imageContent?.source?.data).toBe('rawImageData');
      expect(imageContent?.source?.type).toBe('base64');
      expect(imageContent?.source?.media_type).toBe('image/png');
    });
  });
});
