export interface ExecutionWithOrderIds {
  entryOrderId?: string | null;
  stopLossOrderId?: string | null;
  stopLossAlgoId?: string | null;
  takeProfitOrderId?: string | null;
  takeProfitAlgoId?: string | null;
  trailingStopAlgoId?: string | null;
}

export interface OrphanOrderEntry {
  id: string;
  exchangeOrderId: string;
  isAlgo: boolean;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: string;
  quantity: string;
  createdAt: Date | null;
}

export interface ExchangeOrderRow {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: string | number;
  origQty: string | number;
  time?: string | number | null;
}

export interface ExchangeAlgoRow {
  algoId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  triggerPrice?: string | number;
  quantity?: string | number;
  createTime?: string | number | null;
}

/**
 * Flatten the 6 order-id columns of a tradeExecution row into a single
 * Set. An exchange order whose id is in this set is considered "tracked
 * by an execution" — neither an orphan nor a generic tracked-by-DB row.
 *
 * Missing/null/empty ids are skipped. Adding a new tracked column to the
 * tradeExecutions schema MUST update this function or the new column's
 * orders will be misclassified as orphans.
 */
export const buildTrackedOrderIds = (executions: ExecutionWithOrderIds[]): Set<string> => {
  const out = new Set<string>();
  for (const e of executions) {
    if (e.entryOrderId) out.add(e.entryOrderId);
    if (e.stopLossOrderId) out.add(e.stopLossOrderId);
    if (e.stopLossAlgoId) out.add(e.stopLossAlgoId);
    if (e.takeProfitOrderId) out.add(e.takeProfitOrderId);
    if (e.takeProfitAlgoId) out.add(e.takeProfitAlgoId);
    if (e.trailingStopAlgoId) out.add(e.trailingStopAlgoId);
  }
  return out;
};

/**
 * Classify each exchange order into one of three buckets:
 *
 *   - skip:       exists in an execution → don't surface in either UI list
 *   - tracked:    exists in DB.orders but no execution links to it →
 *                 surface in "tracked" pane (manual entry orders, etc.)
 *   - orphan:     in neither executions NOR DB.orders → surface in
 *                 "orphan" pane (real cleanup target)
 *
 * Algo (STOP_MARKET / TAKE_PROFIT_MARKET) orders are tagged isAlgo=true so
 * cancellation routes correctly through cancelFuturesAlgoOrder rather than
 * the regular cancelOrder path.
 */
export const classifyExchangeOrders = (
  executions: ExecutionWithOrderIds[],
  exchangeOpenOrders: ExchangeOrderRow[],
  exchangeAlgoOrders: ExchangeAlgoRow[],
  dbOrderIds: string[],
): { orphanOrders: OrphanOrderEntry[]; trackedOrders: OrphanOrderEntry[] } => {
  const executionOrderIds = buildTrackedOrderIds(executions);
  const dbIdSet = new Set(dbOrderIds);
  const orphans: OrphanOrderEntry[] = [];
  const tracked: OrphanOrderEntry[] = [];

  for (const order of exchangeOpenOrders) {
    const oid = order.orderId;
    if (executionOrderIds.has(oid)) continue;
    const entry: OrphanOrderEntry = {
      id: `exchange-order-${oid}`,
      exchangeOrderId: oid,
      isAlgo: false,
      symbol: String(order.symbol),
      side: order.side,
      type: String(order.type),
      price: String(order.price),
      quantity: String(order.origQty),
      createdAt:
        order.time !== null && order.time !== undefined ? new Date(Number(order.time)) : null,
    };
    if (dbIdSet.has(oid)) tracked.push(entry);
    else orphans.push(entry);
  }

  for (const algo of exchangeAlgoOrders) {
    const aid = algo.algoId;
    if (executionOrderIds.has(aid)) continue;
    const entry: OrphanOrderEntry = {
      id: `exchange-algo-${aid}`,
      exchangeOrderId: aid,
      isAlgo: true,
      symbol: String(algo.symbol),
      side: algo.side,
      type: String(algo.type),
      price: String(algo.triggerPrice ?? '0'),
      quantity: String(algo.quantity ?? '0'),
      createdAt:
        algo.createTime !== null && algo.createTime !== undefined
          ? new Date(Number(algo.createTime))
          : null,
    };
    if (dbIdSet.has(aid)) tracked.push(entry);
    else orphans.push(entry);
  }

  return { orphanOrders: orphans, trackedOrders: tracked };
};
