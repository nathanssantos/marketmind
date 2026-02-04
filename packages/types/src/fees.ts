import type { MarketType } from './futures';

export interface FeeParams {
  marketType: MarketType;
  useBnbDiscount?: boolean;
  vipLevel?: number;
}

export interface TradingFees {
  makerFeeRate: number;
  takerFeeRate: number;
  vipLevel: number;
  hasBNBDiscount: boolean;
  lastUpdated: number;
  minProfitAfterFees?: number;
  minRiskRewardAfterFees?: number;
  minPositionValue?: number;
}

export interface FeeCalculation {
  entryFee: number;
  exitFee: number;
  totalFees: number;
  feePercentage: number;
  netProfit: number;
  netProfitPercentage: number;
  isProfitableAfterFees: boolean;
}

export interface TradeViability {
  isViable: boolean;
  reason?: string;
  expectedProfit: number;
  expectedProfitAfterFees: number;
  riskRewardRatio: number;
  riskRewardRatioAfterFees: number;
  fees: FeeCalculation;
}

export type FeeOrderType = 'MAKER' | 'TAKER';

export interface MarketFees {
  maker: number;
  taker: number;
}

export const TRADING_THRESHOLDS = {
  MIN_PROFIT_AFTER_FEES: 0.005,
  MIN_RISK_REWARD_AFTER_FEES: 2.0,
  MIN_POSITION_VALUE: 10,
} as const;

export const getTradingThresholds = (fees?: TradingFees) => ({
  MIN_PROFIT_AFTER_FEES: fees?.minProfitAfterFees ?? TRADING_THRESHOLDS.MIN_PROFIT_AFTER_FEES,
  MIN_RISK_REWARD_AFTER_FEES: fees?.minRiskRewardAfterFees ?? TRADING_THRESHOLDS.MIN_RISK_REWARD_AFTER_FEES,
  MIN_POSITION_VALUE: fees?.minPositionValue ?? TRADING_THRESHOLDS.MIN_POSITION_VALUE,
});
