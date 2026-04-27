import type { EntryOrderType, MarketType } from '@marketmind/types';

interface ExchangeExecutionLike {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: string;
  marketType?: MarketType | null;
  entryOrderType?: EntryOrderType | null;
}

interface BuildExchangeMoveResult {
  /** Optimistic execution row to add to the chart at the new price. */
  optimisticExecution: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: string;
    quantity: string;
    stopLoss: null;
    takeProfit: null;
    status: 'pending';
    setupType: null;
    marketType: MarketType;
    openedAt: Date;
    entryOrderType: EntryOrderType | null | undefined;
  };
  /** addBackendOrder payload for the new (replacement) order. */
  newOrderRequest: {
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    quantity: string;
    price?: string;
    stopPrice?: string;
    reduceOnly: true;
  };
}

/**
 * Build the optimistic execution + addBackendOrder payload for a chart drag
 * that moves an exchange-* order to a new price. The backend operation is
 * always cancel-then-create because Binance has no "amend price" for these
 * order types — but the chart represents the move as a single
 * optimistic-at-new-price record (replacing the old, which is hidden via
 * a `status: cancelled` optimistic patch in the renderer).
 *
 * Algo orders (STOP_MARKET / TAKE_PROFIT_MARKET) carry the price as
 * `stopPrice` rather than `price`. The original `entryOrderType` is
 * preserved when the input order is algo.
 */
export const buildExchangeMoveRequest = (
  exec: ExchangeExecutionLike,
  newPrice: string,
  isAlgo: boolean,
  optimisticIdSeed: number = Date.now(),
): BuildExchangeMoveResult => {
  const side = exec.side === 'LONG' ? ('BUY' as const) : ('SELL' as const);

  const orderType: BuildExchangeMoveResult['newOrderRequest']['type'] = isAlgo
    ? exec.entryOrderType === 'TAKE_PROFIT_MARKET'
      ? 'TAKE_PROFIT_MARKET'
      : 'STOP_MARKET'
    : 'LIMIT';

  return {
    optimisticExecution: {
      id: `opt-exchange-${optimisticIdSeed}`,
      symbol: exec.symbol,
      side: exec.side,
      entryPrice: newPrice,
      quantity: exec.quantity,
      stopLoss: null,
      takeProfit: null,
      status: 'pending',
      setupType: null,
      marketType: exec.marketType ?? 'FUTURES',
      openedAt: new Date(),
      entryOrderType: exec.entryOrderType ?? null,
    },
    newOrderRequest: {
      side,
      type: orderType,
      quantity: exec.quantity,
      ...(isAlgo ? { stopPrice: newPrice } : { price: newPrice }),
      reduceOnly: true,
    },
  };
};
