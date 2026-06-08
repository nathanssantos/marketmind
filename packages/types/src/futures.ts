import { BINANCE_FEES } from './binance-fees';
import type { PositionSide } from './direction';

export type MarketType = 'SPOT' | 'FUTURES';

export type MarginType = 'ISOLATED' | 'CROSSED';

export type FuturesContractType = 'PERPETUAL' | 'CURRENT_MONTH' | 'NEXT_MONTH' | 'CURRENT_QUARTER' | 'NEXT_QUARTER';

export type FuturesOrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_MARKET';

export type EntryOrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT_MARKET';

export interface FuturesSymbolInfo {
  symbol: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: FuturesContractType;
  deliveryDate: number;
  onboardDate: number;
  status: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
  maxLeverage: number;
  maintMarginPercent: string;
  requiredMarginPercent: string;
  underlyingType: string;
  underlyingSubType: string[];
}

export interface FuturesPosition {
  symbol: string;
  positionSide: PositionSide | 'BOTH';
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  liquidationPrice: string;
  leverage: number;
  marginType: MarginType;
  isolatedMargin?: string;
  notional?: string;
  isolatedWallet?: string;
  updateTime?: number;
}

export interface FuturesAccount {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: FuturesAccountAsset[];
  positions: FuturesPosition[];
}

export interface FuturesAccountAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

export interface FuturesOrder {
  orderId: string;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: 'BUY' | 'SELL';
  positionSide: PositionSide | 'BOTH';
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  time: number;
  updateTime: number;
}

export interface FuturesLeverage {
  leverage: number;
  maxNotionalValue: string;
  symbol: string;
}

export interface FuturesMarginTypeResponse {
  code: number;
  msg: string;
}

export interface FundingRateInfo {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice?: string;
}

export interface FuturesTradeConfig {
  marketType: MarketType;
  leverage: number;
  marginType: MarginType;
  reduceOnly?: boolean;
}

export interface FuturesBacktestConfig {
  marketType: 'FUTURES';
  leverage: number;
  marginType: MarginType;
  simulateFundingRates: boolean;
  simulateLiquidation: boolean;
  makerFeePercent?: number;
  takerFeePercent?: number;
}

export interface FuturesBacktestTrade {
  fundingPayments?: number;
  totalFunding?: number;
  liquidationFee?: number;
  liquidationPrice?: number;
  leverage?: number;
  marginType?: MarginType;
  isLiquidated?: boolean;
}

export const FUTURES_DEFAULTS = {
  LEVERAGE: 1,
  MARGIN_TYPE: 'ISOLATED' as MarginType,
  TAKER_FEE: BINANCE_FEES.FUTURES.VIP_0.taker,
  MAKER_FEE: BINANCE_FEES.FUTURES.VIP_0.maker,
  LIQUIDATION_FEE: 0.015,
  MAINTENANCE_MARGIN_RATE: 0.004,
} as const;

export interface MaintenanceMarginBracket {
  notionalFloor: number;
  notionalCap: number;
  maintMarginRatio: number;
  cum: number;
}

/**
 * Binance USDT-M default maintenance-margin brackets (paper-wallet table).
 * Real per-symbol brackets come from `/fapi/v1/leverageBracket`; this is the
 * fallback when live brackets are unavailable (paper wallets, pre-trade
 * estimates before the symbol's brackets are fetched).
 */
export const DEFAULT_MAINTENANCE_MARGIN_BRACKETS: MaintenanceMarginBracket[] = [
  { notionalFloor: 0, notionalCap: 50_000, maintMarginRatio: 0.004, cum: 0 },
  { notionalFloor: 50_000, notionalCap: 250_000, maintMarginRatio: 0.005, cum: 50 },
  { notionalFloor: 250_000, notionalCap: 1_000_000, maintMarginRatio: 0.01, cum: 1_300 },
];

export const selectMaintenanceMarginBracket = (
  notional: number,
  brackets: MaintenanceMarginBracket[] = DEFAULT_MAINTENANCE_MARGIN_BRACKETS
): MaintenanceMarginBracket => {
  const sorted = [...brackets].sort((a, b) => a.notionalFloor - b.notionalFloor);
  let selected = sorted[0] ?? DEFAULT_MAINTENANCE_MARGIN_BRACKETS[0]!;
  for (const bracket of sorted) {
    if (notional >= bracket.notionalFloor) selected = bracket;
  }
  return selected;
};

export interface LiquidationPriceParams {
  entryPrice: number;
  quantity: number;
  leverage: number;
  side: PositionSide;
  /** Per-symbol brackets; defaults to the Binance USDT-M default table. */
  brackets?: MaintenanceMarginBracket[];
  /** Isolated margin allocated to the position; defaults to notional / leverage. */
  walletBalance?: number;
}

/**
 * Binance USDT-M isolated-margin liquidation price.
 *
 * Liquidation happens when margin balance == maintenance margin:
 *   isolatedMargin + unrealizedPnL = notional_at_liq * MMR - cum
 * Solving for the liquidation price yields:
 *   LONG:  (isolatedMargin - qty*EP + cum) / (qty * (MMR - 1))
 *   SHORT: (isolatedMargin + qty*EP + cum) / (qty * (MMR + 1))
 * where MMR / cum are the maintenance-margin bracket selected by notional.
 */
export const calculateLiquidationPrice = (params: LiquidationPriceParams): number => {
  const { entryPrice, quantity, leverage, side, brackets, walletBalance } = params;
  if (entryPrice <= 0 || quantity <= 0 || leverage <= 0) return 0;

  const notional = quantity * entryPrice;
  const { maintMarginRatio, cum } = selectMaintenanceMarginBracket(notional, brackets);
  const isolatedMargin = walletBalance ?? notional / leverage;

  const liquidationPrice = side === 'LONG'
    ? (isolatedMargin - notional + cum) / (quantity * (maintMarginRatio - 1))
    : (isolatedMargin + notional + cum) / (quantity * (maintMarginRatio + 1));

  return liquidationPrice > 0 ? liquidationPrice : 0;
};

export const calculateLeveragedPnl = (
  entryPrice: number,
  exitPrice: number,
  leverage: number,
  side: PositionSide
): { pnlPercent: number; leveragedPnlPercent: number } => {
  const pnlPercent = side === 'LONG'
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;

  return {
    pnlPercent,
    leveragedPnlPercent: pnlPercent * leverage,
  };
};

export const calculateFundingPayment = (
  positionValue: number,
  fundingRate: number,
  side: PositionSide
): number => {
  const payment = positionValue * (fundingRate / 100);
  return side === 'LONG' ? -payment : payment;
};

export const wouldLiquidate = (
  currentPrice: number,
  liquidationPrice: number,
  side: PositionSide
): boolean => {
  return side === 'LONG'
    ? currentPrice <= liquidationPrice
    : currentPrice >= liquidationPrice;
};
