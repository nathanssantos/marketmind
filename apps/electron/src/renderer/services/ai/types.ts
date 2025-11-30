import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@shared/types';
import { buildOptimizedMessages } from '../../utils/conversationSummarizer';
import { detectIntentFromConversation, getSystemPrompt as getOptimizedSystemPrompt } from '../../utils/intentDetection';
import { formatKlinesForPrompt, optimizeKlines } from '../../utils/klineOptimizer';
import { parseSignalFromResponse } from '../../utils/signalParser';
import optimizedPrompts from './prompts-optimized.json';
import prompts from './prompts.json';

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedKlinesCount?: number;
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
  public enableAIPatterns: boolean;
  protected detailedKlinesCount: number;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.getDefaultModel();
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.useOptimizedPrompts = true;
    this.enableAIPatterns = true;
    this.detailedKlinesCount = config.detailedKlinesCount ?? 32;
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
    
    if (!this.enableAIPatterns) {
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

      if (request.klines && request.klines.length > 0) {
        const latestKline = request.klines[request.klines.length - 1];
        if (latestKline) {
          const priceData = prompts.chartAnalysis.priceDataTemplate
            .replace('{open}', parseFloat(latestKline.open).toFixed(2))
            .replace('{high}', parseFloat(latestKline.high).toFixed(2))
            .replace('{low}', parseFloat(latestKline.low).toFixed(2))
            .replace('{close}', parseFloat(latestKline.close).toFixed(2))
            .replace('{volume}', parseFloat(latestKline.volume).toLocaleString());
          parts.push(priceData);
        }
      }

      if (request.news && request.news.length > 0) {
        const newsItems = request.news.slice(0, 5)
          .map((article, i) => `${i + 1}. ${article.title} (${article.source})`)
          .join('\n');
        const newsSection = prompts.chartAnalysis.newsTemplate.replace('{newsItems}', newsItems);
        parts.push(newsSection);
        console.log('[AI Prompt] News section added to prompt:', newsSection);
      }

      return parts.join('\n');
    }
    
    const parts: string[] = [
      optimizedPrompts.chartAnalysis.userTemplate,
    ];

    if (request.context) {
      parts.push(optimizedPrompts.chartAnalysis.contextTemplate.replace('{context}', request.context));
    }

    if (request.klines && request.klines.length > 0) {
      const optimized = optimizeKlines(request.klines, this.detailedKlinesCount);
      
      const timestampInfo = optimizedPrompts.chartAnalysis.openTimeInfoTemplate
        .replace('{firstTimestamp}', optimized.openTimeInfo.first.toString())
        .replace('{lastTimestamp}', optimized.openTimeInfo.last.toString())
        .replace('{totalKlines}', optimized.openTimeInfo.total.toString())
        .replace('{timeframe}', optimized.openTimeInfo.timeframe);
      parts.push(timestampInfo);
      
      const klineData = formatKlinesForPrompt(optimized);
      parts.push(`\n\nKLINE DATA:\n${klineData}`);
      
      const latestKline = request.klines[request.klines.length - 1];
      if (latestKline) {
        const priceData = optimizedPrompts.chartAnalysis.priceDataTemplate
          .replace('{open}', parseFloat(latestKline.open).toFixed(2))
          .replace('{high}', parseFloat(latestKline.high).toFixed(2))
          .replace('{low}', parseFloat(latestKline.low).toFixed(2))
          .replace('{close}', parseFloat(latestKline.close).toFixed(2))
          .replace('{volume}', parseFloat(latestKline.volume).toLocaleString());
        parts.push(priceData);
      }
    }

    if (request.news && request.news.length > 0) {
      const newsItems = request.news.slice(0, 5)
        .map((article, i) => `${i + 1}. ${article.title} (${article.source})`)
        .join('\n');
      const newsSection = optimizedPrompts.chartAnalysis.newsTemplate.replace('{newsItems}', newsItems);
      parts.push(newsSection);
      console.log('[AI Prompt] News section added to prompt:', newsSection);
    }

    if (request.events && request.events.length > 0) {
      const eventItems = request.events
        .sort((a, b) => a.startDate - b.startDate)
        .slice(0, 10)
        .map((event, i) => {
          const date = new Date(event.startDate);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeToEvent = event.startDate - Date.now();
          const daysAway = Math.floor(timeToEvent / (1000 * 60 * 60 * 24));
          
          let timing = '';
          if (event.isPast) {
            timing = `(${Math.abs(daysAway)} days ago)`;
          } else if (daysAway === 0) {
            timing = '(TODAY)';
          } else if (daysAway === 1) {
            timing = '(TOMORROW)';
          } else if (daysAway > 0) {
            timing = `(in ${daysAway} days)`;
          }
          
          return `${i + 1}. [${event.importance.toUpperCase()}] ${event.title} - ${event.type} on ${dateStr} ${timing}`;
        })
        .join('\n');
      
      const eventsSection = `\n\nUpcoming Economic Events:\n${eventItems}`;
      parts.push(eventsSection);
      console.log('[AI Prompt] Events section added to prompt:', eventsSection);
    }

    return parts.join('\n');
  }

  protected parseSignalFromResponse(text: string): {
    signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
  } | null {
    return parseSignalFromResponse(text);
  }
}
