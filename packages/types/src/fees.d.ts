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
export declare const BINANCE_FEES: {
    readonly SPOT: {
        readonly VIP_0: MarketFees;
    };
    readonly FUTURES: {
        readonly VIP_0: MarketFees;
    };
    readonly BNB_DISCOUNT: 0.25;
    readonly MIN_NOTIONAL_VALUE: 10;
};
export declare const BINANCE_DEFAULT_FEES: {
    readonly VIP_0_MAKER: 0.001;
    readonly VIP_0_TAKER: 0.001;
    readonly BNB_DISCOUNT: 0.25;
    readonly MIN_NOTIONAL_VALUE: 10;
};
export declare const getDefaultFee: (marketType: "SPOT" | "FUTURES", orderType?: FeeOrderType) => number;
export declare const applyBnbDiscount: (fee: number) => number;
export declare const TRADING_THRESHOLDS: {
    readonly MIN_PROFIT_AFTER_FEES: 0.005;
    readonly MIN_RISK_REWARD_AFTER_FEES: 2;
    readonly MIN_POSITION_VALUE: 10;
};
export declare const BINANCE_SPOT_VIP_LEVELS: readonly [{
    readonly level: 0;
    readonly commissionBps: 100;
    readonly maker: 0.001;
    readonly taker: 0.001;
}, {
    readonly level: 1;
    readonly commissionBps: 90;
    readonly maker: 0.0009;
    readonly taker: 0.001;
}, {
    readonly level: 2;
    readonly commissionBps: 80;
    readonly maker: 0.0008;
    readonly taker: 0.001;
}, {
    readonly level: 3;
    readonly commissionBps: 60;
    readonly maker: 0.0006;
    readonly taker: 0.0009;
}, {
    readonly level: 4;
    readonly commissionBps: 40;
    readonly maker: 0.0004;
    readonly taker: 0.0008;
}, {
    readonly level: 5;
    readonly commissionBps: 20;
    readonly maker: 0.0002;
    readonly taker: 0.0006;
}, {
    readonly level: 6;
    readonly commissionBps: 12;
    readonly maker: 0.00012;
    readonly taker: 0.0004;
}, {
    readonly level: 7;
    readonly commissionBps: 10;
    readonly maker: 0.0001;
    readonly taker: 0.0003;
}, {
    readonly level: 8;
    readonly commissionBps: 8;
    readonly maker: 0.00008;
    readonly taker: 0.00024;
}, {
    readonly level: 9;
    readonly commissionBps: 4;
    readonly maker: 0.00004;
    readonly taker: 0.00018;
}];
export declare const BINANCE_FUTURES_VIP_LEVELS: readonly [{
    readonly level: 0;
    readonly maker: 0.0002;
    readonly taker: 0.0004;
}, {
    readonly level: 1;
    readonly maker: 0.00016;
    readonly taker: 0.0004;
}, {
    readonly level: 2;
    readonly maker: 0.00014;
    readonly taker: 0.00035;
}, {
    readonly level: 3;
    readonly maker: 0.00012;
    readonly taker: 0.00032;
}, {
    readonly level: 4;
    readonly maker: 0.0001;
    readonly taker: 0.0003;
}, {
    readonly level: 5;
    readonly maker: 0.00008;
    readonly taker: 0.00027;
}, {
    readonly level: 6;
    readonly maker: 0.00006;
    readonly taker: 0.00025;
}, {
    readonly level: 7;
    readonly maker: 0.00004;
    readonly taker: 0.00022;
}, {
    readonly level: 8;
    readonly maker: 0.00002;
    readonly taker: 0.0002;
}, {
    readonly level: 9;
    readonly maker: 0;
    readonly taker: 0.00017;
}];
export declare const BINANCE_VIP_LEVELS: readonly [{
    readonly level: 0;
    readonly commissionBps: 100;
    readonly maker: 0.001;
    readonly taker: 0.001;
}, {
    readonly level: 1;
    readonly commissionBps: 90;
    readonly maker: 0.0009;
    readonly taker: 0.001;
}, {
    readonly level: 2;
    readonly commissionBps: 80;
    readonly maker: 0.0008;
    readonly taker: 0.001;
}, {
    readonly level: 3;
    readonly commissionBps: 60;
    readonly maker: 0.0006;
    readonly taker: 0.0009;
}, {
    readonly level: 4;
    readonly commissionBps: 40;
    readonly maker: 0.0004;
    readonly taker: 0.0008;
}, {
    readonly level: 5;
    readonly commissionBps: 20;
    readonly maker: 0.0002;
    readonly taker: 0.0006;
}, {
    readonly level: 6;
    readonly commissionBps: 12;
    readonly maker: 0.00012;
    readonly taker: 0.0004;
}, {
    readonly level: 7;
    readonly commissionBps: 10;
    readonly maker: 0.0001;
    readonly taker: 0.0003;
}, {
    readonly level: 8;
    readonly commissionBps: 8;
    readonly maker: 0.00008;
    readonly taker: 0.00024;
}, {
    readonly level: 9;
    readonly commissionBps: 4;
    readonly maker: 0.00004;
    readonly taker: 0.00018;
}];
export declare const getVIPLevelFromCommission: (commissionBps: number) => number;
export declare const getTradingThresholds: (fees?: TradingFees) => {
    MIN_PROFIT_AFTER_FEES: number;
    MIN_RISK_REWARD_AFTER_FEES: number;
    MIN_POSITION_VALUE: number;
};
export declare const getFeeRateForVipLevel: (marketType: MarketType, vipLevel?: number, orderType?: FeeOrderType) => number;
export declare const getRoundTripFee: (params: FeeParams) => number;
export declare const calculateTotalFees: (entryValue: number, exitValue: number, params: FeeParams) => {
    entryFee: number;
    exitFee: number;
    totalFees: number;
};
//# sourceMappingURL=fees.d.ts.map