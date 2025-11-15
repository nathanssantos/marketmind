# Market Data API Integration

## 📋 Overview

MarketMind uses a **generic provider architecture** for market data APIs, allowing easy switching and fallback between different data sources without code changes.

## 🏗️ Architecture

### Base Provider Pattern

```typescript
BaseMarketProvider (Abstract)
  ├── BinanceProvider (Primary - Free, No API Key)
  └── CoinGeckoProvider (Fallback - Free, No API Key)
```

All providers implement the same interface:
- `fetchCandles()` - Get historical candlestick data
- `searchSymbols()` - Search for trading symbols
- `getSymbolInfo()` - Get symbol details
- `normalizeSymbol()` - Convert symbol formats

### MarketDataService

Manages multiple providers with automatic fallback:
1. Tries primary provider (Binance)
2. Falls back to secondary providers on error
3. Caches responses to reduce API calls
4. Handles rate limiting per provider

## 🚀 Current Implementation

### Binance API (Primary)
- **Type:** Cryptocurrency
- **Base URL:** `https://api.binance.com`
- **API Key:** Not required for public data
- **Rate Limit:** 20 requests/second
- **Endpoints:**
  - `/api/v3/klines` - Candlestick data
  - `/api/v3/exchangeInfo` - Symbol information

**Advantages:**
- Real OHLCV data with actual wicks
- High rate limits
- No authentication needed
- Real-time capable
- Comprehensive cryptocurrency coverage

**Supported Intervals:**
- `1m`, `5m`, `15m`, `30m` (minutes)
- `1h`, `4h` (hours)
- `1d` (days)
- `1w` (weeks)
- `1M` (months)

### CoinGecko API (Fallback)
- **Type:** Cryptocurrency
- **Base URL:** `https://api.coingecko.com/api/v3`
- **API Key:** Not required
- **Rate Limit:** 10 requests/second (free tier)
- **Endpoints:**
  - `/coins/{id}/market_chart` - Historical chart data
  - `/coins/list` - Available coins

**Limitations:**
- Simplified candlestick data (no wicks)
- Lower rate limits
- Less granular intervals

## 💻 Usage

### Basic Usage

```typescript
import { MarketDataService, BinanceProvider, CoinGeckoProvider } from '@/services/market';

// Create providers
const binance = new BinanceProvider();
const coingecko = new CoinGeckoProvider();

// Create service with fallback
const marketService = new MarketDataService({
  primaryProvider: binance,
  fallbackProviders: [coingecko],
  enableCache: true,
  cacheDuration: 60 * 1000, // 1 minute
});

// Fetch candles
const data = await marketService.fetchCandles({
  symbol: 'BTCUSDT',
  interval: '1h',
  limit: 500,
});
```

### With React Hook

```typescript
import { useMarketData } from '@/hooks/useMarketData';

function MyComponent() {
  const { data, loading, error, refetch } = useMarketData(marketService, {
    symbol: 'BTCUSDT',
    interval: '1d',
    limit: 500,
    enabled: true,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <ChartCanvas candles={data.candles} />;
}
```

## 🔧 Adding New Providers

### Step 1: Create Provider Class

```typescript
// src/renderer/services/market/providers/NewProvider.ts
import { BaseMarketProvider, type MarketProviderConfig } from '@shared/types';

export class NewProvider extends BaseMarketProvider {
  constructor(config?: Partial<MarketProviderConfig>) {
    super({
      name: 'NewProvider',
      type: 'crypto', // or 'stock', 'forex'
      baseUrl: 'https://api.example.com',
      rateLimit: 10,
      enabled: true,
      ...config,
    });
  }

  async fetchCandles(options: FetchCandlesOptions): Promise<CandleData> {
    // Implementation
  }

  async searchSymbols(query: string): Promise<Symbol[]> {
    // Implementation
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    // Implementation
  }

  normalizeSymbol(symbol: string): string {
    // Implementation
  }
}
```

### Step 2: Add to Service

```typescript
const newProvider = new NewProvider();
marketService.addFallbackProvider(newProvider);

// Or set as primary
marketService.setPrimaryProvider(newProvider);
```

## 📊 Data Format

### CandleData

```typescript
interface CandleData {
  symbol: string;        // "BTCUSDT"
  interval: TimeInterval; // "1h", "1d", etc.
  candles: Candle[];
}

interface Candle {
  timestamp: number;  // Unix timestamp in milliseconds
  open: number;       // Opening price
  high: number;       // Highest price
  low: number;        // Lowest price
  close: number;      // Closing price
  volume: number;     // Trading volume
}
```

## 🌐 Future Providers (Planned)

### For Stocks
- **Alpha Vantage** (Free tier: 5 requests/minute)
- **Yahoo Finance** (Unofficial, free)
- **IEX Cloud** (Free tier: 50K messages/month)

### For Forex
- **OANDA** (Requires API key)
- **Forex.com** (Requires API key)

### For Crypto (Additional)
- **Coinbase** (Free, no auth for public data)
- **Kraken** (Free, no auth for public data)

## 🔐 Configuration

### Provider Config

```typescript
interface MarketProviderConfig {
  name: string;           // Provider identifier
  type: 'crypto' | 'stock' | 'forex';
  baseUrl: string;        // API base URL
  apiKey?: string;        // Optional API key
  rateLimit?: number;     // Requests per second
  enabled: boolean;       // Enable/disable provider
}
```

### Service Config

```typescript
interface MarketDataServiceConfig {
  primaryProvider: BaseMarketProvider;
  fallbackProviders?: BaseMarketProvider[];
  enableCache?: boolean;
  cacheDuration?: number; // milliseconds
}
```

## 🚨 Error Handling

The service automatically handles errors and falls back to alternative providers:

```typescript
try {
  const data = await marketService.fetchCandles(options);
} catch (error) {
  // All providers failed
  console.error('Failed to fetch data:', error);
}
```

Individual provider errors are logged but don't stop execution:

```
⚠ Provider Binance failed: Network error
✓ Provider CoinGecko succeeded
```

## 🎯 Best Practices

1. **Always provide fallback providers** for reliability
2. **Enable caching** to reduce API calls
3. **Use appropriate cache duration** (60s for real-time, 5min+ for historical)
4. **Respect rate limits** - the service handles this automatically
5. **Monitor provider health** - log errors to detect issues

## 📝 Notes

- All providers are **free** and require **no API keys** for basic usage
- Binance offers the best data quality for cryptocurrencies
- CoinGecko provides good coverage but with simplified data
- Cache is automatically cleared when changing providers
- Symbol formats are normalized per provider

## 🔄 WebSocket Support (Planned)

Future update will add real-time WebSocket connections:

```typescript
// Planned API
marketService.subscribeToUpdates({
  symbol: 'BTCUSDT',
  interval: '1m',
  onUpdate: (candle) => {
    // Handle real-time update
  },
});
```

---

**Last Updated:** November 15, 2025  
**Version:** 1.0.0
