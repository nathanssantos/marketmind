import type {
    BaseNewsProvider,
    FetchNewsOptions,
    NewsArticle,
    NewsCacheEntry,
    NewsFilter,
    NewsResponse,
    NewsServiceConfig,
} from '@shared/types';

export class NewsService {
  private primaryProvider: BaseNewsProvider;
  private fallbackProviders: BaseNewsProvider[];
  private cache: Map<string, NewsCacheEntry>;
  private defaultCacheDuration: number;

  constructor(config: NewsServiceConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProviders = config.fallbackProviders || [];
    this.cache = new Map();
    this.defaultCacheDuration = config.defaultCacheDuration || 300000;
  }

  private generateCacheKey(provider: string, options: FetchNewsOptions): string {
    const params = {
      provider,
      query: options.query,
      symbols: options.symbols?.sort().join(','),
      category: options.category,
      from: options.from,
      to: options.to,
      limit: options.limit,
    };

    return JSON.stringify(params);
  }

  private getFromCache(key: string): NewsResponse | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private addToCache(key: string, data: NewsResponse, duration?: number): void {
    const cacheDuration = duration || this.defaultCacheDuration;
    const now = Date.now();

    this.cache.set(key, {
      data,
      openTime: now,
      expiresAt: now + cacheDuration,
    });
  }

  private filterArticles(articles: NewsArticle[], filter: NewsFilter): NewsArticle[] {
    let filtered = articles;

    if (filter.sentiment) {
      filtered = filtered.filter((article) => article.sentiment === filter.sentiment);
    }

    if (filter.symbols && filter.symbols.length > 0) {
      filtered = filtered.filter((article) =>
        article.symbols?.some((symbol) => filter.symbols?.includes(symbol))
      );
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query)
      );
    }

    if (filter.dateFrom) {
      filtered = filtered.filter((article) => article.publishedAt >= filter.dateFrom!);
    }

    if (filter.dateTo) {
      filtered = filtered.filter((article) => article.publishedAt <= filter.dateTo!);
    }

    return filtered;
  }

  async fetchNews(options: FetchNewsOptions = {}): Promise<NewsResponse> {
    const cacheKey = this.generateCacheKey(this.primaryProvider.getName(), options);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const providers = [this.primaryProvider, ...this.fallbackProviders];
    const errors: Error[] = [];

    for (const provider of providers) {
      try {
        const response = await provider.fetchNews(options);

        this.addToCache(cacheKey, response);

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(error instanceof Error ? error : new Error(errorMessage));
        
        if (provider === providers[providers.length - 1]) {
          if (errors.length === 1) {
            throw errors[0];
          }
          throw new Error(`All news providers failed: ${errors.map(e => e.message).join(', ')}`);
        }

        continue;
      }
    }

    throw new Error('All news providers failed');
  }

  async searchNews(query: string, limit = 10): Promise<NewsResponse> {
    return this.fetchNews({ query, limit });
  }

  async getNewsWithFilter(options: FetchNewsOptions, filter: NewsFilter): Promise<NewsResponse> {
    const response = await this.fetchNews(options);

    const filtered = this.filterArticles(response.articles, filter);

    return {
      ...response,
      articles: filtered,
      totalResults: filtered.length,
    };
  }

  setPrimaryProvider(provider: BaseNewsProvider): void {
    this.primaryProvider = provider;
    this.cache.clear();
  }

  addFallbackProvider(provider: BaseNewsProvider): void {
    if (!this.fallbackProviders.find((p) => p.getName() === provider.getName())) {
      this.fallbackProviders.push(provider);
    }
  }

  removeFallbackProvider(providerName: string): void {
    this.fallbackProviders = this.fallbackProviders.filter((p) => p.getName() !== providerName);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getPrimaryProvider(): BaseNewsProvider {
    return this.primaryProvider;
  }

  getFallbackProviders(): BaseNewsProvider[] {
    return this.fallbackProviders;
  }
}
