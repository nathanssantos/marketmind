import type { MarketType } from './futures';
import type { FeeOrderType, FeeParams, MarketFees } from './fees';

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
  VIP_0_MAKER: BINANCE_FEES.SPOT.VIP_0.maker,
  VIP_0_TAKER: BINANCE_FEES.SPOT.VIP_0.taker,
  BNB_DISCOUNT: BINANCE_FEES.BNB_DISCOUNT,
  MIN_NOTIONAL_VALUE: BINANCE_FEES.MIN_NOTIONAL_VALUE,
} as const;

export const getDefaultFee = (
  marketType: MarketType,
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

export const BINANCE_SPOT_VIP_LEVELS = [
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

export const BINANCE_FUTURES_VIP_LEVELS = [
  { level: 0, maker: 0.0002, taker: 0.0004 },
  { level: 1, maker: 0.00016, taker: 0.0004 },
  { level: 2, maker: 0.00014, taker: 0.00035 },
  { level: 3, maker: 0.00012, taker: 0.00032 },
  { level: 4, maker: 0.0001, taker: 0.0003 },
  { level: 5, maker: 0.00008, taker: 0.00027 },
  { level: 6, maker: 0.00006, taker: 0.00025 },
  { level: 7, maker: 0.00004, taker: 0.00022 },
  { level: 8, maker: 0.00002, taker: 0.0002 },
  { level: 9, maker: 0, taker: 0.00017 },
] as const;

export const BINANCE_VIP_LEVELS = BINANCE_SPOT_VIP_LEVELS;

export const getVIPLevelFromCommission = (commissionBps: number): number => {
  const match = BINANCE_VIP_LEVELS.find((v) => v.commissionBps === commissionBps);
  return match?.level ?? 0;
};

export const getFeeRateForVipLevel = (
  marketType: MarketType,
  vipLevel: number = 0,
  orderType: FeeOrderType = 'TAKER'
): number => {
  const clampedLevel = Math.max(0, Math.min(9, vipLevel));
  if (marketType === 'FUTURES') {
    const vip = BINANCE_FUTURES_VIP_LEVELS[clampedLevel] ?? BINANCE_FUTURES_VIP_LEVELS[0];
    return orderType === 'MAKER' ? vip.maker : vip.taker;
  }
  const vip = BINANCE_SPOT_VIP_LEVELS[clampedLevel] ?? BINANCE_SPOT_VIP_LEVELS[0];
  return orderType === 'MAKER' ? vip.maker : vip.taker;
};

export const getRoundTripFee = (params: FeeParams): number => {
  const { marketType, useBnbDiscount = false, vipLevel = 0 } = params;
  const feeRate = getFeeRateForVipLevel(marketType, vipLevel, 'TAKER');
  const roundTripFee = feeRate * 2;
  return useBnbDiscount ? applyBnbDiscount(roundTripFee) : roundTripFee;
};

export const calculateTotalFees = (
  entryValue: number,
  exitValue: number,
  params: FeeParams
): { entryFee: number; exitFee: number; totalFees: number } => {
  const { marketType, useBnbDiscount = false, vipLevel = 0 } = params;
  const feeRate = getFeeRateForVipLevel(marketType, vipLevel, 'TAKER');
  const effectiveRate = useBnbDiscount ? applyBnbDiscount(feeRate) : feeRate;
  const entryFee = entryValue * effectiveRate;
  const exitFee = exitValue * effectiveRate;
  return { entryFee, exitFee, totalFees: entryFee + exitFee };
};
