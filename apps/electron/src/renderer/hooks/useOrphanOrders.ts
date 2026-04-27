import { useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';
import {
  classifyExchangeOrders,
  type ExchangeAlgoRow,
  type ExchangeOrderRow,
  type ExecutionWithOrderIds,
  type OrphanOrderEntry,
} from './orphanOrdersClassifier';

const ORPHAN_POLLING_MS = 10_000;

export type OrphanOrder = OrphanOrderEntry;

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

  const { orphanOrders, trackedOrders } = useMemo(
    () =>
      classifyExchangeOrders(
        backendExecutions ?? [],
        (exchangeOpenOrders ?? []) as ExchangeOrderRow[],
        (exchangeAlgoOrders ?? []) as ExchangeAlgoRow[],
        dbOrderIds ?? [],
      ),
    [backendExecutions, exchangeOpenOrders, exchangeAlgoOrders, dbOrderIds],
  );

  return {
    orphanOrders,
    trackedOrders,
    isLoading: isLoadingOrders || isLoadingAlgo,
    exchangeOpenOrders,
    exchangeAlgoOrders,
  };
};
