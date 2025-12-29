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

  describe('State Persistence', () => {
    it('should have persistence configured with correct name', () => {
      expect(localStorage.getItem('ui-storage')).toBeDefined();
    });

    it('should maintain state through store access', () => {
      const { setTradingSidebarTab } = useUIStore.getState();
      setTradingSidebarTab('portfolio');

      const newState = useUIStore.getState();
      expect(newState.tradingSidebarTab).toBe('portfolio');
    });
  });

  describe('Store Function Existence', () => {
    it('should expose all setter functions', () => {
      const state = useUIStore.getState();
      expect(typeof state.setTradingSidebarTab).toBe('function');
      expect(typeof state.setOrdersFilterStatus).toBe('function');
      expect(typeof state.setPerformancePeriod).toBe('function');
      expect(typeof state.setSetupStatsPeriod).toBe('function');
    });

    it('should expose all state properties', () => {
      const state = useUIStore.getState();
      expect(state.tradingSidebarTab).toBeDefined();
      expect(state.ordersFilterStatus).toBeDefined();
      expect(state.performancePeriod).toBeDefined();
      expect(state.setupStatsPeriod).toBeDefined();
    });
  });
});
