import type { MaintenanceMarginBracket } from '@marketmind/types';
import { useMemo } from 'react';
import { useActiveWallet } from './useActiveWallet';
import { useIsCustomSymbol } from './useIsCustomSymbol';
import { trpc } from '../utils/trpc';

export const useLeverageBrackets = (
  symbol: string | undefined,
  isFutures: boolean,
): MaintenanceMarginBracket[] | undefined => {
  const { activeWallet } = useActiveWallet();
  const isCustomSymbol = useIsCustomSymbol(symbol);

  const { data } = trpc.futuresTrading.getLeverageBrackets.useQuery(
    { walletId: activeWallet?.id ?? '', symbol: symbol ?? '' },
    {
      enabled: !!activeWallet?.id && !!symbol && isFutures && !isCustomSymbol,
      staleTime: 60 * 60 * 1000,
      retry: 1,
    },
  );

  return useMemo(
    () =>
      data?.map((b) => ({
        notionalFloor: b.notionalFloor,
        notionalCap: b.notionalCap,
        maintMarginRatio: b.maintMarginRatio,
        cum: b.cum,
      })),
    [data],
  );
};
