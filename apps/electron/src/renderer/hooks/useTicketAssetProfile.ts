import type { ExchangeId, MarketType } from '@marketmind/types';
import { useMemo } from 'react';
import { useActiveWallet } from './useActiveWallet';

export type TicketAssetKind = 'CRYPTO_SPOT' | 'CRYPTO_FUTURES' | 'STOCKS';

export interface TicketAssetProfile {
  kind: TicketAssetKind;
  exchange: ExchangeId;
  marketType: MarketType;
  isSpot: boolean;
  isFutures: boolean;
  isStocks: boolean;
  showsLeverage: boolean;
  showsMargin: boolean;
  showsLiquidation: boolean;
  showsFunding: boolean;
  wholeUnitsOnly: boolean;
  quoteCurrency: string;
  sellOnlyWhatIsHeld: boolean;
}

const STOCK_QUOTE_CURRENCY = 'USD';
const DEFAULT_QUOTE_CURRENCY = 'USDT';

export const buildTicketAssetProfile = (exchange: ExchangeId, marketType: MarketType, walletCurrency: string | null | undefined): TicketAssetProfile => {
  if (exchange === 'INTERACTIVE_BROKERS') {
    return {
      kind: 'STOCKS',
      exchange,
      marketType: 'SPOT',
      isSpot: true,
      isFutures: false,
      isStocks: true,
      showsLeverage: false,
      showsMargin: true,
      showsLiquidation: false,
      showsFunding: false,
      wholeUnitsOnly: true,
      quoteCurrency: STOCK_QUOTE_CURRENCY,
      sellOnlyWhatIsHeld: false,
    };
  }

  const isFutures = marketType === 'FUTURES';
  return {
    kind: isFutures ? 'CRYPTO_FUTURES' : 'CRYPTO_SPOT',
    exchange,
    marketType,
    isSpot: !isFutures,
    isFutures,
    isStocks: false,
    showsLeverage: isFutures,
    showsMargin: isFutures,
    showsLiquidation: isFutures,
    showsFunding: isFutures,
    wholeUnitsOnly: false,
    quoteCurrency: walletCurrency ?? DEFAULT_QUOTE_CURRENCY,
    sellOnlyWhatIsHeld: !isFutures,
  };
};

export const useTicketAssetProfile = (marketType: MarketType): TicketAssetProfile => {
  const { activeWallet, exchangeId } = useActiveWallet();
  const walletCurrency = activeWallet?.currency;
  return useMemo(() => buildTicketAssetProfile(exchangeId, marketType, walletCurrency), [exchangeId, marketType, walletCurrency]);
};
