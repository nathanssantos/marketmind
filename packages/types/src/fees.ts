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

export const BINANCE_FEES = {
  SPOT: {
    VIP_0: { maker: 0.001, taker: 0.001 } as MarketFees,
  },
  FUTURES: {
    VIP_0: { maker: 0.0002, taker: 0.0004 } as MarketFees,
  },
  BNB_DISCOUNT: 0.25,
  MIN_NOTIONAL_VALUE: 10,
} as const;

export const BINANCE_DEFAULT_FEES = {
  VIP_0_MAKER: 0.001,
  VIP_0_TAKER: 0.001,
  BNB_DISCOUNT: 0.25,
  MIN_NOTIONAL_VALUE: 10,
} as const;

export const getDefaultFee = (
  marketType: 'SPOT' | 'FUTURES',
  orderType: FeeOrderType = 'TAKER'
): number => {
  const fees = marketType === 'FUTURES'
    ? BINANCE_FEES.FUTURES.VIP_0
    : BINANCE_FEES.SPOT.VIP_0;
  return orderType === 'MAKER' ? fees.maker : fees.taker;
};

export const applyBnbDiscount = (fee: number): number => {
  return fee * (1 - BINANCE_FEES.BNB_DISCOUNT);
};

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
