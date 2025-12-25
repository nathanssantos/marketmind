import type { Kline, KlineData, TimeInterval, FuturesSymbolInfo, MarketType } from '@marketmind/types';
import {
    BaseMarketProvider,
    type FetchKlinesOptions,
    type MarketProviderConfig,
    type Symbol,
    type SymbolInfo,
    type WebSocketSubscription,
    type WebSocketUpdate,
} from '@marketmind/types';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

interface BinanceFuturesKline {
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

interface BinanceFuturesSymbol {
  symbol: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  deliveryDate: number;
  onboardDate: number;
  status: string;
  maintMarginPercent: string;
  requiredMarginPercent: string;
  pricePrecision: number;
  quantityPrecision: number;
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

interface BinanceFuturesExchangeInfo {
  symbols: BinanceFuturesSymbol[];
}

interface BinanceFuturesWSKline {
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

const POPULAR_FUTURES_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'APTUSDT',
];

export class BinanceFuturesProvider extends BaseMarketProvider {
  private client: AxiosInstance;
  private symbolsCache: BinanceFuturesSymbol[] | null = null;
  private symbolsCacheTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private wsConnections: Map<string, WebSocket> = new Map();
  private wsBaseUrl = 'wss://fstream.binance.com/ws';
  readonly marketType: MarketType = 'FUTURES';

  constructor(config?: Partial<MarketProviderConfig>) {
    const defaultConfig: MarketProviderConfig = {
      name: 'Binance Futures',
      type: 'crypto',
      baseUrl: 'https://fapi.binance.com',
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

        const response = await this.client.get<BinanceFuturesKline[]>('/fapi/v1/klines', { params });

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
        this.handleError(error, `Failed to fetch futures klines for ${symbol}`);
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
        s.contractType === 'PERPETUAL' &&
        (s.symbol.includes(normalizedQuery) ||
         s.baseAsset.includes(normalizedQuery) ||
         s.quoteAsset.includes(normalizedQuery))
      )
      .slice(0, 50)
      .map(s => ({
        ...s,
        displayName: `${s.baseAsset}/${s.quoteAsset} PERP`,
        marketType: 'FUTURES' as const,
      }) as unknown as Symbol);
  }

  async getPopularSymbols(): Promise<Symbol[]> {
    await this.ensureSymbolsCache();

    if (!this.symbolsCache) return [];

    return this.symbolsCache
      .filter(s =>
        s.status === 'TRADING' &&
        s.contractType === 'PERPETUAL' &&
        POPULAR_FUTURES_SYMBOLS.includes(s.symbol)
      )
      .map(s => ({
        ...s,
        displayName: `${s.baseAsset}/${s.quoteAsset} PERP`,
        marketType: 'FUTURES' as const,
      }) as unknown as Symbol);
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo & { maxLeverage: number; maintMarginPercent: string }> {
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
      displayName: `${symbolData.baseAsset}/${symbolData.quoteAsset} PERP`,
      minPrice: parseFloat(priceFilter?.minPrice || '0'),
      maxPrice: parseFloat(priceFilter?.maxPrice || '0'),
      tickSize: parseFloat(priceFilter?.tickSize || '0'),
      minQuantity: parseFloat(lotSizeFilter?.minQty || '0'),
      maxQuantity: parseFloat(lotSizeFilter?.maxQty || '0'),
      stepSize: parseFloat(lotSizeFilter?.stepSize || '0'),
      maxLeverage: 125,
      maintMarginPercent: symbolData.maintMarginPercent,
    };
  }

