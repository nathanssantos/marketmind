export type MarketType = 'SPOT' | 'FUTURES';
export type MarginType = 'ISOLATED' | 'CROSSED';
export type FuturesContractType = 'PERPETUAL' | 'CURRENT_MONTH' | 'NEXT_MONTH' | 'CURRENT_QUARTER' | 'NEXT_QUARTER';
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
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
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
    orderId: number;
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
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
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
export declare const FUTURES_DEFAULTS: {
    readonly LEVERAGE: 1;
    readonly MARGIN_TYPE: MarginType;
    readonly TAKER_FEE: number;
    readonly MAKER_FEE: number;
    readonly LIQUIDATION_FEE: 0.015;
    readonly MAINTENANCE_MARGIN_RATE: 0.004;
};
export declare const calculateLiquidationPrice: (entryPrice: number, leverage: number, side: "LONG" | "SHORT", maintenanceMarginRate?: number, liquidationFee?: number) => number;
export declare const calculateLeveragedPnl: (entryPrice: number, exitPrice: number, leverage: number, side: "LONG" | "SHORT") => {
    pnlPercent: number;
    leveragedPnlPercent: number;
};
export declare const calculateFundingPayment: (positionValue: number, fundingRate: number, side: "LONG" | "SHORT") => number;
export declare const wouldLiquidate: (currentPrice: number, liquidationPrice: number, side: "LONG" | "SHORT") => boolean;
//# sourceMappingURL=futures.d.ts.map