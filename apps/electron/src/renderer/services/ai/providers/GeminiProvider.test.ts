import type { AIAnalysisRequest, AIMessage } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './GeminiProvider';

const mockGenerateContent = vi.fn();
const mockStartChat = vi.fn();
const mockSendMessage = vi.fn();
const mockGetGenerativeModel = vi.fn();

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class GoogleGenerativeAI {
      constructor(_apiKey: string) {}
      
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

describe('GeminiProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetGenerativeModel.mockReturnValue({
      startChat: mockStartChat,
      generateContent: mockGenerateContent,
    });

    mockStartChat.mockReturnValue({
      sendMessage: mockSendMessage,
    });
  });

  describe('constructor', () => {
    it('should create instance with default model', () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
    });

    it('should create instance with custom config', () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.9,
        maxTokens: 8000,
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is a shooting star pattern?',
          openTime: Date.now(),
        },
      ];

      mockSendMessage.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'A shooting star is a bearish reversal pattern...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response).toEqual({
        text: 'A shooting star is a bearish reversal pattern...',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        systemInstruction: expect.any(String),
      });

      expect(mockStartChat).toHaveBeenCalledWith({ history: [] });

      expect(mockSendMessage).toHaveBeenCalledWith([
        { text: 'What is a shooting star pattern?' },
      ]);
    });

    it('should send message with conversation history', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is Fibonacci retracement?',
          openTime: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Fibonacci retracement is a technical analysis tool...',
          openTime: Date.now(),
        },
        {
          id: '3',
          role: 'user',
          content: 'What are the key levels?',
          openTime: Date.now(),
        },
      ];

      mockSendMessage.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Key Fibonacci levels are 23.6%, 38.2%, 50%, 61.8%, and 100%.',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages);

      expect(response.text).toBe('Key Fibonacci levels are 23.6%, 38.2%, 50%, 61.8%, and 100%.');

      expect(mockStartChat).toHaveBeenCalledWith({
        history: [
          {
            role: 'user',
            parts: [{ text: 'What is Fibonacci retracement?' }],
          },
          {
            role: 'model',
            parts: [{ text: 'Fibonacci retracement is a technical analysis tool...' }],
          },
        ],
      });

      expect(mockSendMessage).toHaveBeenCalledWith([
        { text: 'What are the key levels?' },
      ]);
    });

    it('should send message with images', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Analyze this chart',
          openTime: Date.now(),
        },
      ];

      const images = ['data:image/png;base64,abc123'];

      mockSendMessage.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'The chart shows a clear downtrend...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      const response = await provider.sendMessage(messages, images);

      expect(response.text).toBe('The chart shows a clear downtrend...');

      expect(mockSendMessage).toHaveBeenCalledWith([
        { text: 'Analyze this chart' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'abc123',
          },
        },
      ]);
    });

    it('should send message with multiple images', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Compare these charts',
          openTime: Date.now(),
        },
      ];

      const images = [
        'data:image/png;base64,img1',
        'data:image/png;base64,img2',
      ];

      mockSendMessage.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Comparative analysis...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await provider.sendMessage(messages, images);

      expect(mockSendMessage).toHaveBeenCalledWith([
        { text: 'Compare these charts' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'img1',
          },
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'img2',
          },
        },
      ]);
    });

    it('should use custom model and temperature', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          openTime: Date.now(),
        },
      ];

      mockSendMessage.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Hi!',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.5,
        maxTokens: 2000,
      });

      await provider.sendMessage(messages);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2000,
        },
        systemInstruction: expect.any(String),
      });
    });

    it('should handle API errors', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          openTime: Date.now(),
        },
      ];

      mockSendMessage.mockRejectedValue(new Error('API quota exceeded'));

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow(
        'Gemini API error: API quota exceeded'
      );
    });

    it('should handle non-Error rejections', async () => {
      const messages: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          openTime: Date.now(),
        },
      ];

      mockSendMessage.mockRejectedValue('String error');

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow('String error');
    });

    it('should throw error when no messages provided', async () => {
      const messages: AIMessage[] = [];

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await expect(provider.sendMessage(messages)).rejects.toThrow('No messages provided');
    });
  });

  describe('analyzeChart', () => {
    it('should analyze chart successfully', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,chartdata',
        klines: [
          {
            openTime: Date.now(),
            closeTime: Date.now() + 3600000,
            open: '100',
            high: '110',
            low: '95',
            close: '105',
            volume: '1000',
            quoteVolume: '105000',
            trades: 100,
            takerBuyBaseVolume: '500',
            takerBuyQuoteVolume: '52500',
          },
        ],
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Technical analysis: Bullish continuation pattern identified.',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      const response = await provider.analyzeChart(request);

      expect(response.text).toBe('Technical analysis: Bullish continuation pattern identified.');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: expect.any(String) }),
          expect.objectContaining({
            inlineData: expect.objectContaining({
              mimeType: 'image/png',
              data: 'chartdata',
            }),
          }),
        ])
      );
    });

    it('should include context in analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        klines: [],
        context: 'SOL/USD daily chart with support at 100',
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Context-aware analysis...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockGenerateContent.mock.calls[0]?.[0];
      const textParts = call.filter((p: { text?: string }) => p.text);
      const combinedText = textParts.map((p: { text: string }) => p.text).join(' ');
      
      expect(combinedText).toContain('SOL/USD daily chart with support at 100');
    });

    it('should include latest kline data', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        klines: [
          {
            openTime: Date.now(),
            closeTime: Date.now() + 86400000,
            open: '42000',
            high: '43000',
            low: '41500',
            close: '42500',
            volume: '5000000',
            quoteVolume: '212500000000',
            trades: 5000,
            takerBuyBaseVolume: '2500000',
            takerBuyQuoteVolume: '106250000000',
          },
        ],
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Price data analysis...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockGenerateContent.mock.calls[0]?.[0];
      const textParts = call.filter((p: { text?: string }) => p.text);
      const combinedText = textParts.map((p: { text: string }) => p.text).join(' ');
      
      expect(combinedText).toContain('42000.00');
      expect(combinedText).toContain('43000.00');
      expect(combinedText).toContain('41500.00');
      expect(combinedText).toContain('42500.00');
    });

    it('should include news items', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        klines: [],
        news: [
          {
            id: '1',
            title: 'Bitcoin ETF approved',
            description: 'SEC approves spot Bitcoin ETF',
            url: 'https://example.com/news/1',
            source: 'Reuters',
            publishedAt: Date.now(),
            sentiment: 'positive',
          },
        ],
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'News-based analysis...',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockGenerateContent.mock.calls[0]?.[0];
      const textParts = call.filter((p: { text?: string }) => p.text);
      const combinedText = textParts.map((p: { text: string }) => p.text).join(' ');
      
      expect(combinedText).toContain('Bitcoin ETF approved');
      expect(combinedText).toContain('Reuters');
    });

    it('should use custom configuration for chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        klines: [],
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Analysis',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.3,
        maxTokens: 8192,
      });

      await provider.analyzeChart(request);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      });
    });

    it('should handle API errors during chart analysis', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/png;base64,xyz',
        klines: [],
      };

      mockGenerateContent.mockRejectedValue(new Error('Invalid request format'));

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await expect(provider.analyzeChart(request)).rejects.toThrow(
        'Gemini API error: Invalid request format'
      );
    });

    it('should convert image data URL to base64', async () => {
      const request: AIAnalysisRequest = {
        chartImage: 'data:image/jpeg;base64,jpegdata123',
        klines: [],
      };

      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => 'Analysis',
        }),
      });

      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });

      await provider.analyzeChart(request);

      const call = mockGenerateContent.mock.calls[0]?.[0];
      const imagePart = call.find((p: { inlineData?: { data: string } }) => p.inlineData);
      
      expect(imagePart?.inlineData?.data).toBe('jpegdata123');
      expect(imagePart?.inlineData?.mimeType).toBe('image/png');
    });
  });
});
