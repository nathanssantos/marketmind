import type { AssetClass, MarketType, ScreenerFilterCondition, ScreenerSortField, TimeInterval } from '@marketmind/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScreenerState {
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
  persist(
    (set) => ({
      isScreenerOpen: false,
      toggleScreener: () => set((s) => ({ isScreenerOpen: !s.isScreenerOpen })),
      setScreenerOpen: (open) => set({ isScreenerOpen: open }),

      activePresetId: null,
      setActivePresetId: (id) => set({ activePresetId: id }),

      customFilters: [],
      addFilter: (filter) => set((s) => ({ customFilters: [...s.customFilters, filter] })),
      updateFilter: (id, updates) => set((s) => ({
        customFilters: s.customFilters.map((f) => f.id === id ? { ...f, ...updates } : f),
      })),
      removeFilter: (id) => set((s) => ({ customFilters: s.customFilters.filter((f) => f.id !== id) })),
      clearFilters: () => set({ customFilters: [], activePresetId: null }),
      setFilters: (filters) => set({ customFilters: filters }),

      assetClass: 'CRYPTO' as AssetClass,
      setAssetClass: (assetClass) => set({ assetClass }),

      marketType: 'FUTURES' as MarketType,
      setMarketType: (marketType) => set({ marketType }),

      interval: '4h' as TimeInterval,
      setInterval: (interval) => set({ interval }),

      sortBy: 'compositeScore' as ScreenerSortField,
      setSortBy: (sortBy) => set({ sortBy }),

      sortDirection: 'desc',
      setSortDirection: (sortDirection) => set({ sortDirection }),

      toggleSort: (field) => set((s) => {
        if (s.sortBy === field) return { sortDirection: s.sortDirection === 'asc' ? 'desc' : 'asc' };
        return { sortBy: field, sortDirection: 'desc' };
      }),
    }),
    {
      name: 'screener-storage',
      version: 1,
      partialize: (state: ScreenerState) => ({
        assetClass: state.assetClass,
        marketType: state.marketType,
        interval: state.interval,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        activePresetId: state.activePresetId,
      }),
    }
  )
);
