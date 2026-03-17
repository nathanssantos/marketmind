import type { AssetClass, ExchangeId } from './market';
import type { MarketType } from './futures';
import type { TimeInterval } from './kline';

export type ScreenerIndicatorId =
  | 'RSI'
  | 'ADX'
  | 'EMA'
  | 'SMA'
  | 'MACD_HISTOGRAM'
  | 'MACD_SIGNAL'
  | 'BOLLINGER_WIDTH'
  | 'BOLLINGER_UPPER'
  | 'BOLLINGER_LOWER'
  | 'ATR'
  | 'ATR_PERCENT'
  | 'STOCHASTIC_K'
  | 'STOCHASTIC_D'
  | 'CCI'
  | 'MFI'
  | 'CMF'
  | 'OBV'
  | 'VWAP'
  | 'ROC'
  | 'WILLIAMS_R'
  | 'CHOPPINESS'
  | 'TSI'
  | 'SUPERTREND'
  | 'PRICE_CLOSE'
  | 'PRICE_CHANGE_24H'
  | 'PRICE_CHANGE_PERCENT_24H'
  | 'VOLUME_24H'
  | 'QUOTE_VOLUME_24H'
  | 'VOLUME_RATIO'
  | 'MARKET_CAP_RANK'
  | 'BTC_CORRELATION'
  | 'FUNDING_RATE';

export type ScreenerOperator =
  | 'ABOVE'
  | 'BELOW'
  | 'BETWEEN'
  | 'CROSSES_ABOVE'
  | 'CROSSES_BELOW'
  | 'INCREASING'
  | 'DECREASING';

export interface ScreenerFilterCondition {
  id: string;
  indicator: ScreenerIndicatorId;
  indicatorParams?: Record<string, number>;
  operator: ScreenerOperator;
  value?: number;
  valueMax?: number;
  compareIndicator?: ScreenerIndicatorId;
  compareIndicatorParams?: Record<string, number>;
  logicGroup?: string;
}

export type ScreenerSortField =
  | 'symbol'
  | 'price'
  | 'priceChange24h'
  | 'volume24h'
  | 'marketCapRank'
  | 'rsi'
  | 'adx'
  | 'atrPercent'
  | 'compositeScore'
  | 'volumeRatio'
  | 'quoteVolume24h';

export interface ScreenerConfig {
  id?: string;
  name?: string;
  description?: string;
  assetClass: AssetClass;
  marketType: MarketType;
  exchange?: ExchangeId;
  interval: TimeInterval;
  filters: ScreenerFilterCondition[];
  sortBy?: ScreenerSortField;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  isPreset?: boolean;
  presetId?: string;
}

export interface ScreenerResultRow {
  symbol: string;
  displayName: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  marketCapRank: number | null;
  indicators: Record<string, number | null>;
  matchedFilters: number;
  totalFilters: number;
  compositeScore: number;
}

export interface ScreenerResponse {
  results: ScreenerResultRow[];
  totalSymbolsScanned: number;
  totalMatched: number;
  executionTimeMs: number;
  cachedAt: number | null;
  config: ScreenerConfig;
}

export type ScreenerPresetCategory =
  | 'momentum'
  | 'mean_reversion'
  | 'volatility'
  | 'volume'
  | 'trend'
  | 'scalping'
  | 'market_data';

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ScreenerPresetCategory;
  assetClassRestriction?: AssetClass;
  exchangeRestriction?: ExchangeId;
  config: Omit<ScreenerConfig, 'assetClass' | 'marketType' | 'interval'>;
}

export interface SavedScreener {
  id: string;
  name: string;
  config: ScreenerConfig;
  createdAt: string;
  updatedAt: string;
}

export type IndicatorCategory =
  | 'oscillator'
  | 'trend'
  | 'volume'
  | 'volatility'
  | 'momentum'
  | 'price'
  | 'market_data'
  | 'crypto';

export interface IndicatorMeta {
  id: ScreenerIndicatorId;
  name: string;
  category: IndicatorCategory;
  defaultParams: Record<string, number>;
  paramLabels?: Record<string, string>;
  valueRange?: { min: number; max: number };
  requiresKlines: boolean;
  assetClassRestriction?: AssetClass;
}
