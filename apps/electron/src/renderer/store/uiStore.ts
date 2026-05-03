import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

export type OrdersFilterOption = 'all' | 'pending' | 'active' | 'filled' | 'closed' | 'cancelled' | 'expired';
export type OrdersSortOption = 'newest' | 'oldest' | 'symbol-asc' | 'symbol-desc' | 'quantity-desc' | 'quantity-asc' | 'pnl-desc' | 'pnl-asc' | 'price-desc' | 'price-asc';
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';
export type PortfolioFilterOption = 'all' | 'long' | 'short' | 'profitable' | 'losing';
export type PortfolioSortOption = 'newest' | 'oldest' | 'pnl-desc' | 'pnl-asc' | 'size-desc' | 'size-asc' | 'symbol-asc' | 'symbol-desc' | 'exposure-desc' | 'exposure-asc';
export type ViewMode = 'cards' | 'table';
export type TableSortDirection = 'asc' | 'desc';

const syncUI = (key: string, value: unknown) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('ui', key, value);
};

const HYDRATE_KEYS = [
  'activeWalletId',
  'ordersFilterStatus', 'ordersSortBy', 'performancePeriod', 'setupStatsPeriod',
  'portfolioFilterOption', 'portfolioSortBy', 'ordersViewMode', 'portfolioViewMode',
  'ordersTableSortKey', 'ordersTableSortDirection', 'portfolioTableSortKey', 'portfolioTableSortDirection',
  'watchersTableSortKey', 'watchersTableSortDirection', 'showEventRow', 'enableShiftAltOrderEntry',
  'isAnalyticsOpen', 'trailingStopPanelExpanded',
] as const;

interface UIState {
  hydrate: (data: Record<string, unknown>) => void;

  activeWalletId: string | null;
  setActiveWalletId: (id: string | null) => void;

  ordersFilterStatus: OrdersFilterOption;
  setOrdersFilterStatus: (filter: OrdersFilterOption) => void;

  ordersSortBy: OrdersSortOption;
  setOrdersSortBy: (sort: OrdersSortOption) => void;

  performancePeriod: AnalyticsPeriod;
  setPerformancePeriod: (period: AnalyticsPeriod) => void;

  setupStatsPeriod: AnalyticsPeriod;
  setSetupStatsPeriod: (period: AnalyticsPeriod) => void;

  portfolioFilterOption: PortfolioFilterOption;
  setPortfolioFilterOption: (filter: PortfolioFilterOption) => void;

  portfolioSortBy: PortfolioSortOption;
  setPortfolioSortBy: (sort: PortfolioSortOption) => void;

  ordersViewMode: ViewMode;
  setOrdersViewMode: (mode: ViewMode) => void;

  portfolioViewMode: ViewMode;
  setPortfolioViewMode: (mode: ViewMode) => void;

  ordersTableSortKey: string;
  ordersTableSortDirection: TableSortDirection;
  setOrdersTableSort: (key: string, direction: TableSortDirection) => void;

  portfolioTableSortKey: string;
  portfolioTableSortDirection: TableSortDirection;
  setPortfolioTableSort: (key: string, direction: TableSortDirection) => void;

  watchersTableSortKey: string;
  watchersTableSortDirection: TableSortDirection;
  setWatchersTableSort: (key: string, direction: TableSortDirection) => void;

  showEventRow: boolean;
  setShowEventRow: (show: boolean) => void;

  enableShiftAltOrderEntry: boolean;
  setEnableShiftAltOrderEntry: (enabled: boolean) => void;

  isAnalyticsOpen: boolean;
  setAnalyticsOpen: (open: boolean) => void;
  toggleAnalytics: () => void;

  trailingStopPanelExpanded: boolean;
  setTrailingStopPanelExpanded: (expanded: boolean) => void;
  toggleTrailingStopPanel: () => void;

  isOrdersDialogOpen: boolean;
  setOrdersDialogOpen: (open: boolean) => void;

  // Standalone dialogs that graduated out of Settings (per the v1.6
  // "Settings is for prefs, not records" rule). Exposed in the store so
  // MCP screenshot tooling and E2E tests can open them without
  // depending on header/sidebar UI structure that drifts faster than
  // the gallery script does.
  isWalletsDialogOpen: boolean;
  setWalletsDialogOpen: (open: boolean) => void;

