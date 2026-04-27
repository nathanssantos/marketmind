import type { MarketType } from '@marketmind/types';

export interface WatcherSortable {
  symbol: string;
  interval: string;
  marketType: MarketType;
  profileName?: string;
}

export type WatcherSortKey = 'symbol' | 'interval' | 'type' | 'profile' | string;
export type WatcherSortDirection = 'asc' | 'desc';

export const sortWatchers = <T extends WatcherSortable>(
  watchers: T[],
  sortKey: WatcherSortKey,
  sortDirection: WatcherSortDirection,
): T[] => {
  return [...watchers].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'symbol':
        return dir * a.symbol.localeCompare(b.symbol);
      case 'interval':
        return dir * a.interval.localeCompare(b.interval);
      case 'type':
        return dir * a.marketType.localeCompare(b.marketType);
      case 'profile':
        return dir * (a.profileName ?? '').localeCompare(b.profileName ?? '');
      default:
        return 0;
    }
  });
};

/**
 * Suggestion entry-price display formatter.
 * - Prices >= 1: 2 decimals (e.g. 50000 → "50000.00", 1.5 → "1.50")
 * - Prices < 1: 4 significant figures (e.g. 0.5 → "0.5000", 0.00001234 → "0.00001234")
 */
export const formatSuggestionPrice = (price: string): string => {
  const num = Number(price);
  return num >= 1 ? num.toFixed(2) : num.toPrecision(4);
};
