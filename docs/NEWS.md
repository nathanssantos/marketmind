# 📰 News Integration Guide - MarketMind

## Overview

The MarketMind news integration system provides real-time financial news with sentiment analysis to enhance AI-powered chart analysis. The system uses a multi-provider architecture with automatic fallback for reliability.

---

## 🏗️ Architecture

### Components

```
News System
├── Types & Interfaces (shared/types/news.ts)
├── Providers
│   ├── BaseNewsProvider (abstract class)
│   ├── NewsAPIProvider (general financial news)
│   └── CryptoPanicProvider (cryptocurrency news)
├── Service Layer
│   └── NewsService (provider management, caching, fallback)
├── React Integration
│   ├── useNews (custom hook)
│   └── NewsPanel (UI component)
└── AI Integration
    ├── ChartContext (news data in context)
    └── formatChartDataContext (news in AI prompts)
```

---

## 📊 News Providers

### 1. CryptoPanic (Primary Provider)

**Focus:** Cryptocurrency news  
**Tier:** Free (no API key required for public feed)  
**Rate Limit:** 2 requests/second  
**Features:**
- Real-time crypto news aggregation
- Automatic sentiment calculation based on community votes
- Symbol extraction from news titles
- Relevance scoring

**Configuration:**
```typescript
new CryptoPanicProvider({
  apiKey: 'free', // or your API key for more features
  rateLimitPerSecond: 2,
  cacheDuration: 300000, // 5 minutes
});
```

**API Example:**
```
GET https://cryptopanic.com/api/v1/posts/
?auth_token=free
&public=true
&kind=news
&currencies=BTC,ETH
```

### 2. NewsAPI (Fallback Provider)

**Focus:** General financial news  
**Tier:** Free (100 requests/day)  
**Rate Limit:** 5 requests/second  
**Features:**
- Global news sources
- Financial and business news
- Search by keywords and categories
- Symbol extraction from article text

**Configuration:**
```typescript
new NewsAPIProvider({
  apiKey: process.env.VITE_NEWSAPI_API_KEY,
  rateLimitPerSecond: 5,
  cacheDuration: 300000,
});
```

**API Example:**
```
GET https://newsapi.org/v2/everything
?apiKey=YOUR_API_KEY
&q=bitcoin OR crypto
&pageSize=20
&language=en
```

---

## 🔧 NewsService

The `NewsService` class manages multiple providers with automatic fallback and caching.

### Features

- **Multi-provider management:** Primary + fallback providers
- **Automatic fallback:** Switches to next provider on error
- **Response caching:** 5-minute default cache (configurable)
- **Article filtering:** Filter by sentiment, symbols, date range
- **Rate limiting:** Per-provider rate limit enforcement

### Usage

```typescript
import { NewsService } from './services/news/NewsService';
import { CryptoPanicProvider } from './services/news/providers/CryptoPanicProvider';
import { NewsAPIProvider } from './services/news/providers/NewsAPIProvider';

const newsService = new NewsService({
  primaryProvider: new CryptoPanicProvider({
    apiKey: import.meta.env['VITE_CRYPTOPANIC_API_KEY'],
  }),
  fallbackProviders: [
    new NewsAPIProvider({
      apiKey: import.meta.env['VITE_NEWSAPI_API_KEY'],
    }),
  ],
  defaultCacheDuration: 300000, // 5 minutes
});

const response = await newsService.fetchNews({
  symbols: ['BTC', 'ETH'],
  limit: 10,
});
```

### Methods

```typescript
interface NewsService {
  fetchNews(options: FetchNewsOptions): Promise<NewsResponse>;
  searchNews(query: string, limit?: number): Promise<NewsResponse>;
  getNewsWithFilter(options: FetchNewsOptions, filter: NewsFilter): Promise<NewsResponse>;
  
  setPrimaryProvider(provider: BaseNewsProvider): void;
  addFallbackProvider(provider: BaseNewsProvider): void;
  removeFallbackProvider(providerName: string): void;
  
  clearCache(): void;
  getCacheSize(): number;
}
```

---

## ⚛️ React Integration

### useNews Hook

Custom React hook for fetching and managing news in components.

```typescript
import { useNews } from './hooks/useNews';

const MyComponent = () => {
  const { articles, loading, error, refetch } = useNews({
    symbols: ['BTC', 'ETH'],
    limit: 10,
    enabled: true,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    filter: {
      sentiment: 'positive',
      dateFrom: Date.now() - 24 * 60 * 60 * 1000, // Last 24h
    },
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
};
```

**Hook Options:**
```typescript
interface UseNewsOptions {
  query?: string;
  symbols?: string[];
  category?: NewsCategory;
  from?: number;
  to?: number;
  limit?: number;
  language?: string;
  filter?: NewsFilter;
  enabled?: boolean;
  refetchInterval?: number;
}
```

**Hook Return:**
```typescript
interface UseNewsReturn {
  articles: NewsArticle[];
  loading: boolean;
  error: Error | null;
  totalResults: number;
  refetch: () => Promise<void>;
  clearCache: () => void;
}
```

### NewsPanel Component

UI component for displaying news articles with sentiment badges.

```typescript
import { NewsPanel } from './components/News/NewsPanel';

<NewsPanel
  symbols={['BTC', 'ETH']}
  limit={10}
  showSentiment={true}
  refetchInterval={5 * 60 * 1000}
/>
```

**Component Props:**
```typescript
interface NewsPanelProps {
  symbols?: string[];
  limit?: number;
  showSentiment?: boolean;
  refetchInterval?: number;
}
```

---

## 🤖 AI Integration

News articles are automatically included in AI chart analysis for sentiment-aware recommendations.