  async getFuturesSymbolInfo(symbol: string): Promise<FuturesSymbolInfo | null> {
    await this.ensureSymbolsCache();

    if (!this.symbolsCache) return null;

    const normalizedSymbol = this.normalizeSymbol(symbol);
    const symbolData = this.symbolsCache.find(s => s.symbol === normalizedSymbol);

    if (symbolData?.contractType !== 'PERPETUAL') return null;

    return {
      symbol: symbolData.symbol,
      pair: symbolData.pair,
      baseAsset: symbolData.baseAsset,
      quoteAsset: symbolData.quoteAsset,
      contractType: 'PERPETUAL',
      deliveryDate: symbolData.deliveryDate,
      onboardDate: symbolData.onboardDate,
      status: symbolData.status,
      pricePrecision: symbolData.pricePrecision,
      quantityPrecision: symbolData.quantityPrecision,
      baseAssetPrecision: symbolData.pricePrecision,
      quotePrecision: symbolData.quantityPrecision,
      maxLeverage: 125,
      maintMarginPercent: symbolData.maintMarginPercent,
      requiredMarginPercent: symbolData.requiredMarginPercent,
      underlyingType: 'COIN',
      underlyingSubType: [],
    };
  }

  async getMarkPrice(symbol: string): Promise<{
    symbol: string;
    markPrice: number;
    indexPrice: number;
    lastFundingRate: number;
    nextFundingTime: number;
    time: number;
  } | null> {
    try {
      const response = await this.client.get('/fapi/v1/premiumIndex', {
        params: { symbol: this.normalizeSymbol(symbol) },
      });

      const data = response.data;

      return {
        symbol: data.symbol,
        markPrice: parseFloat(data.markPrice),
        indexPrice: parseFloat(data.indexPrice),
        lastFundingRate: parseFloat(data.lastFundingRate) * 100,
        nextFundingTime: data.nextFundingTime,
        time: data.time,
      };
    } catch {
      return null;
    }
  }

  async getFundingRate(symbol: string): Promise<{
    symbol: string;
    fundingRate: number;
    fundingTime: number;
    markPrice: number;
  }[]> {
    try {
      const response = await this.client.get('/fapi/v1/fundingRate', {
        params: { symbol: this.normalizeSymbol(symbol), limit: 100 },
      });

      return response.data.map((item: { symbol: string; fundingRate: string; fundingTime: number; markPrice: string }) => ({
        symbol: item.symbol,
        fundingRate: parseFloat(item.fundingRate) * 100,
        fundingTime: item.fundingTime,
        markPrice: parseFloat(item.markPrice),
      }));
    } catch {
      return [];
    }
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
        console.log(`[Binance Futures WS] Connected to ${streamName}`);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: BinanceFuturesWSKline = JSON.parse(event.data);

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
        console.error('[Binance Futures WS] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error(`[Binance Futures WS] Error on ${streamName}:`, error);
    };

    ws.onclose = () => {
      if (import.meta.env.DEV) {
        console.log(`[Binance Futures WS] Disconnected from ${streamName}`);
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

  subscribeToMarkPrice(symbol: string, callback: (data: {
    symbol: string;
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFundingTime: number;
  }) => void): () => void {
    const normalizedSymbol = this.normalizeSymbol(symbol).toLowerCase();
    const streamName = `${normalizedSymbol}@markPrice@1s`;
    const wsUrl = `${this.wsBaseUrl}/${streamName}`;

    const ws = new WebSocket(wsUrl);
    this.wsConnections.set(streamName, ws);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        callback({
          symbol: data.s,
          markPrice: parseFloat(data.p),
          indexPrice: parseFloat(data.i),
          fundingRate: parseFloat(data.r) * 100,
          nextFundingTime: data.T,
        });
      } catch (error) {
        console.error('[Binance Futures WS] Error parsing mark price:', error);
      }
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
      const response = await this.client.get<BinanceFuturesExchangeInfo>('/fapi/v1/exchangeInfo');
      this.symbolsCache = response.data.symbols.filter(s => s.contractType === 'PERPETUAL');
      this.symbolsCacheTime = now;
    } catch (error) {
      this.handleError(error, 'Failed to fetch futures exchange info');
    }
  }
}
