import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      tradingSidebarTab: 'orders',
      ordersFilterStatus: 'pending',
      ordersSortBy: 'newest',
      performancePeriod: 'all',
      setupStatsPeriod: 'all',
    });
  });

  describe('tradingSidebarTab', () => {
    it('should initialize with orders tab', () => {
      const state = useUIStore.getState();
      expect(state.tradingSidebarTab).toBe('orders');
    });

    it('should update to ticket tab', () => {
      const { setTradingSidebarTab } = useUIStore.getState();
      setTradingSidebarTab('ticket');
      expect(useUIStore.getState().tradingSidebarTab).toBe('ticket');
    });

    it('should update to portfolio tab', () => {
      const { setTradingSidebarTab } = useUIStore.getState();
      setTradingSidebarTab('portfolio');
      expect(useUIStore.getState().tradingSidebarTab).toBe('portfolio');
    });

    it('should update to wallets tab', () => {
      const { setTradingSidebarTab } = useUIStore.getState();
      setTradingSidebarTab('wallets');
      expect(useUIStore.getState().tradingSidebarTab).toBe('wallets');
    });

    it('should update to analytics tab', () => {
      const { setTradingSidebarTab } = useUIStore.getState();
      setTradingSidebarTab('analytics');
      expect(useUIStore.getState().tradingSidebarTab).toBe('analytics');
    });
  });

  describe('ordersFilterStatus', () => {
    it('should initialize with pending filter', () => {
      const state = useUIStore.getState();
      expect(state.ordersFilterStatus).toBe('pending');
    });

    it('should update to all filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('all');
      expect(useUIStore.getState().ordersFilterStatus).toBe('all');
    });

    it('should update to active filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('active');
      expect(useUIStore.getState().ordersFilterStatus).toBe('active');
    });

    it('should update to filled filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('filled');
      expect(useUIStore.getState().ordersFilterStatus).toBe('filled');
    });

    it('should update to closed filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('closed');
      expect(useUIStore.getState().ordersFilterStatus).toBe('closed');
    });

    it('should update to cancelled filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('cancelled');
      expect(useUIStore.getState().ordersFilterStatus).toBe('cancelled');
    });

    it('should update to expired filter', () => {
      const { setOrdersFilterStatus } = useUIStore.getState();
      setOrdersFilterStatus('expired');
      expect(useUIStore.getState().ordersFilterStatus).toBe('expired');
    });
  });

  describe('performancePeriod', () => {
    it('should initialize with all period', () => {
      const state = useUIStore.getState();
      expect(state.performancePeriod).toBe('all');
    });

    it('should update to day period', () => {
      const { setPerformancePeriod } = useUIStore.getState();
      setPerformancePeriod('day');
      expect(useUIStore.getState().performancePeriod).toBe('day');
    });

    it('should update to week period', () => {
      const { setPerformancePeriod } = useUIStore.getState();
      setPerformancePeriod('week');
      expect(useUIStore.getState().performancePeriod).toBe('week');
    });

    it('should update to month period', () => {
      const { setPerformancePeriod } = useUIStore.getState();
      setPerformancePeriod('month');
      expect(useUIStore.getState().performancePeriod).toBe('month');
    });
  });

  describe('setupStatsPeriod', () => {
    it('should initialize with all period', () => {
      const state = useUIStore.getState();
      expect(state.setupStatsPeriod).toBe('all');
    });

    it('should update to day period', () => {
      const { setSetupStatsPeriod } = useUIStore.getState();
      setSetupStatsPeriod('day');
      expect(useUIStore.getState().setupStatsPeriod).toBe('day');
    });

    it('should update to week period', () => {
      const { setSetupStatsPeriod } = useUIStore.getState();
      setSetupStatsPeriod('week');
      expect(useUIStore.getState().setupStatsPeriod).toBe('week');
    });

    it('should update to month period', () => {
      const { setSetupStatsPeriod } = useUIStore.getState();
      setSetupStatsPeriod('month');
      expect(useUIStore.getState().setupStatsPeriod).toBe('month');
    });
  });

  describe('Store Function Existence', () => {
    it('should expose all setter functions', () => {
      const state = useUIStore.getState();
      expect(typeof state.setTradingSidebarTab).toBe('function');
      expect(typeof state.setOrdersFilterStatus).toBe('function');
      expect(typeof state.setPerformancePeriod).toBe('function');
      expect(typeof state.setSetupStatsPeriod).toBe('function');
      expect(typeof state.setPortfolioFilterOption).toBe('function');
      expect(typeof state.setPortfolioSortBy).toBe('function');
      expect(typeof state.setOrdersViewMode).toBe('function');
      expect(typeof state.setPortfolioViewMode).toBe('function');
      expect(typeof state.setOrdersTableSort).toBe('function');
      expect(typeof state.setPortfolioTableSort).toBe('function');
      expect(typeof state.setOrdersSortBy).toBe('function');
      expect(typeof state.setEnableShiftAltOrderEntry).toBe('function');
    });

    it('should expose all state properties', () => {
      const state = useUIStore.getState();
      expect(state.tradingSidebarTab).toBeDefined();
      expect(state.ordersFilterStatus).toBeDefined();
      expect(state.performancePeriod).toBeDefined();
      expect(state.setupStatsPeriod).toBeDefined();
      expect(state.portfolioFilterOption).toBeDefined();
      expect(state.portfolioSortBy).toBeDefined();
      expect(state.ordersViewMode).toBeDefined();
      expect(state.portfolioViewMode).toBeDefined();
      expect(state.ordersTableSortKey).toBeDefined();
      expect(state.ordersTableSortDirection).toBeDefined();
      expect(state.portfolioTableSortKey).toBeDefined();
      expect(state.portfolioTableSortDirection).toBeDefined();
      expect(state.ordersSortBy).toBeDefined();
      expect(state.enableShiftAltOrderEntry).toBeDefined();
    });
  });

  describe('portfolioFilterOption', () => {
    it('should initialize with all filter', () => {
      const state = useUIStore.getState();
      expect(state.portfolioFilterOption).toBe('all');
    });

    it('should update to long filter', () => {
      const { setPortfolioFilterOption } = useUIStore.getState();
      setPortfolioFilterOption('long');
      expect(useUIStore.getState().portfolioFilterOption).toBe('long');
    });

    it('should update to short filter', () => {
      const { setPortfolioFilterOption } = useUIStore.getState();
      setPortfolioFilterOption('short');
      expect(useUIStore.getState().portfolioFilterOption).toBe('short');
    });

    it('should update to profitable filter', () => {
      const { setPortfolioFilterOption } = useUIStore.getState();
      setPortfolioFilterOption('profitable');
      expect(useUIStore.getState().portfolioFilterOption).toBe('profitable');
    });

    it('should update to losing filter', () => {
      const { setPortfolioFilterOption } = useUIStore.getState();
      setPortfolioFilterOption('losing');
      expect(useUIStore.getState().portfolioFilterOption).toBe('losing');
    });
  });

  describe('portfolioSortBy', () => {
    it('should initialize with newest', () => {
      const state = useUIStore.getState();
      expect(state.portfolioSortBy).toBe('newest');
    });

    it('should update to pnl-desc', () => {
      const { setPortfolioSortBy } = useUIStore.getState();
      setPortfolioSortBy('pnl-desc');
      expect(useUIStore.getState().portfolioSortBy).toBe('pnl-desc');
    });

    it('should update to size-desc', () => {
      const { setPortfolioSortBy } = useUIStore.getState();
      setPortfolioSortBy('size-desc');
      expect(useUIStore.getState().portfolioSortBy).toBe('size-desc');
    });

    it('should update to symbol-asc', () => {
      const { setPortfolioSortBy } = useUIStore.getState();
      setPortfolioSortBy('symbol-asc');
      expect(useUIStore.getState().portfolioSortBy).toBe('symbol-asc');
    });
  });

  describe('ordersViewMode', () => {
    it('should initialize with table', () => {
      const state = useUIStore.getState();
      expect(state.ordersViewMode).toBe('table');
    });

    it('should update to cards', () => {
      const { setOrdersViewMode } = useUIStore.getState();
      setOrdersViewMode('cards');
      expect(useUIStore.getState().ordersViewMode).toBe('cards');
    });

    it('should update back to table', () => {
      const { setOrdersViewMode } = useUIStore.getState();
      setOrdersViewMode('cards');
      setOrdersViewMode('table');
      expect(useUIStore.getState().ordersViewMode).toBe('table');
    });
  });

  describe('portfolioViewMode', () => {
    it('should initialize with table', () => {
      const state = useUIStore.getState();
      expect(state.portfolioViewMode).toBe('table');
    });

    it('should update to cards', () => {
      const { setPortfolioViewMode } = useUIStore.getState();
      setPortfolioViewMode('cards');
      expect(useUIStore.getState().portfolioViewMode).toBe('cards');
    });
  });

  describe('ordersTableSort', () => {
    it('should initialize with default sort', () => {
      const state = useUIStore.getState();
      expect(state.ordersTableSortKey).toBe('createdAt');
      expect(state.ordersTableSortDirection).toBe('desc');
    });

    it('should update sort key and direction', () => {
      const { setOrdersTableSort } = useUIStore.getState();
      setOrdersTableSort('price', 'asc');
      const state = useUIStore.getState();
      expect(state.ordersTableSortKey).toBe('price');
      expect(state.ordersTableSortDirection).toBe('asc');
    });

    it('should update to quantity sort', () => {
      const { setOrdersTableSort } = useUIStore.getState();
      setOrdersTableSort('quantity', 'desc');
      const state = useUIStore.getState();
      expect(state.ordersTableSortKey).toBe('quantity');
      expect(state.ordersTableSortDirection).toBe('desc');
    });
  });

  describe('portfolioTableSort', () => {
    it('should initialize with default sort', () => {
      const state = useUIStore.getState();
      expect(state.portfolioTableSortKey).toBe('pnl');
      expect(state.portfolioTableSortDirection).toBe('desc');
    });

    it('should update sort key and direction', () => {
      const { setPortfolioTableSort } = useUIStore.getState();
      setPortfolioTableSort('symbol', 'asc');
      const state = useUIStore.getState();
      expect(state.portfolioTableSortKey).toBe('symbol');
      expect(state.portfolioTableSortDirection).toBe('asc');
    });

    it('should update to exposure sort', () => {
      const { setPortfolioTableSort } = useUIStore.getState();
      setPortfolioTableSort('exposure', 'desc');
      const state = useUIStore.getState();
      expect(state.portfolioTableSortKey).toBe('exposure');
      expect(state.portfolioTableSortDirection).toBe('desc');
    });
  });

  describe('ordersSortBy', () => {
    it('should initialize with newest', () => {
      const state = useUIStore.getState();
      expect(state.ordersSortBy).toBe('newest');
    });

    it('should update to oldest', () => {
      const { setOrdersSortBy } = useUIStore.getState();
      setOrdersSortBy('oldest');
      expect(useUIStore.getState().ordersSortBy).toBe('oldest');
    });

    it('should update to symbol-asc', () => {
      const { setOrdersSortBy } = useUIStore.getState();
      setOrdersSortBy('symbol-asc');
      expect(useUIStore.getState().ordersSortBy).toBe('symbol-asc');
    });

    it('should update to quantity-desc', () => {
      const { setOrdersSortBy } = useUIStore.getState();
      setOrdersSortBy('quantity-desc');
      expect(useUIStore.getState().ordersSortBy).toBe('quantity-desc');
    });

    it('should update to pnl-desc', () => {
      const { setOrdersSortBy } = useUIStore.getState();
      setOrdersSortBy('pnl-desc');
      expect(useUIStore.getState().ordersSortBy).toBe('pnl-desc');
    });

    it('should update to price-desc', () => {
      const { setOrdersSortBy } = useUIStore.getState();
      setOrdersSortBy('price-desc');
      expect(useUIStore.getState().ordersSortBy).toBe('price-desc');
    });
  });

  describe('enableShiftAltOrderEntry', () => {
    it('should initialize with false', () => {
      const state = useUIStore.getState();
      expect(state.enableShiftAltOrderEntry).toBe(false);
    });

    it('should update to true', () => {
      const { setEnableShiftAltOrderEntry } = useUIStore.getState();
      setEnableShiftAltOrderEntry(true);
      expect(useUIStore.getState().enableShiftAltOrderEntry).toBe(true);
    });

    it('should update back to false', () => {
      const { setEnableShiftAltOrderEntry } = useUIStore.getState();
      setEnableShiftAltOrderEntry(true);
      setEnableShiftAltOrderEntry(false);
      expect(useUIStore.getState().enableShiftAltOrderEntry).toBe(false);
    });
  });
});
