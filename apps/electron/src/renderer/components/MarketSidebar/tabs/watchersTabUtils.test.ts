import type { MarketType } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { formatSuggestionPrice, sortWatchers, type WatcherSortable } from './watchersTabUtils';

const mk = (overrides: Partial<WatcherSortable>): WatcherSortable => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  marketType: 'FUTURES' as MarketType,
  profileName: undefined,
  ...overrides,
});

describe('sortWatchers', () => {
  const watchers = [
    mk({ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', profileName: 'Conservative' }),
    mk({ symbol: 'AAVEUSDT', interval: '4h', marketType: 'SPOT', profileName: 'Aggressive' }),
    mk({ symbol: 'XRPUSDT', interval: '15m', marketType: 'FUTURES', profileName: undefined }),
  ];

  it('symbol asc sorts alphabetically', () => {
    const out = sortWatchers(watchers, 'symbol', 'asc');
    expect(out.map((w) => w.symbol)).toEqual(['AAVEUSDT', 'BTCUSDT', 'XRPUSDT']);
  });

  it('symbol desc sorts reverse alphabetically', () => {
    const out = sortWatchers(watchers, 'symbol', 'desc');
    expect(out.map((w) => w.symbol)).toEqual(['XRPUSDT', 'BTCUSDT', 'AAVEUSDT']);
  });

  it('interval sorts lexicographically (this is by design — matches current UI)', () => {
    // localeCompare on strings — "15m" < "1h" < "4h" lexicographically
    const out = sortWatchers(watchers, 'interval', 'asc');
    expect(out.map((w) => w.interval)).toEqual(['15m', '1h', '4h']);
  });

  it('type asc puts FUTURES before SPOT (alphabetical)', () => {
    const out = sortWatchers(watchers, 'type', 'asc');
    expect(out.map((w) => w.marketType).filter((t, i, arr) => arr.indexOf(t) === i)).toEqual(['FUTURES', 'SPOT']);
  });

  it('profile asc treats undefined profileName as empty string (sorts first)', () => {
    const out = sortWatchers(watchers, 'profile', 'asc');
    // undefined → '' → '' < 'Aggressive' < 'Conservative'
    expect(out[0]?.profileName).toBeUndefined();
    expect(out[1]?.profileName).toBe('Aggressive');
    expect(out[2]?.profileName).toBe('Conservative');
  });

  it('profile desc reverses', () => {
    const out = sortWatchers(watchers, 'profile', 'desc');
    expect(out.map((w) => w.profileName)).toEqual(['Conservative', 'Aggressive', undefined]);
  });

  it('unknown sortKey is a no-op (preserves input order)', () => {
    const out = sortWatchers(watchers, 'unknown-key', 'asc');
    expect(out.map((w) => w.symbol)).toEqual(['BTCUSDT', 'AAVEUSDT', 'XRPUSDT']);
  });

  it('does not mutate the input', () => {
    const original = [...watchers];
    sortWatchers(watchers, 'symbol', 'desc');
    expect(watchers).toEqual(original);
  });

  it('handles empty input', () => {
    expect(sortWatchers([], 'symbol', 'asc')).toEqual([]);
  });
});

describe('formatSuggestionPrice', () => {
  it('prices >= 1 format with 2 decimals', () => {
    expect(formatSuggestionPrice('50000')).toBe('50000.00');
    expect(formatSuggestionPrice('1.5')).toBe('1.50');
    expect(formatSuggestionPrice('1')).toBe('1.00');
  });

  it('prices < 1 format with 4 significant figures', () => {
    expect(formatSuggestionPrice('0.5')).toBe('0.5000');
    expect(formatSuggestionPrice('0.001234567')).toBe('0.001235');
  });

  it('handles zero', () => {
    expect(formatSuggestionPrice('0')).toBe('0.000');
  });

  it('handles a stringified very-small price (4 sig figs)', () => {
    expect(formatSuggestionPrice('0.000012367')).toBe('0.00001237');
  });
});
