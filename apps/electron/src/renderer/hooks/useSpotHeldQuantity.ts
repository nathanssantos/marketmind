import { trpc } from '@renderer/utils/trpc';
import { useMemo } from 'react';
import { useActiveWallet } from './useActiveWallet';

const EXECUTIONS_QUERY_LIMIT = 100;

export const useSpotHeldQuantity = (symbol: string, enabled: boolean): number => {
  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id;

  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', limit: EXECUTIONS_QUERY_LIMIT },
    { enabled: enabled && !!walletId },
  );

  return useMemo(
    () =>
      (tradeExecutions ?? [])
        .filter((e) => e.symbol === symbol && e.status === 'open' && e.side === 'LONG' && e.marketType === 'SPOT')
        .reduce((sum, e) => sum + parseFloat(e.quantity), 0),
    [tradeExecutions, symbol],
  );
};
