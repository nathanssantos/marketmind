import type { ScreenerFilterCondition } from '@marketmind/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenerStore } from './screenerStore';

const makeFilter = (id: string, value = 50): ScreenerFilterCondition => ({
  id,
  indicator: 'RSI',
  operator: 'ABOVE',
  value,
});

describe('screenerStore', () => {
  beforeEach(() => {
    useScreenerStore.setState({
      isScreenerOpen: false,
      activePresetId: null,
      customFilters: [],
      assetClass: 'CRYPTO',
      marketType: 'FUTURES',
      interval: '30m',
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    });
  });

  describe('open / close', () => {
    it('starts closed', () => {
      expect(useScreenerStore.getState().isScreenerOpen).toBe(false);
    });

    it('toggleScreener flips between open and closed', () => {
      const { toggleScreener } = useScreenerStore.getState();
      toggleScreener();
      expect(useScreenerStore.getState().isScreenerOpen).toBe(true);
      toggleScreener();
      expect(useScreenerStore.getState().isScreenerOpen).toBe(false);
    });

    it('setScreenerOpen(true) opens the modal', () => {
      useScreenerStore.getState().setScreenerOpen(true);
      expect(useScreenerStore.getState().isScreenerOpen).toBe(true);
    });
  });

  describe('customFilters', () => {
    it('addFilter appends to the list', () => {
      const { addFilter } = useScreenerStore.getState();
      addFilter(makeFilter('f1'));
      addFilter(makeFilter('f2'));
      expect(useScreenerStore.getState().customFilters.map((f) => f.id)).toEqual(['f1', 'f2']);
    });

    it('updateFilter merges partial updates by id', () => {
      const { addFilter, updateFilter } = useScreenerStore.getState();
      addFilter(makeFilter('f1', 30));
      updateFilter('f1', { operator: 'BELOW', value: 70 });

      const filter = useScreenerStore.getState().customFilters[0];
      expect(filter?.operator).toBe('BELOW');
      expect(filter?.value).toBe(70);
      expect(filter?.indicator).toBe('RSI');
    });

    it('updateFilter is a no-op for unknown ids', () => {
      const { addFilter, updateFilter } = useScreenerStore.getState();
      addFilter(makeFilter('f1'));
      updateFilter('nope', { value: 999 });
      expect(useScreenerStore.getState().customFilters[0]?.value).toBe(50);
    });

    it('removeFilter drops by id, leaves the rest intact', () => {
      const { addFilter, removeFilter } = useScreenerStore.getState();
      addFilter(makeFilter('f1'));
      addFilter(makeFilter('f2'));
      addFilter(makeFilter('f3'));
      removeFilter('f2');
      expect(useScreenerStore.getState().customFilters.map((f) => f.id)).toEqual(['f1', 'f3']);
    });

    it('clearFilters resets BOTH customFilters AND activePresetId', () => {
      const { addFilter, setActivePresetId, clearFilters } = useScreenerStore.getState();
      addFilter(makeFilter('f1'));
      setActivePresetId('momentum-leaders');
      clearFilters();

      const state = useScreenerStore.getState();
      expect(state.customFilters).toEqual([]);
      expect(state.activePresetId).toBeNull();
    });

    it('setFilters replaces the entire array', () => {
      const { addFilter, setFilters } = useScreenerStore.getState();
      addFilter(makeFilter('f1'));
      setFilters([makeFilter('a'), makeFilter('b')]);
      expect(useScreenerStore.getState().customFilters.map((f) => f.id)).toEqual(['a', 'b']);
    });
  });

  describe('toggleSort', () => {
    it('flips direction when toggling the same field (desc -> asc)', () => {
      useScreenerStore.setState({ sortBy: 'compositeScore', sortDirection: 'desc' });
      useScreenerStore.getState().toggleSort('compositeScore');
      const state = useScreenerStore.getState();
      expect(state.sortBy).toBe('compositeScore');
      expect(state.sortDirection).toBe('asc');
    });

    it('flips direction when toggling the same field (asc -> desc)', () => {
      useScreenerStore.setState({ sortBy: 'volume24h', sortDirection: 'asc' });
      useScreenerStore.getState().toggleSort('volume24h');
      expect(useScreenerStore.getState().sortDirection).toBe('desc');
    });

    it('switching to a new field resets direction to desc', () => {
      useScreenerStore.setState({ sortBy: 'compositeScore', sortDirection: 'asc' });
      useScreenerStore.getState().toggleSort('rsi');
      const state = useScreenerStore.getState();
      expect(state.sortBy).toBe('rsi');
      expect(state.sortDirection).toBe('desc');
    });
  });

  describe('hydrate', () => {
    it('applies only the keys that are present in the input', () => {
      useScreenerStore.getState().hydrate({
        screenerAssetClass: 'STOCKS',
        screenerInterval: '1h',
      });
      const state = useScreenerStore.getState();
      expect(state.assetClass).toBe('STOCKS');
      expect(state.interval).toBe('1h');
      expect(state.marketType).toBe('FUTURES');
    });

    it('is a no-op when given an empty payload', () => {
      const before = useScreenerStore.getState();
      useScreenerStore.getState().hydrate({});
      const after = useScreenerStore.getState();
      expect(after.assetClass).toBe(before.assetClass);
      expect(after.marketType).toBe(before.marketType);
      expect(after.interval).toBe(before.interval);
      expect(after.sortBy).toBe(before.sortBy);
      expect(after.sortDirection).toBe(before.sortDirection);
    });

    it('hydrates activePresetId across reload', () => {
      useScreenerStore.getState().hydrate({ screenerActivePresetId: 'top-gainers' });
      expect(useScreenerStore.getState().activePresetId).toBe('top-gainers');
    });
  });

  describe('header selectors', () => {
    it('setAssetClass updates assetClass', () => {
      useScreenerStore.getState().setAssetClass('STOCKS');
      expect(useScreenerStore.getState().assetClass).toBe('STOCKS');
    });

    it('setMarketType updates marketType', () => {
      useScreenerStore.getState().setMarketType('SPOT');
      expect(useScreenerStore.getState().marketType).toBe('SPOT');
    });

    it('setInterval updates interval', () => {
      useScreenerStore.getState().setInterval('1h');
      expect(useScreenerStore.getState().interval).toBe('1h');
    });
  });
});
