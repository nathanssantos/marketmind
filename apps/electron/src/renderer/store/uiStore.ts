import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradingSidebarTab = 'ticket' | 'orders' | 'portfolio';
export type MarketSidebarTab = 'indicators' | 'watchers' | 'logs';
export type OrdersFilterOption = 'all' | 'pending' | 'active' | 'filled' | 'closed' | 'cancelled' | 'expired';
export type OrdersSortOption = 'newest' | 'oldest' | 'symbol-asc' | 'symbol-desc' | 'quantity-desc' | 'quantity-asc' | 'pnl-desc' | 'pnl-asc' | 'price-desc' | 'price-asc';
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';
export type PortfolioFilterOption = 'all' | 'long' | 'short' | 'profitable' | 'losing';
export type PortfolioSortOption = 'newest' | 'oldest' | 'pnl-desc' | 'pnl-asc' | 'size-desc' | 'size-asc' | 'symbol-asc' | 'symbol-desc' | 'exposure-desc' | 'exposure-asc';
export type ViewMode = 'cards' | 'table';
export type TableSortDirection = 'asc' | 'desc';

interface UIState {
  activeWalletId: string | null;
  setActiveWalletId: (id: string | null) => void;

  tradingSidebarTab: TradingSidebarTab;
  setTradingSidebarTab: (tab: TradingSidebarTab) => void;

  marketSidebarOpen: boolean;
  setMarketSidebarOpen: (open: boolean) => void;
  toggleMarketSidebar: () => void;

  marketSidebarTab: MarketSidebarTab;
  setMarketSidebarTab: (tab: MarketSidebarTab) => void;

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
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeWalletId: null,
      setActiveWalletId: (id) => set({ activeWalletId: id }),

      tradingSidebarTab: 'portfolio',
      setTradingSidebarTab: (tab) => set({ tradingSidebarTab: tab }),

      marketSidebarOpen: false,
      setMarketSidebarOpen: (open) => set({ marketSidebarOpen: open }),
      toggleMarketSidebar: () => set((state) => ({ marketSidebarOpen: !state.marketSidebarOpen })),

      marketSidebarTab: 'indicators',
      setMarketSidebarTab: (tab) => set({ marketSidebarTab: tab }),

      ordersSortBy: 'newest',
      setOrdersSortBy: (sort) => set({ ordersSortBy: sort }),

      ordersFilterStatus: 'closed',
      setOrdersFilterStatus: (filter) => set({ ordersFilterStatus: filter }),

      performancePeriod: 'all',
      setPerformancePeriod: (period) => set({ performancePeriod: period }),

      setupStatsPeriod: 'all',
      setSetupStatsPeriod: (period) => set({ setupStatsPeriod: period }),

      portfolioFilterOption: 'all',
      setPortfolioFilterOption: (filter) => set({ portfolioFilterOption: filter }),

      portfolioSortBy: 'newest',
      setPortfolioSortBy: (sort) => set({ portfolioSortBy: sort }),

      ordersViewMode: 'table',
      setOrdersViewMode: (mode) => set({ ordersViewMode: mode }),

      portfolioViewMode: 'table',
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

      enableShiftAltOrderEntry: false,
      setEnableShiftAltOrderEntry: (enabled) => set({ enableShiftAltOrderEntry: enabled }),

      isAnalyticsOpen: false,
      setAnalyticsOpen: (open) => set({ isAnalyticsOpen: open }),
      toggleAnalytics: () => set((state) => ({ isAnalyticsOpen: !state.isAnalyticsOpen })),

      trailingStopPanelExpanded: false,
      setTrailingStopPanelExpanded: (expanded) => set({ trailingStopPanelExpanded: expanded }),
      toggleTrailingStopPanel: () => set((state) => ({ trailingStopPanelExpanded: !state.trailingStopPanelExpanded })),
    }),
    {
      name: 'ui-storage',
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          if (state['tradingSidebarTab'] === 'wallets') state['tradingSidebarTab'] = 'portfolio';
          state['activeWalletId'] = null;
        }
        if (version < 3) {
          if (state['tradingSidebarTab'] === 'analytics') state['tradingSidebarTab'] = 'portfolio';
        }
        if (version < 4) {
          state['trailingStopPanelExpanded'] = false;
        }
        return state as unknown as UIState;
      },
      partialize: (state: UIState) => ({
        activeWalletId: state.activeWalletId,
        tradingSidebarTab: state.tradingSidebarTab,
        marketSidebarOpen: state.marketSidebarOpen,
        marketSidebarTab: state.marketSidebarTab,
        ordersFilterStatus: state.ordersFilterStatus,
        ordersSortBy: state.ordersSortBy,
        performancePeriod: state.performancePeriod,
        setupStatsPeriod: state.setupStatsPeriod,
        portfolioFilterOption: state.portfolioFilterOption,
        portfolioSortBy: state.portfolioSortBy,
        ordersViewMode: state.ordersViewMode,
        portfolioViewMode: state.portfolioViewMode,
        ordersTableSortKey: state.ordersTableSortKey,
        ordersTableSortDirection: state.ordersTableSortDirection,
        portfolioTableSortKey: state.portfolioTableSortKey,
        portfolioTableSortDirection: state.portfolioTableSortDirection,
        watchersTableSortKey: state.watchersTableSortKey,
        watchersTableSortDirection: state.watchersTableSortDirection,
        showEventRow: state.showEventRow,
        enableShiftAltOrderEntry: state.enableShiftAltOrderEntry,
        trailingStopPanelExpanded: state.trailingStopPanelExpanded,
      }),
    }
  )
);
