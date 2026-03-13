export const checkStopLossAndTakeProfit = (
  direction: 'LONG' | 'SHORT',
  high: number,
  low: number,
  open: number,
  close: number,
  stopLoss: number | undefined,
  takeProfit: number | undefined
): { hit: 'SL' | 'TP' | 'BOTH' | null; price: number | undefined } => {
  const slHit = stopLoss && (
    (direction === 'LONG' && low <= stopLoss) ||
    (direction === 'SHORT' && high >= stopLoss)
  );

  const tpHit = takeProfit && (
    (direction === 'LONG' && high >= takeProfit) ||
    (direction === 'SHORT' && low <= takeProfit)
  );

  if (slHit && tpHit) {
    const isBullishCandle = close > open;
    if (direction === 'LONG') {
      return {
        hit: isBullishCandle ? 'TP' : 'SL',
        price: isBullishCandle ? takeProfit : stopLoss,
      };
    } else {
      return {
        hit: isBullishCandle ? 'SL' : 'TP',
        price: isBullishCandle ? stopLoss : takeProfit,
      };
    }
  } else if (slHit) {
    return { hit: 'SL', price: stopLoss };
  } else if (tpHit) {
    return { hit: 'TP', price: takeProfit };
  }

  return { hit: null, price: undefined };
};

export const applySlippage = (
  exitPrice: number,
  exitReason: string,
  direction: 'LONG' | 'SHORT',
  slippagePercent: number = 0.1
): number => {
  if (exitReason !== 'STOP_LOSS' && exitReason !== 'TAKE_PROFIT') return exitPrice;

  const slippageAmount = exitPrice * (slippagePercent / 100);
  return direction === 'LONG'
    ? exitPrice - slippageAmount
    : exitPrice + slippageAmount;
};
