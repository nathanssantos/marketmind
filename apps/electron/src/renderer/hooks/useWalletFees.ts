import type { MarketType } from '@marketmind/types';
import { BINANCE_FEES } from '@marketmind/types';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

export interface WalletFeeRates {
  maker: number;
  taker: number;
  vipLevel: number;
  hasBnbDiscount: boolean;
  isLoaded: boolean;
}

const publishedRates = (marketType: MarketType): WalletFeeRates => ({
  ...(marketType === 'FUTURES' ? BINANCE_FEES.FUTURES.VIP_0 : BINANCE_FEES.SPOT.VIP_0),
  vipLevel: 0,
  hasBnbDiscount: false,
  isLoaded: false,
});

export const useWalletFees = (walletId: string | undefined, marketType: MarketType): WalletFeeRates => {
  const { data } = trpc.fees.forWallet.useQuery(
    { walletId: walletId ?? '' },
    { enabled: !!walletId, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM },
  );

  if (!data) return publishedRates(marketType);

  const rates = marketType === 'FUTURES' ? data.futures : data.spot;
  return { maker: rates.maker, taker: rates.taker, vipLevel: data.vipLevel, hasBnbDiscount: data.hasBnbDiscount, isLoaded: true };
};
