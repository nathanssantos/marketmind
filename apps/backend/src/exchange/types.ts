export type { ExchangeId } from '@marketmind/types';
import type { ExchangeId } from '@marketmind/types';

export type ExchangeAssetCategory = 'CRYPTO_SPOT' | 'CRYPTO_FUTURES' | 'EQUITY' | 'ETF' | 'FUTURES' | 'OPTIONS';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export interface MarketHours {
  timezone: string;
  is24h: boolean;
  sessions?: Array<{ open: string; close: string }>;
}

export interface ExchangeCapabilities {
  supportedAssetClasses: ExchangeAssetCategory[];
  supportedOrderTypes: string[];
  supportsOco: boolean;
  supportsAlgoOrders: boolean;
  supportsLeverage: boolean;
  supportsIsolatedMargin: boolean;
  supportsWebSocket: boolean;
  marketHours: MarketHours;
}

export interface ExchangeConfig {
  exchangeId: ExchangeId;
  credentials?: ExchangeCredentials;
}
