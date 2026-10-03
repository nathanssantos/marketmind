import type { MarketType, PositionSide } from '@marketmind/types';
import { useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { useActiveWallet } from './useActiveWallet';

export const OPEN_EXECUTIONS_QUERY_INPUT = { status: 'open', limit: 500 } as const;

export interface SymbolOpenPosition {
  side: PositionSide;
  quantity: number;
}

export const useSymbolOpenPosition = (symbol: string, marketType: MarketType): SymbolOpenPosition | null => {
  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id;

  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', ...OPEN_EXECUTIONS_QUERY_INPUT },
    { enabled: !!walletId },
  );

  return useMemo(() => {
    const open = (tradeExecutions ?? []).filter((e) => e.symbol === symbol && (e.marketType ?? 'FUTURES') === marketType);
    if (open.length === 0) return null;
    const side = open[0]!.side;
    const quantity = open.filter((e) => e.side === side).reduce((sum, e) => sum + parseFloat(e.quantity), 0);
    return quantity > 0 ? { side, quantity } : null;
  }, [tradeExecutions, symbol, marketType]);
};
