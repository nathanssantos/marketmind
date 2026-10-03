import type { MarketType, PositionSide } from '@marketmind/types';
import { badRequest } from './trpc-errors';

export const isDirectionAllowed = (
  directionMode: 'auto' | 'long_only' | 'short_only' | undefined,
  direction: PositionSide,
): boolean => {
  if (directionMode === 'long_only' && direction === 'SHORT') return false;
  if (directionMode === 'short_only' && direction === 'LONG') return false;
  return true;
};

export const isSideAllowedOnMarket = (marketType: MarketType | null | undefined, side: PositionSide): boolean =>
  !(marketType === 'SPOT' && side === 'SHORT');

export const assertSideAllowedOnMarket = (marketType: MarketType | null | undefined, side: PositionSide): void => {
  if (!isSideAllowedOnMarket(marketType, side)) throw badRequest('Spot wallets cannot open short positions');
};

export const assertFuturesWallet = (wallet: { marketType: MarketType | null }): void => {
  if (wallet.marketType === 'SPOT') throw badRequest('Spot wallets cannot trade futures');
};
