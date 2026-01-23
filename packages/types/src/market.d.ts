import type { Kline, KlineData, TimeInterval } from './kline';
export type SymbolStatus = 'TRADING' | 'HALT' | 'BREAK';
export interface SymbolFilter {
    filterType: string;
    [key: string]: string | number | boolean;
}
export interface Symbol {
    symbol: string;
    status: SymbolStatus;
    baseAsset: string;
    baseAssetPrecision: number;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
    baseCommissionPrecision: number;
    quoteCommissionPrecision: number;
    orderTypes: string[];
    icebergAllowed: boolean;
    ocoAllowed: boolean;
    otoAllowed?: boolean;
    quoteOrderQtyMarketAllowed: boolean;
    allowTrailingStop: boolean;
    cancelReplaceAllowed: boolean;
    isSpotTradingAllowed: boolean;
    isMarginTradingAllowed: boolean;
    filters: SymbolFilter[];
    permissions: string[];
    permissionSets?: string[][];
    defaultSelfTradePreventionMode?: string;
    allowedSelfTradePreventionModes?: string[];
    displayName?: string;
}
export interface SymbolInfo {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    displayName: string;
    minPrice: number;
    maxPrice: number;
    minQuantity: number;
    maxQuantity: number;
    tickSize: number;
    stepSize: number;
}
export interface MarketProviderConfig {
    name: string;
    type: 'crypto' | 'stock' | 'forex';
    baseUrl: string;
    apiKey?: string;
    rateLimit?: number;
    enabled: boolean;
}
export interface FetchKlinesOptions {
    symbol: string;
    interval: TimeInterval;
    limit?: number;
    startTime?: number;
    endTime?: number;
}
export interface MarketDataError {
    provider: string;
    message: string;
    code?: string;
    statusCode?: number;
}
export interface WebSocketUpdate {
    symbol: string;
    interval: TimeInterval;
    kline: Kline;
    isFinal: boolean;
}
export type WebSocketCallback = (update: WebSocketUpdate) => void;
export interface WebSocketSubscription {
    symbol: string;
    interval: TimeInterval;
    callback: WebSocketCallback;
}
export declare abstract class BaseMarketProvider {
    protected config: MarketProviderConfig;
    protected lastRequestTime: number;
    protected requestCount: number;
    constructor(config: MarketProviderConfig);
    abstract fetchKlines(options: FetchKlinesOptions): Promise<KlineData>;
    abstract searchSymbols(query: string): Promise<Symbol[]>;
    abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
    abstract normalizeSymbol(symbol: string): string;
    subscribeToUpdates?(subscription: WebSocketSubscription): () => void;
    supportsWebSocket?(): boolean;
    protected rateLimitedFetch<T>(fetcher: () => Promise<T>): Promise<T>;
    protected handleError(error: unknown, context: string): never;
    get name(): string;
    get type(): string;
    get isEnabled(): boolean;
}
//# sourceMappingURL=market.d.ts.map