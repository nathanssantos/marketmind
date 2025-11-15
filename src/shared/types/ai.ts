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
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevance?: number;
}

export interface AIAnalysisRequest {
  chartImage: string;
  candles: Candle[];
  news?: NewsArticle[];
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