  isTradingProfilesDialogOpen: boolean;
  setTradingProfilesDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  (set) => ({
    hydrate: (data) => {
      const updates: Record<string, unknown> = {};
      for (const key of HYDRATE_KEYS) {
        if (key in data) updates[key] = data[key];
      }
      if (Object.keys(updates).length > 0) set(updates as unknown as Partial<UIState>);
    },

    activeWalletId: null,
    setActiveWalletId: (id) => { set({ activeWalletId: id }); syncUI('activeWalletId', id); },

    ordersFilterStatus: 'closed',
    setOrdersFilterStatus: (filter) => { set({ ordersFilterStatus: filter }); syncUI('ordersFilterStatus', filter); },

    ordersSortBy: 'newest',
    setOrdersSortBy: (sort) => { set({ ordersSortBy: sort }); syncUI('ordersSortBy', sort); },

    performancePeriod: 'all',
    setPerformancePeriod: (period) => { set({ performancePeriod: period }); syncUI('performancePeriod', period); },

    setupStatsPeriod: 'all',
    setSetupStatsPeriod: (period) => { set({ setupStatsPeriod: period }); syncUI('setupStatsPeriod', period); },

    portfolioFilterOption: 'all',
    setPortfolioFilterOption: (filter) => { set({ portfolioFilterOption: filter }); syncUI('portfolioFilterOption', filter); },

    portfolioSortBy: 'newest',
    setPortfolioSortBy: (sort) => { set({ portfolioSortBy: sort }); syncUI('portfolioSortBy', sort); },

    ordersViewMode: 'table',
    setOrdersViewMode: (mode) => { set({ ordersViewMode: mode }); syncUI('ordersViewMode', mode); },

    portfolioViewMode: 'table',
    setPortfolioViewMode: (mode) => { set({ portfolioViewMode: mode }); syncUI('portfolioViewMode', mode); },

    ordersTableSortKey: 'createdAt',
    ordersTableSortDirection: 'desc',
    setOrdersTableSort: (key, direction) => {
      set({ ordersTableSortKey: key, ordersTableSortDirection: direction });
      syncUI('ordersTableSortKey', key);
      syncUI('ordersTableSortDirection', direction);
    },

    portfolioTableSortKey: 'pnl',
    portfolioTableSortDirection: 'desc',
    setPortfolioTableSort: (key, direction) => {
      set({ portfolioTableSortKey: key, portfolioTableSortDirection: direction });
      syncUI('portfolioTableSortKey', key);
      syncUI('portfolioTableSortDirection', direction);
    },

    watchersTableSortKey: 'symbol',
    watchersTableSortDirection: 'asc',
    setWatchersTableSort: (key, direction) => {
      set({ watchersTableSortKey: key, watchersTableSortDirection: direction });
      syncUI('watchersTableSortKey', key);
      syncUI('watchersTableSortDirection', direction);
    },

    showEventRow: false,
    setShowEventRow: (show) => { set({ showEventRow: show }); syncUI('showEventRow', show); },

    enableShiftAltOrderEntry: true,
    setEnableShiftAltOrderEntry: (enabled) => { set({ enableShiftAltOrderEntry: enabled }); syncUI('enableShiftAltOrderEntry', enabled); },

    isAnalyticsOpen: false,
    setAnalyticsOpen: (open) => { set({ isAnalyticsOpen: open }); syncUI('isAnalyticsOpen', open); },
    toggleAnalytics: () => set((state) => {
      const val = !state.isAnalyticsOpen;
      syncUI('isAnalyticsOpen', val);
      return { isAnalyticsOpen: val };
    }),

    trailingStopPanelExpanded: false,
    setTrailingStopPanelExpanded: (expanded) => { set({ trailingStopPanelExpanded: expanded }); syncUI('trailingStopPanelExpanded', expanded); },
    toggleTrailingStopPanel: () => set((state) => {
      const val = !state.trailingStopPanelExpanded;
      syncUI('trailingStopPanelExpanded', val);
      return { trailingStopPanelExpanded: val };
    }),

    isOrdersDialogOpen: false,
    setOrdersDialogOpen: (open) => set({ isOrdersDialogOpen: open }),

    isWalletsDialogOpen: false,
    setWalletsDialogOpen: (open) => set({ isWalletsDialogOpen: open }),

    isTradingProfilesDialogOpen: false,
    setTradingProfilesDialogOpen: (open) => set({ isTradingProfilesDialogOpen: open }),
  })
);
