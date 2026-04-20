import { useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';

const ORPHAN_POLLING_MS = 10_000;

export interface OrphanOrder {
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

interface ExecutionWithOrderIds {
  entryOrderId?: string | null;
  stopLossOrderId?: string | null;
  stopLossAlgoId?: string | null;
  takeProfitOrderId?: string | null;
  takeProfitAlgoId?: string | null;
  trailingStopAlgoId?: string | null;
}

const buildTrackedOrderIds = (executions: ExecutionWithOrderIds[]): Set<string> =>
  new Set(
    executions.flatMap((e) => {
      const ids: string[] = [];
      if (e.entryOrderId) ids.push(e.entryOrderId);
      if (e.stopLossOrderId) ids.push(e.stopLossOrderId);
      if (e.stopLossAlgoId) ids.push(e.stopLossAlgoId);
      if (e.takeProfitOrderId) ids.push(e.takeProfitOrderId);
      if (e.takeProfitAlgoId) ids.push(e.takeProfitAlgoId);
      if (e.trailingStopAlgoId) ids.push(e.trailingStopAlgoId);
      return ids;
    })
  );

export const useOrphanOrders = (
  walletId: string,
  backendExecutions: ExecutionWithOrderIds[],
  symbol?: string
) => {
  const polling = usePollingInterval(ORPHAN_POLLING_MS);
  const enabled = !!walletId;

  const openOrdersInput = symbol ? { walletId, symbol } : { walletId };
  const algoOrdersInput = symbol ? { walletId, symbol } : { walletId };

  const { data: exchangeOpenOrders, isLoading: isLoadingOrders } =
    trpc.futuresTrading.getOpenOrders.useQuery(openOrdersInput, {
      enabled,
      refetchInterval: polling,
      staleTime: ORPHAN_POLLING_MS,
    });

  const { data: exchangeAlgoOrders, isLoading: isLoadingAlgo } =
    trpc.futuresTrading.getOpenAlgoOrders.useQuery(algoOrdersInput, {
      enabled,
      refetchInterval: polling,
      staleTime: ORPHAN_POLLING_MS,
    });

  const { data: dbOrderIds } = trpc.futuresTrading.getOpenDbOrderIds.useQuery(
    { walletId },
    { enabled, refetchInterval: polling, staleTime: ORPHAN_POLLING_MS }
  );

  const { orphanOrders, trackedOrders } = useMemo(() => {
    const executionOrderIds = buildTrackedOrderIds(backendExecutions ?? []);
    const dbIdSet = new Set(dbOrderIds ?? []);
    const orphans: OrphanOrder[] = [];
    const tracked: OrphanOrder[] = [];

    for (const order of exchangeOpenOrders ?? []) {
      const oid = order.orderId;
      if (executionOrderIds.has(oid)) continue;
      const entry: OrphanOrder = {
        id: `exchange-order-${oid}`,
        exchangeOrderId: oid,
        isAlgo: false,
        symbol: String(order.symbol),
        side: order.side,
        type: String(order.type),
        price: String(order.price),
        quantity: String(order.origQty),
        createdAt: order.time ? new Date(Number(order.time)) : null,
      };
      if (dbIdSet.has(oid)) { tracked.push(entry); continue; }
      orphans.push(entry);
    }

    for (const algo of exchangeAlgoOrders ?? []) {
      const aid = algo.algoId;
      if (executionOrderIds.has(aid)) continue;
      const entry: OrphanOrder = {
        id: `exchange-algo-${aid}`,
        exchangeOrderId: aid,
        isAlgo: true,
        symbol: String(algo.symbol),
        side: algo.side,
        type: String(algo.type),
        price: String((algo as { triggerPrice?: string }).triggerPrice ?? '0'),
        quantity: String(algo.quantity ?? '0'),
        createdAt: algo.createTime ? new Date(Number(algo.createTime)) : null,
      };
      if (dbIdSet.has(aid)) { tracked.push(entry); continue; }
      orphans.push(entry);
    }

    return { orphanOrders: orphans, trackedOrders: tracked };
  }, [backendExecutions, exchangeOpenOrders, exchangeAlgoOrders, dbOrderIds]);

  return {
    orphanOrders,
    trackedOrders,
    isLoading: isLoadingOrders || isLoadingAlgo,
    exchangeOpenOrders,
    exchangeAlgoOrders,
  };
};
