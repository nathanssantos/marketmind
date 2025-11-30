import type { Kline, KlineData, TimeInterval } from '@shared/types';
import {
    BaseMarketProvider,
    type FetchKlinesOptions,
    type MarketProviderConfig,
    type Symbol,
    type SymbolInfo,
    type WebSocketSubscription,
    type WebSocketUpdate,
} from '@shared/types';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

interface BinanceKline {
  0: number;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: number;
  7: string;
  8: number;
  9: string;
  10: string;
  11: string;
}

interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  filters: Array<{
    filterType: string;
    minPrice?: string;
    maxPrice?: string;
    tickSize?: string;
    minQty?: string;
    maxQty?: string;
    stepSize?: string;
  }>;
}

interface BinanceExchangeInfo {
  symbols: BinanceSymbol[];
}

interface BinanceWSKline {
  e: string;
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    f: number;
    L: number;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean;
    q: string;
    V: string;
    Q: string;
    B: string;
  };
}

const BINANCE_INTERVAL_MAP: Record<TimeInterval, string> = {
  '1s': '1s',
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '6h': '6h',
  '8h': '8h',
  '12h': '12h',
  '1d': '1d',
  '3d': '3d',
  '1w': '1w',
  '1M': '1M',
};

export class BinanceProvider extends BaseMarketProvider {
  private client: AxiosInstance;
  private symbolsCache: BinanceSymbol[] | null = null;
  private symbolsCacheTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private wsConnections: Map<string, WebSocket> = new Map();
  private wsBaseUrl = 'wss://stream.binance.com:9443/ws';

  constructor(config?: Partial<MarketProviderConfig>) {
    const defaultConfig: MarketProviderConfig = {
      name: 'Binance',
      type: 'crypto',
      baseUrl: 'https://api.binance.com',
      rateLimit: 20,
      enabled: true,
      ...config,
    };

    super(defaultConfig);

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async fetchKlines(options: FetchKlinesOptions): Promise<KlineData> {
    const { symbol, interval, limit = 500, startTime, endTime } = options;

    return this.rateLimitedFetch(async () => {
      try {
        const params: Record<string, string | number> = {
          symbol: this.normalizeSymbol(symbol),
          interval: BINANCE_INTERVAL_MAP[interval],
          limit: Math.min(limit, 1000),
        };

        if (startTime) params['startTime'] = startTime;
        if (endTime) params['endTime'] = endTime;

        const response = await this.client.get<BinanceKline[]>('/api/v3/klines', { params });

        const klines: Kline[] = response.data.map(k => ({
          openTime: k[0],
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          closeTime: k[6],
          quoteVolume: k[7],
          trades: k[8],
          takerBuyBaseVolume: k[9],
          takerBuyQuoteVolume: k[10],
        }));

        return {
          symbol,
          interval,
          klines,
        };
      } catch (error) {
        this.handleError(error, `Failed to fetch klines for ${symbol}`);
      }
    });
  }

  async searchSymbols(query: string): Promise<Symbol[]> {
    await this.ensureSymbolsCache();

    if (!this.symbolsCache) return [];

    const normalizedQuery = query.toUpperCase();
    
    return this.symbolsCache
      .filter(s => 
        s.status === 'TRADING' && 
        (s.symbol.includes(normalizedQuery) || 
         s.baseAsset.includes(normalizedQuery) ||
         s.quoteAsset.includes(normalizedQuery))
      )
      .slice(0, 50)
      .map(s => ({
        ...s,
        displayName: `${s.baseAsset}/${s.quoteAsset}`,
      }) as Symbol);
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    await this.ensureSymbolsCache();

    if (!this.symbolsCache) {
      this.handleError(new Error('Symbol cache not available'), 'Failed to get symbol info');
    }

    const normalizedSymbol = this.normalizeSymbol(symbol);
    const symbolData = this.symbolsCache.find(s => s.symbol === normalizedSymbol);

    if (!symbolData) {
      this.handleError(new Error(`Symbol ${symbol} not found`), 'Invalid symbol');
    }

    const priceFilter = symbolData.filters.find(f => f.filterType === 'PRICE_FILTER');
    const lotSizeFilter = symbolData.filters.find(f => f.filterType === 'LOT_SIZE');

    return {
      symbol: symbolData.symbol,
      baseAsset: symbolData.baseAsset,
      quoteAsset: symbolData.quoteAsset,
      displayName: `${symbolData.baseAsset}/${symbolData.quoteAsset}`,
      minPrice: parseFloat(priceFilter?.minPrice || '0'),
      maxPrice: parseFloat(priceFilter?.maxPrice || '0'),
      tickSize: parseFloat(priceFilter?.tickSize || '0'),
      minQuantity: parseFloat(lotSizeFilter?.minQty || '0'),
      maxQuantity: parseFloat(lotSizeFilter?.maxQty || '0'),
      stepSize: parseFloat(lotSizeFilter?.stepSize || '0'),
    };
  }

  normalizeSymbol(symbol: string): string {
    return symbol.replace(/[/-]/g, '').toUpperCase();
  }

  override supportsWebSocket(): boolean {
    return true;
  }

  override subscribeToUpdates(subscription: WebSocketSubscription): () => void {
    const { symbol, interval, callback } = subscription;
    const normalizedSymbol = this.normalizeSymbol(symbol).toLowerCase();
    const streamName = `${normalizedSymbol}@kline_${BINANCE_INTERVAL_MAP[interval]}`;
    const wsUrl = `${this.wsBaseUrl}/${streamName}`;

    const ws = new WebSocket(wsUrl);
    this.wsConnections.set(streamName, ws);

    ws.onopen = () => {
      if (import.meta.env.DEV) {
        console.log(`[Binance WS] Connected to ${streamName}`);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: BinanceWSKline = JSON.parse(event.data);
        
        if (data.e === 'kline' && data.k) {
          const k = data.k;
          const kline: Kline = {
            openTime: k.t,
            open: k.o,
            high: k.h,
            low: k.l,
            close: k.c,
            volume: k.v,
            closeTime: k.T,
            quoteVolume: k.q,
            trades: k.n,
            takerBuyBaseVolume: k.V,
            takerBuyQuoteVolume: k.Q,
          };

          const update: WebSocketUpdate = {
            symbol,
            interval,
            kline,
            isFinal: k.x,
          };

          callback(update);
        }
      } catch (error) {
        console.error('[Binance WS] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error(`[Binance WS] Error on ${streamName}:`, error);
    };

    ws.onclose = () => {
      if (import.meta.env.DEV) {
        console.log(`[Binance WS] Disconnected from ${streamName}`);
      }
      this.wsConnections.delete(streamName);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      this.wsConnections.delete(streamName);
    };
  }

  private async ensureSymbolsCache(): Promise<void> {
    const now = Date.now();
    
    if (this.symbolsCache && now - this.symbolsCacheTime < this.CACHE_DURATION) {
      return;
    }

    try {
      const response = await this.client.get<BinanceExchangeInfo>('/api/v3/exchangeInfo');
      this.symbolsCache = response.data.symbols;
      this.symbolsCacheTime = now;
    } catch (error) {
      this.handleError(error, 'Failed to fetch exchange info');
    }
  }
}
