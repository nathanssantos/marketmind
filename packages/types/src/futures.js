import { BINANCE_FEES } from './fees';
export const FUTURES_DEFAULTS = {
    LEVERAGE: 1,
    MARGIN_TYPE: 'ISOLATED',
    TAKER_FEE: BINANCE_FEES.FUTURES.VIP_0.taker,
    MAKER_FEE: BINANCE_FEES.FUTURES.VIP_0.maker,
    LIQUIDATION_FEE: 0.015,
    MAINTENANCE_MARGIN_RATE: 0.004,
};
export const calculateLiquidationPrice = (entryPrice, leverage, side, maintenanceMarginRate = FUTURES_DEFAULTS.MAINTENANCE_MARGIN_RATE, liquidationFee = FUTURES_DEFAULTS.LIQUIDATION_FEE) => {
    const buffer = maintenanceMarginRate + liquidationFee;
    return side === 'LONG'
        ? entryPrice * (1 - 1 / leverage + buffer)
        : entryPrice * (1 + 1 / leverage - buffer);
};
export const calculateLeveragedPnl = (entryPrice, exitPrice, leverage, side) => {
    const pnlPercent = side === 'LONG'
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100;
    return {
        pnlPercent,
        leveragedPnlPercent: pnlPercent * leverage,
    };
};
export const calculateFundingPayment = (positionValue, fundingRate, side) => {
    const payment = positionValue * (fundingRate / 100);
    return side === 'LONG' ? -payment : payment;
};
export const wouldLiquidate = (currentPrice, liquidationPrice, side) => {
    return side === 'LONG'
        ? currentPrice <= liquidationPrice
        : currentPrice >= liquidationPrice;
};
