import type { AIStudy } from './aiStudy';
import type { CalendarEvent } from './calendar';
import type { Candle } from './candle';

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: number;
  model?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string | undefined;
  url: string;
  source: string;
  author?: string | undefined;
  publishedAt: number;
  imageUrl?: string | undefined;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevance?: number;
  categories?: string[] | undefined;
  symbols?: string[] | undefined;
}

export interface AIAnalysisRequest {
  chartImage: string;
  candles: Candle[];
  news?: NewsArticle[];
  events?: CalendarEvent[];
  context?: string;
}

export interface TradingSignalData {
  signal: TradingSignal;
  confidence?: number;
  reasoning?: string;
}

export interface AIAnalysisResponse {
  text: string;
  confidence?: number;
  signals?: TradingSignalData[];
  studies?: AIStudy[];
}

export type TradingSignal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

export type AIProviderType = 'openai' | 'anthropic' | 'gemini';

export interface AIConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
