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

export const BINANCE_VIP_LEVELS = [
  { level: 0, commissionBps: 100, maker: 0.001, taker: 0.001 },
  { level: 1, commissionBps: 90, maker: 0.0009, taker: 0.001 },
  { level: 2, commissionBps: 80, maker: 0.0008, taker: 0.001 },
  { level: 3, commissionBps: 60, maker: 0.0006, taker: 0.0009 },
  { level: 4, commissionBps: 40, maker: 0.0004, taker: 0.0008 },
  { level: 5, commissionBps: 20, maker: 0.0002, taker: 0.0006 },
  { level: 6, commissionBps: 12, maker: 0.00012, taker: 0.0004 },
  { level: 7, commissionBps: 10, maker: 0.0001, taker: 0.0003 },
  { level: 8, commissionBps: 8, maker: 0.00008, taker: 0.00024 },
  { level: 9, commissionBps: 4, maker: 0.00004, taker: 0.00018 },
] as const;

export const getVIPLevelFromCommission = (commissionBps: number): number => {
  const match = BINANCE_VIP_LEVELS.find((v) => v.commissionBps === commissionBps);
  return match?.level ?? 0;
};

export const getTradingThresholds = (fees?: TradingFees) => ({
  MIN_PROFIT_AFTER_FEES: fees?.minProfitAfterFees ?? TRADING_THRESHOLDS.MIN_PROFIT_AFTER_FEES,
  MIN_RISK_REWARD_AFTER_FEES: fees?.minRiskRewardAfterFees ?? TRADING_THRESHOLDS.MIN_RISK_REWARD_AFTER_FEES,
  MIN_POSITION_VALUE: fees?.minPositionValue ?? TRADING_THRESHOLDS.MIN_POSITION_VALUE,
});
