export type MarketContextAction = 'reduce_size' | 'block' | 'penalize' | 'warn_only';

export interface FearGreedConfig {
  enabled: boolean;
  thresholdLow: number;
  thresholdHigh: number;
  action: MarketContextAction;
  sizeReduction: number;
}

export interface FundingRateConfig {
  enabled: boolean;
  threshold: number;
  action: MarketContextAction;
  penalty: number;
}

export interface BtcDominanceConfig {
  enabled: boolean;
  changeThreshold: number;
  action: MarketContextAction;
  sizeReduction: number;
}

export interface OpenInterestConfig {
  enabled: boolean;
  changeThreshold: number;
  action: MarketContextAction;
}

export interface MarketContextConfig {
  id: string;
  walletId: string;
  userId: string;
  enabled: boolean;
  shadowMode: boolean;
  fearGreed: FearGreedConfig;
  fundingRate: FundingRateConfig;
  btcDominance: BtcDominanceConfig;
  openInterest: OpenInterestConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketContextFilterResult {
  shouldTrade: boolean;
  positionSizeMultiplier: number;
  confidenceAdjustment: number;
  reason?: string;
  warnings: string[];
  appliedFilters: {
    filter: string;
    action: MarketContextAction;
    value: number;
    threshold: number;
    result: 'pass' | 'warn' | 'adjust' | 'block';
  }[];
}

export interface MarketContextData {
  fearGreedIndex: number;
  fundingRate?: number;
  btcDominance: number;
  btcDominanceChange24h?: number;
  openInterest?: number;
  openInterestChange24h?: number;
  timestamp: Date;
}

export const DEFAULT_MARKET_CONTEXT_CONFIG: Omit<MarketContextConfig, 'id' | 'walletId' | 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  shadowMode: true,
  fearGreed: {
    enabled: true,
    thresholdLow: 20,
    thresholdHigh: 80,
    action: 'reduce_size',
    sizeReduction: 50,
  },
  fundingRate: {
    enabled: true,
    threshold: 0.05,
    action: 'penalize',
    penalty: 20,
  },
  btcDominance: {
    enabled: false,
    changeThreshold: 1.0,
    action: 'reduce_size',
    sizeReduction: 25,
  },
  openInterest: {
    enabled: false,
    changeThreshold: 10,
    action: 'warn_only',
  },
};
