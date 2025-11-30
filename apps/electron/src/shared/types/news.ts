import type { NewsArticle } from './ai';

export type NewsSentiment = 'positive' | 'negative' | 'neutral';

export type NewsCategory = 'general' | 'crypto' | 'stocks' | 'forex' | 'commodities';

export interface FetchNewsOptions {
  query?: string;
  symbols?: string[];
  category?: NewsCategory;
  from?: number;
  to?: number;
  limit?: number;
  language?: string;
}

export interface NewsProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  rateLimitPerSecond?: number;
  cacheDuration?: number;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  page?: number;
  pageSize?: number;
}

export abstract class BaseNewsProvider {
  protected config: NewsProviderConfig;
  protected name: string;

  constructor(name: string, config: NewsProviderConfig) {
    this.name = name;
    this.config = config;
  }

  abstract fetchNews(options: FetchNewsOptions): Promise<NewsResponse>;
  
  abstract searchNews(query: string, limit?: number): Promise<NewsResponse>;
  
  getName(): string {
    return this.name;
  }
  
  getConfig(): NewsProviderConfig {
    return this.config;
  }
}

export interface NewsServiceConfig {
  primaryProvider: BaseNewsProvider;
  fallbackProviders?: BaseNewsProvider[];
  defaultCacheDuration?: number;
  enableSentimentAnalysis?: boolean;
}

export interface NewsCacheEntry {
  data: NewsResponse;
  openTime: number;
  expiresAt: number;
}

export interface NewsFilter {
  sentiment?: NewsSentiment;
  category?: NewsCategory;
  symbols?: string[];
  searchQuery?: string;
  dateFrom?: number;
  dateTo?: number;
}
