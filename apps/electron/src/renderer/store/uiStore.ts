import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradingSidebarTab = 'ticket' | 'orders' | 'portfolio' | 'wallets' | 'analytics';
export type OrdersFilterOption = 'all' | 'pending' | 'active' | 'filled' | 'closed' | 'cancelled' | 'expired';
export type OrdersSortOption = 'newest' | 'oldest' | 'symbol-asc' | 'symbol-desc' | 'quantity-desc' | 'quantity-asc' | 'pnl-desc' | 'pnl-asc' | 'price-desc' | 'price-asc';
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';
export type PortfolioFilterOption = 'all' | 'long' | 'short' | 'profitable' | 'losing';
export type PortfolioSortOption = 'newest' | 'oldest' | 'pnl-desc' | 'pnl-asc' | 'size-desc' | 'size-asc' | 'symbol-asc' | 'symbol-desc' | 'exposure-desc' | 'exposure-asc';
export type ViewMode = 'cards' | 'table';
export type TableSortDirection = 'asc' | 'desc';

const MIGRATION_VERSION_3 = 3;
const MIGRATION_VERSION_4 = 4;
const MIGRATION_VERSION_5 = 5;
const MIGRATION_VERSION_6 = 6;
const MIGRATION_VERSION_7 = 7;

interface UIState {
  tradingSidebarTab: TradingSidebarTab;
  setTradingSidebarTab: (tab: TradingSidebarTab) => void;

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
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      tradingSidebarTab: 'orders',
      setTradingSidebarTab: (tab) => set({ tradingSidebarTab: tab }),

      ordersSortBy: 'newest',
      setOrdersSortBy: (sort) => set({ ordersSortBy: sort }),

      ordersFilterStatus: 'pending',
      setOrdersFilterStatus: (filter) => set({ ordersFilterStatus: filter }),

      performancePeriod: 'all',
      setPerformancePeriod: (period) => set({ performancePeriod: period }),

      setupStatsPeriod: 'all',
      setSetupStatsPeriod: (period) => set({ setupStatsPeriod: period }),

      portfolioFilterOption: 'all',
      setPortfolioFilterOption: (filter) => set({ portfolioFilterOption: filter }),

      portfolioSortBy: 'newest',
      setPortfolioSortBy: (sort) => set({ portfolioSortBy: sort }),

      ordersViewMode: 'cards',
      setOrdersViewMode: (mode) => set({ ordersViewMode: mode }),

      portfolioViewMode: 'cards',
      setPortfolioViewMode: (mode) => set({ portfolioViewMode: mode }),

      ordersTableSortKey: 'createdAt',
      ordersTableSortDirection: 'desc',
      setOrdersTableSort: (key, direction) => set({ ordersTableSortKey: key, ordersTableSortDirection: direction }),

      portfolioTableSortKey: 'pnl',
      portfolioTableSortDirection: 'desc',
      setPortfolioTableSort: (key, direction) => set({ portfolioTableSortKey: key, portfolioTableSortDirection: direction }),

      watchersTableSortKey: 'symbol',
      watchersTableSortDirection: 'asc',
      setWatchersTableSort: (key, direction) => set({ watchersTableSortKey: key, watchersTableSortDirection: direction }),

      showEventRow: false,
      setShowEventRow: (show) => set({ showEventRow: show }),
    }),
    {
      name: 'ui-storage',
      version: 7,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as UIState;

        if (version < MIGRATION_VERSION_3) {
          state.tradingSidebarTab = 'orders';
        }

        if (version < MIGRATION_VERSION_4) {
          state.ordersFilterStatus = 'pending';
          state.performancePeriod = 'all';
          state.setupStatsPeriod = 'all';
        }

        if (version < MIGRATION_VERSION_5) {
          state.ordersTableSortKey = 'createdAt';
          state.ordersTableSortDirection = 'desc';
          state.portfolioTableSortKey = 'pnl';
          state.portfolioTableSortDirection = 'desc';
        }

        if (version < MIGRATION_VERSION_6) {
          state.watchersTableSortKey = 'symbol';
          state.watchersTableSortDirection = 'asc';
        }

        if (version < MIGRATION_VERSION_7) {
          state.showEventRow = false;
        }

        return state;
      },
    }
  )
);
