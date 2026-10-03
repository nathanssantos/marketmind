import type { MarketType } from '@marketmind/types';
import { QUERY_CONFIG } from '@shared/constants';
import { useUIStore } from '../store/uiStore';
import { trpc } from '../utils/trpc';

const DEFAULT_MARKET_TYPE: MarketType = 'FUTURES';

export const useTradingMarketType = (chartMarketType: MarketType | undefined): MarketType => {
  const activeWalletId = useUIStore((s) => s.activeWalletId);

  const { data: walletMarketType } = trpc.wallet.list.useQuery(undefined, {
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    select: (wallets) => (wallets.find((w) => w.id === activeWalletId) ?? wallets[0])?.marketType ?? null,
  });

  return walletMarketType ?? chartMarketType ?? DEFAULT_MARKET_TYPE;
};
