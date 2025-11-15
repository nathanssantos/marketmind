import axios, { type AxiosInstance } from 'axios';
import {
  BaseNewsProvider,
  type FetchNewsOptions,
  type NewsProviderConfig,
  type NewsResponse,
  type NewsArticle,
} from '@shared/types';

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

export class NewsAPIProvider extends BaseNewsProvider {
  private client: AxiosInstance;
  private lastRequestTime = 0;
  private requestInterval: number;

  constructor(config: NewsProviderConfig) {
    super('NewsAPI', {
      baseUrl: 'https://newsapi.org/v2',
      rateLimitPerSecond: 5,
      cacheDuration: 300000,
      ...config,
    });

    this.requestInterval = 1000 / (this.config.rateLimitPerSecond || 5);

    this.client = axios.create({
      baseURL: this.config.baseUrl || 'https://newsapi.org/v2',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestInterval) {
      const waitTime = this.requestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private normalizeArticle(article: NewsAPIArticle): NewsArticle {
    return {
      id: `newsapi-${Date.parse(article.publishedAt)}-${article.title.slice(0, 20)}`,
      title: article.title,
      description: article.description || '',
      content: article.content ?? undefined,
      url: article.url,
      source: article.source.name,
      author: article.author ?? undefined,
      publishedAt: Date.parse(article.publishedAt),
      imageUrl: article.urlToImage ?? undefined,
      symbols: this.extractSymbols(article.title + ' ' + article.description),
    };
  }

  private extractSymbols(text: string): string[] {
    const symbols: string[] = [];
    const cryptoPattern = /\b(BTC|ETH|BNB|SOL|ADA|XRP|DOGE|DOT|MATIC|AVAX|LINK|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|ICP|FIL|TRX|ETC|THETA|XMR|AAVE|EOS|NEAR|FLOW)\b/gi;

    const cryptoMatches = text.match(cryptoPattern);
    if (cryptoMatches) {
      symbols.push(...cryptoMatches.map((s) => s.toUpperCase()));
    }

    return [...new Set(symbols)];
  }

  async fetchNews(options: FetchNewsOptions): Promise<NewsResponse> {
    await this.enforceRateLimit();

    if (!this.config.apiKey) {
      throw new Error('NewsAPI: API key is required');
    }

    const params: Record<string, string | number> = {
      apiKey: this.config.apiKey || '',
      pageSize: options.limit || 20,
      language: options.language || 'en',
    };

    if (options.query) {
      params['q'] = options.query;
    } else {
      params['q'] = 'finance OR crypto OR stock market';
    }

    if (options.from) {
      params['from'] = new Date(options.from).toISOString();
    }

    if (options.to) {
      params['to'] = new Date(options.to).toISOString();
    }

    if (options.category) {
      params['category'] = options.category === 'general' ? 'business' : options.category;
    }

    try {
      const response = await this.client.get<NewsAPIResponse>('/everything', { params });

      if (response.data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${response.data.status}`);
      }

      const articles = response.data.articles
        .filter((article) => article.title && article.description)
        .map((article) => this.normalizeArticle(article));

      return {
        articles,
        totalResults: response.data.totalResults,
        pageSize: options.limit || 20,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 401) {
          throw new Error('NewsAPI: Invalid API key');
        }

        if (status === 429) {
          throw new Error('NewsAPI: Rate limit exceeded');
        }

        throw new Error(`NewsAPI request failed: ${message}`);
      }

      throw error;
    }
  }

  async searchNews(query: string, limit = 10): Promise<NewsResponse> {
    return this.fetchNews({ query, limit });
  }
}