### Integration Flow

1. **News Fetching:** `useNews` hook fetches news for current symbol
2. **Context Storage:** News stored in `ChartContext` alongside candles
3. **AI Prompt:** `formatChartDataContext` includes news in AI prompts
4. **Analysis:** AI considers news sentiment when providing trading signals

### Example AI Prompt with News

```markdown
# Chart Analysis Context

## Asset Information
- Symbol: BTCUSDT
- Timeframe: 1d
- Chart Type: candlestick

## Price Statistics (Last 100 Candles)
- Current Price: $43,250.00
- Price Change: +$1,230.00 (+2.93%)
- High: $44,100.00
- Low: $41,800.00

## Recent News (10 articles)

### News Sentiment Summary
- Positive: 7 (70.0%)
- Negative: 2 (20.0%)
- Neutral: 1 (10.0%)

### Latest News Articles
1. **Bitcoin Surges Past $43K on ETF Approval Rumors**
   - Source: CoinDesk
   - Published: 2 hours ago
   - Sentiment: positive
   - Summary: Bitcoin rallied above $43,000 as market participants...

2. **Institutional Investors Increase BTC Holdings**
   - Source: Bloomberg
   - Published: 4 hours ago
   - Sentiment: positive
   - Summary: Major institutional investors have increased their...
```

### News-Enhanced Analysis Example

```typescript
const messages = [
  {
    role: 'user',
    content: `${formatChartDataContext(chartData)}

Please analyze this chart considering both technical patterns and recent news sentiment.`,
  },
];

const response = await aiService.sendMessage(messages);
```

**AI Response with News Context:**
```
Based on the chart analysis and recent news:

Technical Analysis:
- Strong upward trend with 65% bullish candles
- Price broke resistance at $42K
- Volume increasing on up moves

News Sentiment (70% Positive):
- ETF approval rumors driving optimism
- Institutional accumulation confirmed
- Regulatory clarity improving

Trading Signal: BUY
Confidence: 8/10
Reasoning: Technical breakout confirmed by positive news sentiment. 
Institutional buying and ETF optimism provide fundamental support for 
the technical uptrend. Watch for ETF announcement confirmation.
```

---

## 🎨 News Types

### NewsArticle

```typescript
interface NewsArticle {
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
```

### FetchNewsOptions

```typescript
interface FetchNewsOptions {
  query?: string;
  symbols?: string[];
  category?: NewsCategory;
  from?: number;
  to?: number;
  limit?: number;
  language?: string;
}
```

### NewsFilter

```typescript
interface NewsFilter {
  sentiment?: NewsSentiment;
  category?: NewsCategory;
  symbols?: string[];
  searchQuery?: string;
  dateFrom?: number;
  dateTo?: number;
}
```

---

## 🔐 Environment Variables

Add these to your `.env` file:

```bash
# CryptoPanic API (optional - works with 'free' tier)
VITE_CRYPTOPANIC_API_KEY=

# NewsAPI (get free key at https://newsapi.org)
VITE_NEWSAPI_API_KEY=your_newsapi_key_here
```

---

## 🚀 Getting Started

### 1. Get API Keys

**NewsAPI (Optional but Recommended):**
1. Visit https://newsapi.org/register
2. Sign up for free account
3. Copy your API key
4. Add to `.env`: `VITE_NEWSAPI_API_KEY=your_key`

**CryptoPanic (Optional):**
- Free tier works without API key
- For enhanced features: https://cryptopanic.com/developers/api/

### 2. Install Dependencies

```bash
npm install axios date-fns
```

### 3. Use in Components

```typescript
import { useNews } from './hooks/useNews';

const { articles, loading, error } = useNews({
  symbols: ['BTC'],
  limit: 5,
});
```

---

## 📈 Features

### Current (Phase 8)
✅ Multi-provider architecture  
✅ CryptoPanic integration (crypto news)  
✅ NewsAPI integration (general news)  
✅ Automatic fallback system  
✅ Response caching (5 min)  
✅ Sentiment analysis  
✅ React hook (useNews)  
✅ NewsPanel component  
✅ AI integration (news in prompts)  
✅ Symbol extraction  
✅ Article filtering  

### Planned (v1.1+)
⏳ More news providers (Finnhub, Yahoo Finance)  
⏳ Advanced sentiment analysis with AI  
⏳ News alerts and notifications  
⏳ Custom news feeds  
⏳ Article bookmarking  
⏳ News search functionality  
⏳ Historical news archive  

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch news"

**Cause:** API key missing or invalid  
**Solution:** Check `.env` file for correct API keys

### Issue: "Rate limit exceeded"

**Cause:** Too many requests to provider  
**Solution:** Increase `refetchInterval` or use caching

### Issue: "No news articles found"

**Cause:** No news for the given symbol  
**Solution:** Try different symbols or broaden search with `query`

### Issue: News not appearing in AI analysis

**Cause:** News not being added to ChartContext  
**Solution:** Check that `useNews` is called and `news` is passed to `useChartData`

---

## 📊 Performance Tips

1. **Use Caching:** Default 5-minute cache prevents redundant API calls
2. **Limit Results:** Fetch only what you need (10-20 articles recommended)
3. **Refetch Wisely:** Don't refetch more than every 5 minutes
4. **Filter Early:** Use provider-level filtering instead of client-side
5. **Fallback Strategy:** Always configure fallback providers

---

## 🔗 API Documentation

- **NewsAPI:** https://newsapi.org/docs
- **CryptoPanic:** https://cryptopanic.com/developers/api/

---

**Last Updated:** November 2025  
**Version:** 1.0  
**Phase:** 8 - News Integration
