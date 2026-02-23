import type { AssetClass, MarketType, ScreenerFilterCondition, ScreenerSortField, TimeInterval } from '@marketmind/types';
import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

const syncUI = (key: string, value: unknown) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('ui', key, value);
};

interface ScreenerState {
  hydrate: (data: Record<string, unknown>) => void;

  isScreenerOpen: boolean;
  toggleScreener: () => void;
  setScreenerOpen: (open: boolean) => void;

  activePresetId: string | null;
  setActivePresetId: (id: string | null) => void;

  customFilters: ScreenerFilterCondition[];
  addFilter: (filter: ScreenerFilterCondition) => void;
  updateFilter: (id: string, updates: Partial<ScreenerFilterCondition>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  setFilters: (filters: ScreenerFilterCondition[]) => void;

  assetClass: AssetClass;
  setAssetClass: (assetClass: AssetClass) => void;

  marketType: MarketType;
  setMarketType: (marketType: MarketType) => void;

  interval: TimeInterval;
  setInterval: (interval: TimeInterval) => void;

  sortBy: ScreenerSortField;
  setSortBy: (sortBy: ScreenerSortField) => void;

  sortDirection: 'asc' | 'desc';
  setSortDirection: (dir: 'asc' | 'desc') => void;

  toggleSort: (field: ScreenerSortField) => void;
}

export const useScreenerStore = create<ScreenerState>()(
  (set) => ({
    hydrate: (data) => {
      const updates: Record<string, unknown> = {};
      if ('screenerAssetClass' in data) updates['assetClass'] = data['screenerAssetClass'];
      if ('screenerMarketType' in data) updates['marketType'] = data['screenerMarketType'];
      if ('screenerInterval' in data) updates['interval'] = data['screenerInterval'];
      if ('screenerSortBy' in data) updates['sortBy'] = data['screenerSortBy'];
      if ('screenerSortDirection' in data) updates['sortDirection'] = data['screenerSortDirection'];
      if ('screenerActivePresetId' in data) updates['activePresetId'] = data['screenerActivePresetId'];
      if (Object.keys(updates).length > 0) set(updates as unknown as Partial<ScreenerState>);
    },

    isScreenerOpen: false,
    toggleScreener: () => set((s) => ({ isScreenerOpen: !s.isScreenerOpen })),
    setScreenerOpen: (open) => set({ isScreenerOpen: open }),

    activePresetId: null,
    setActivePresetId: (id) => { set({ activePresetId: id }); syncUI('screenerActivePresetId', id); },

    customFilters: [],
    addFilter: (filter) => set((s) => ({ customFilters: [...s.customFilters, filter] })),
    updateFilter: (id, updates) => set((s) => ({
      customFilters: s.customFilters.map((f) => f.id === id ? { ...f, ...updates } : f),
    })),
    removeFilter: (id) => set((s) => ({ customFilters: s.customFilters.filter((f) => f.id !== id) })),
    clearFilters: () => set({ customFilters: [], activePresetId: null }),
    setFilters: (filters) => set({ customFilters: filters }),

    assetClass: 'CRYPTO' as AssetClass,
    setAssetClass: (assetClass) => { set({ assetClass }); syncUI('screenerAssetClass', assetClass); },

    marketType: 'FUTURES' as MarketType,
    setMarketType: (marketType) => { set({ marketType }); syncUI('screenerMarketType', marketType); },

    interval: '4h' as TimeInterval,
    setInterval: (interval) => { set({ interval }); syncUI('screenerInterval', interval); },

    sortBy: 'compositeScore' as ScreenerSortField,
    setSortBy: (sortBy) => { set({ sortBy }); syncUI('screenerSortBy', sortBy); },

    sortDirection: 'desc',
    setSortDirection: (sortDirection) => { set({ sortDirection }); syncUI('screenerSortDirection', sortDirection); },

    toggleSort: (field) => set((s) => {
      if (s.sortBy === field) {
        const dir = s.sortDirection === 'asc' ? 'desc' : 'asc';
        syncUI('screenerSortDirection', dir);
        return { sortDirection: dir };
      }
      syncUI('screenerSortBy', field);
      syncUI('screenerSortDirection', 'desc');
      return { sortBy: field, sortDirection: 'desc' };
    }),
  })
);
