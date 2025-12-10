import {
    BaseNewsProvider,
    type FetchNewsOptions,
    type NewsArticle,
    type NewsProviderConfig,
    type NewsResponse,
} from '@marketmind/types';

interface CryptoPanicPost {
  id: number;
  kind: string;
  domain: string;
  source: {
    title: string;
    region: string;
    domain: string;
    path: string | null;
  };
  title: string;
  published_at: string;
  slug: string;
  url: string;
  created_at: string;
  votes: {
    negative: number;
    positive: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
  };
  currencies?: Array<{
    code: string;
    title: string;
    slug: string;
    url: string;
  }>;
}

interface CryptoPanicResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CryptoPanicPost[];
}

export class CryptoPanicProvider extends BaseNewsProvider {
  private lastRequestTime = 0;
  private requestInterval: number;

  constructor(config: NewsProviderConfig) {
    super('CryptoPanic', {
      baseUrl: 'https://cryptopanic.com/api/free/v1',
      rateLimitPerSecond: 2,
      cacheDuration: 300000,
      ...config,
    });

    this.requestInterval = 1000 / (this.config.rateLimitPerSecond || 2);
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

  private calculateSentiment(votes: CryptoPanicPost['votes']): 'positive' | 'negative' | 'neutral' {
    const positiveScore = votes.positive + votes.important + votes.liked;
    const negativeScore = votes.negative + votes.toxic + votes.disliked;

    if (positiveScore > negativeScore * 1.5) return 'positive';
    if (negativeScore > positiveScore * 1.5) return 'negative';
    return 'neutral';
  }

  private normalizeArticle(post: CryptoPanicPost): NewsArticle {
    return {
      id: `cryptopanic-${post.id}`,
      title: post.title,
      description: post.title,
      url: post.url,
      source: post.source.title,
      publishedAt: Date.parse(post.published_at),
      sentiment: this.calculateSentiment(post.votes),
      relevance: post.votes.important / 100,
      symbols: post.currencies?.map((c) => c.code.toUpperCase()) ?? undefined,
      categories: ['crypto'],
    };
  }

  async fetchNews(options: FetchNewsOptions): Promise<NewsResponse> {
    await this.enforceRateLimit();

    const params: Record<string, string | number> = {
      auth_token: this.config.apiKey || 'free',
      public: 'true',
      kind: 'news',
    };

    if (options.symbols && options.symbols.length > 0) {
      params['currencies'] = options.symbols.join(',').toUpperCase();
    }

    if (options.limit) {
      params['page_size'] = Math.min(options.limit, 50);
    }

    try {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      
      const baseUrl = this.config.baseUrl || 'https://cryptopanic.com/api/free/v1';
      const url = `${baseUrl}/posts/?${queryString}`;

      console.log('[CryptoPanic] Fetching news from:', url);

      const response = await window.electron.http.fetch(url);

      console.log('[CryptoPanic] Response:', { 
        success: response.success, 
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data
      });

      if (!response.success) {
        if (response.status === 401) {
          throw new Error('CryptoPanic: Invalid API key');
        }

        if (response.status === 429) {
          throw new Error('CryptoPanic: Rate limit exceeded');
        }

        throw new Error(`CryptoPanic request failed: ${response.statusText || response.error}`);
      }

      if (!response.data || typeof response.data !== 'object') {
        console.error('[CryptoPanic] Invalid response data:', response.data);
        throw new Error('Failed to parse response');
      }

      const data = response.data as CryptoPanicResponse;
      
      if (!data.results || !Array.isArray(data.results)) {
        console.error('[CryptoPanic] Invalid response structure:', data);
        throw new Error('Invalid response structure');
      }

      console.log('[CryptoPanic] Successfully fetched', data.results.length, 'articles');

      const articles = data.results.map((post) => this.normalizeArticle(post));

      return {
        articles,
        totalResults: data.count,
        pageSize: options.limit || 20,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('CryptoPanic request failed: Unknown error');
    }
  }

  async searchNews(query: string, limit = 10): Promise<NewsResponse> {
    return this.fetchNews({ query, limit });
  }
}
