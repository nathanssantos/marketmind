import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@shared/types';
import { formatCandlesForPrompt, optimizeCandles } from '../../utils/candleOptimizer';
import { buildOptimizedMessages } from '../../utils/conversationSummarizer';
import { detectIntentFromConversation, getSystemPrompt as getOptimizedSystemPrompt } from '../../utils/intentDetection';
import optimizedPrompts from './prompts-optimized.json';
import prompts from './prompts.json';

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedCandlesCount?: number;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ChatCompletionOptions {
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;
  protected temperature: number;
  protected maxTokens: number;
  protected useOptimizedPrompts: boolean;
  public enableAIStudies: boolean;
  protected detailedCandlesCount: number;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.getDefaultModel();
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.useOptimizedPrompts = true;
    this.enableAIStudies = true;
    this.detailedCandlesCount = config.detailedCandlesCount ?? 32;
  }

  protected abstract getDefaultModel(): string;

  abstract sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse>;

  abstract analyzeChart(
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResponse>;

  protected convertMessages(messages: AIMessage[]): ChatCompletionMessage[] {
    if (!this.useOptimizedPrompts) {
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
    }
    
    const optimizedMessages = buildOptimizedMessages(messages, false);
    return optimizedMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  protected buildChartAnalysisMessages(
    request: AIAnalysisRequest
  ): ChatCompletionMessage[] {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);

    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    const content: MessageContent[] = [
      {
        type: 'text',
        text: userPrompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: request.chartImage,
          detail: 'high',
        },
      },
    ];

    messages.push({
      role: 'user',
      content,
    });

    return messages;
  }

  protected getSystemPrompt(messages?: AIMessage[]): string {
    if (!this.useOptimizedPrompts) {
      return prompts.chartAnalysis.system;
    }
    
    if (!this.enableAIStudies) {
      return getOptimizedSystemPrompt('simple', 'chartAnalysis');
    }
    
    const mode = messages && messages.length > 0 
      ? detectIntentFromConversation(messages)
      : 'full';
    
    return getOptimizedSystemPrompt(mode, 'chartAnalysis');
  }

  protected buildUserPrompt(request: AIAnalysisRequest): string {
    if (!this.useOptimizedPrompts) {
      const parts: string[] = [
        prompts.chartAnalysis.userTemplate,
      ];

      if (request.context) {
        parts.push(prompts.chartAnalysis.contextTemplate.replace('{context}', request.context));
      }

      if (request.candles && request.candles.length > 0) {
        const latestCandle = request.candles[request.candles.length - 1];
        if (latestCandle) {
          const priceData = prompts.chartAnalysis.priceDataTemplate
            .replace('{open}', latestCandle.open.toFixed(2))
            .replace('{high}', latestCandle.high.toFixed(2))
            .replace('{low}', latestCandle.low.toFixed(2))
            .replace('{close}', latestCandle.close.toFixed(2))
            .replace('{volume}', latestCandle.volume.toLocaleString());
          parts.push(priceData);
        }
      }

      if (request.news && request.news.length > 0) {
        const newsItems = request.news.slice(0, 5)
          .map((article, i) => `${i + 1}. ${article.title} (${article.source})`)
          .join('\n');
        parts.push(prompts.chartAnalysis.newsTemplate.replace('{newsItems}', newsItems));
      }

      return parts.join('\n');
    }
    
    const parts: string[] = [
      optimizedPrompts.chartAnalysis.userTemplate,
    ];

    if (request.context) {
      parts.push(optimizedPrompts.chartAnalysis.contextTemplate.replace('{context}', request.context));
    }

    if (request.candles && request.candles.length > 0) {
      const optimized = optimizeCandles(request.candles, this.detailedCandlesCount);
      
      const timestampInfo = optimizedPrompts.chartAnalysis.timestampInfoTemplate
        .replace('{firstTimestamp}', optimized.timestampInfo.first.toString())
        .replace('{lastTimestamp}', optimized.timestampInfo.last.toString())
        .replace('{totalCandles}', optimized.timestampInfo.total.toString())
        .replace('{timeframe}', optimized.timestampInfo.timeframe);
      parts.push(timestampInfo);
      
      const candleData = formatCandlesForPrompt(optimized);
      parts.push(`\n\nCANDLE DATA:\n${candleData}`);
      
      const latestCandle = request.candles[request.candles.length - 1];
      if (latestCandle) {
        const priceData = optimizedPrompts.chartAnalysis.priceDataTemplate
          .replace('{open}', latestCandle.open.toFixed(2))
          .replace('{high}', latestCandle.high.toFixed(2))
          .replace('{low}', latestCandle.low.toFixed(2))
          .replace('{close}', latestCandle.close.toFixed(2))
          .replace('{volume}', latestCandle.volume.toLocaleString());
        parts.push(priceData);
      }
    }

    if (request.news && request.news.length > 0) {
      const newsItems = request.news.slice(0, 5)
        .map((article, i) => `${i + 1}. ${article.title} (${article.source})`)
        .join('\n');
      parts.push(optimizedPrompts.chartAnalysis.newsTemplate.replace('{newsItems}', newsItems));
    }

    return parts.join('\n');
  }

  protected parseSignalFromResponse(text: string): {
    signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
  } | null {
    const signalRegex = /\*\*Current Signal\*\*:?\s*(STRONG[_\s]BUY|BUY|HOLD|SELL|STRONG[_\s]SELL)/i;
    const confidenceRegex = /\*\*Confidence\*\*:?\s*(\d+)%?/i;

    const signalMatch = text.match(signalRegex);
    const confidenceMatch = text.match(confidenceRegex);

    if (!signalMatch || !signalMatch[1]) return null;

    const signalMap: Record<string, 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'> = {
      'STRONG_BUY': 'strong_buy',
      'STRONG BUY': 'strong_buy',
      'BUY': 'buy',
      'HOLD': 'hold',
      'SELL': 'sell',
      'STRONG_SELL': 'strong_sell',
      'STRONG SELL': 'strong_sell',
    };

    const normalizedSignal = signalMatch[1].toUpperCase().replace(/\s+/g, '_');
    const signal = signalMap[normalizedSignal];

    if (!signal) return null;

    const confidence = confidenceMatch && confidenceMatch[1] ? parseInt(confidenceMatch[1], 10) : 50;

    return { signal, confidence };
  }
}
