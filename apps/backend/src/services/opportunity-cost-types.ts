export interface OpportunityCostConfig {
  opportunityCostEnabled: boolean;
  maxHoldingPeriodBars: number;
  stalePriceThresholdPercent: number;
  staleTradeAction: 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE';
  timeBasedStopTighteningEnabled: boolean;
  timeTightenAfterBars: number;
  timeTightenPercentPerBar: number;
}

export interface StaleTradeCheck {
  executionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  barsInTrade: number;
  priceMovementPercent: number;
  isStale: boolean;
  profitPercent: number;
  currentPrice: number;
  recommendedAction: 'NONE' | 'ALERT' | 'TIGHTEN' | 'CLOSE';
  newStopLoss?: number;
  reason?: string;
}

export interface BarIncrementResult {
  executionId: string;
  newBarsInTrade: number;
  priceMovementPercent: number;
  significantMovement: boolean;
}

export const parseNumeric = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return parseFloat(value);
};

export const calculatePriceMovementPercent = (
  entryPrice: number,
  highestPrice: number,
  lowestPrice: number,
  side: 'LONG' | 'SHORT',
): number => {
  if (entryPrice === 0) return 0;

  if (side === 'LONG') {
    const upMove = ((highestPrice - entryPrice) / entryPrice) * 100;
    const downMove = ((entryPrice - lowestPrice) / entryPrice) * 100;
    return Math.max(upMove, downMove);
  } else {
    const downMove = ((entryPrice - lowestPrice) / entryPrice) * 100;
    const upMove = ((highestPrice - entryPrice) / entryPrice) * 100;
    return Math.max(downMove, upMove);
  }
};

export const calculateProfitPercent = (
  entryPrice: number,
  currentPrice: number,
  side: 'LONG' | 'SHORT',
): number => {
  if (entryPrice === 0) return 0;

  if (side === 'LONG') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
};
