import type {
    AITradingContext,
    CalendarEvent,
    ContextAggregatorConfig,
    LiquidityLevel,
    MarketSentiment,
    NewsArticle,
    TradingSetup,
} from '@marketmind/types';
import { BinanceFuturesDataService } from '../binance-futures-data';
import { BTCDominanceDataService } from '../btc-dominance-data';

export class ContextAggregator {
  private config: ContextAggregatorConfig;
  private btcDominanceService: BTCDominanceDataService;
  private binanceFuturesService: BinanceFuturesDataService;

  constructor(config: ContextAggregatorConfig = {}) {
    this.config = {
      newsLookbackHours: 24,
      eventsLookforwardDays: 7,
      enableFearGreedIndex: true,
      enableBTCDominance: true,
      enableFundingRate: true,
      enableOpenInterest: true,
      ...config,
    };
    this.btcDominanceService = new BTCDominanceDataService();
    this.binanceFuturesService = new BinanceFuturesDataService();
  }

  async buildContext(
    symbol: string,
    detectedSetups: TradingSetup[]
  ): Promise<AITradingContext> {
    const [news, events, fearIndex, btcDom, funding, openInterest] = await Promise.all([
      this.fetchRecentNews(symbol),
      this.fetchUpcomingEvents(symbol),
      this.config.enableFearGreedIndex ? this.getFearGreedIndex() : Promise.resolve(50),
      this.config.enableBTCDominance ? this.getBTCDominance() : Promise.resolve(50),
      this.config.enableFundingRate ? this.getFundingRate(symbol) : Promise.resolve(undefined),
      this.config.enableOpenInterest ? this.getOpenInterest(symbol) : Promise.resolve(undefined),
    ]);

    const filteredNews = this.filterRelevantNews(news, symbol);
    const sentiment = this.calculateSentiment(filteredNews, fearIndex);
    const volatility = this.calculateVolatility(symbol);
    const liquidityLevel = this.assessLiquidity(symbol);

    return {
      detectedSetups,
      news: filteredNews,
      calendarEvents: events,
      fearGreedIndex: fearIndex,
      btcDominance: btcDom,
      marketSentiment: sentiment,
      volatility,
      liquidityLevel,
      fundingRate: funding,
      openInterest,
    };
  }

  private async fetchRecentNews(_symbol: string): Promise<NewsArticle[]> {
    return [];
  }

  private async fetchUpcomingEvents(_symbol: string): Promise<CalendarEvent[]> {
    return [];
  }

  private async getFearGreedIndex(): Promise<number> {
    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!response.ok) return 50;
      
      const data = await response.json();
      if (data?.data?.[0]?.value) {
        return parseInt(data.data[0].value, 10);
      }
      return 50;
    } catch {
      return 50;
    }
  }

  private async getBTCDominance(): Promise<number> {
    try {
      if (!this.config.enableBTCDominance) return 50;
      
      const result = await this.btcDominanceService.getBTCDominanceResult();
      return result.current ?? 50;
    } catch {
      return 50;
    }
  }

  private async getFundingRate(_symbol: string): Promise<number | undefined> {
    try {
      if (!this.config.enableFundingRate) return undefined;
      
      const result = await this.binanceFuturesService.getCurrentFundingRate(_symbol);
      return result.fundingRate;
    } catch {
      return undefined;
    }
  }

  private async getOpenInterest(_symbol: string): Promise<number | undefined> {
    try {
      if (!this.config.enableOpenInterest) return undefined;
      
      const result = await this.binanceFuturesService.getCurrentOpenInterest(_symbol);
      return result.openInterest;
    } catch {
      return undefined;
    }
  }

  private filterRelevantNews(news: NewsArticle[], symbol: string): NewsArticle[] {
    const symbolBase = symbol.replace('USDT', '').replace('USD', '');
    const lookbackTime = Date.now() - (this.config.newsLookbackHours || 24) * 60 * 60 * 1000;

    return news
      .filter(article => {
        const articleTime = new Date(article.publishedAt).getTime();
        return articleTime >= lookbackTime;
      })
      .filter(article => {
        const content = `${article.title} ${article.description || ''}`.toLowerCase();
        return (
          content.includes(symbolBase.toLowerCase()) ||
          content.includes('crypto') ||
          content.includes('bitcoin') ||
          content.includes('market')
        );
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10);
  }

  private calculateSentiment(news: NewsArticle[], fearIndex: number): MarketSentiment {
    if (news.length === 0) {
      if (fearIndex > 60) return 'bullish';
      if (fearIndex < 40) return 'bearish';
      return 'neutral';
    }

    const sentimentScore = news.reduce((score, article) => {
      if (article.sentiment === 'positive') return score + 1;
      if (article.sentiment === 'negative') return score - 1;
      return score;
    }, 0);

    const avgSentiment = sentimentScore / news.length;
    const fearWeight = (fearIndex - 50) / 50;
    const combinedScore = avgSentiment * 0.7 + fearWeight * 0.3;

    if (combinedScore > 0.2) return 'bullish';
    if (combinedScore < -0.2) return 'bearish';
    return 'neutral';
  }

  private calculateVolatility(_symbol: string): number {
    return 0.5;
  }

  private assessLiquidity(_symbol: string): LiquidityLevel {
    return 'medium';
  }

  updateConfig(newConfig: Partial<ContextAggregatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ContextAggregatorConfig {
    return { ...this.config };
  }
}
