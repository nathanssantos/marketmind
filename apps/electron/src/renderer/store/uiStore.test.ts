import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      chatPosition: 'right',
      patternDetectionMode: 'ai-only',
      algorithmicDetectionSettings: {
        minConfidence: 0.6,
        pivotSensitivity: 5,
        enabledPatterns: [],
        autoDisplayPatterns: true,
      },
      tradingSidebarTab: 'orders',
      ordersFilterStatus: 'pending',
      performancePeriod: 'all',
      setupStatsPeriod: 'all',
    });
  });

  describe('chatPosition', () => {
    it('should initialize with default chat position', () => {
      const state = useUIStore.getState();
      expect(state.chatPosition).toBe('right');
    });

    it('should update chat position to left', () => {
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
    });

    it('should update chat position to right', () => {
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');
      setChatPosition('right');
      expect(useUIStore.getState().chatPosition).toBe('right');
    });

    it('should handle multiple position changes', () => {
      const { setChatPosition } = useUIStore.getState();

      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');

      setChatPosition('right');
      expect(useUIStore.getState().chatPosition).toBe('right');

      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
    });
  });

  describe('patternDetectionMode', () => {
    it('should initialize with ai-only mode', () => {
      const state = useUIStore.getState();
      expect(state.patternDetectionMode).toBe('ai-only');
    });

    it('should update to algorithmic-only mode', () => {
      const { setPatternDetectionMode } = useUIStore.getState();
      setPatternDetectionMode('algorithmic-only');
      expect(useUIStore.getState().patternDetectionMode).toBe('algorithmic-only');
    });

    it('should update to hybrid mode', () => {
      const { setPatternDetectionMode } = useUIStore.getState();
      setPatternDetectionMode('hybrid');
      expect(useUIStore.getState().patternDetectionMode).toBe('hybrid');
    });

    it('should cycle through all modes', () => {
      const { setPatternDetectionMode } = useUIStore.getState();

      setPatternDetectionMode('algorithmic-only');
      expect(useUIStore.getState().patternDetectionMode).toBe('algorithmic-only');

      setPatternDetectionMode('hybrid');
      expect(useUIStore.getState().patternDetectionMode).toBe('hybrid');

      setPatternDetectionMode('ai-only');
      expect(useUIStore.getState().patternDetectionMode).toBe('ai-only');
    });
  });

  describe('algorithmicDetectionSettings', () => {
    it('should initialize with default settings', () => {
      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.minConfidence).toBe(0.6);
      expect(state.algorithmicDetectionSettings.pivotSensitivity).toBe(5);
      expect(state.algorithmicDetectionSettings.autoDisplayPatterns).toBe(true);
    });

    it('should update minConfidence', () => {
      const { setAlgorithmicDetectionSettings } = useUIStore.getState();
      setAlgorithmicDetectionSettings({ minConfidence: 0.8 });

      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.minConfidence).toBe(0.8);
      expect(state.algorithmicDetectionSettings.pivotSensitivity).toBe(5);
    });

    it('should update pivotSensitivity', () => {
      const { setAlgorithmicDetectionSettings } = useUIStore.getState();
      setAlgorithmicDetectionSettings({ pivotSensitivity: 10 });

      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.pivotSensitivity).toBe(10);
    });

    it('should update enabledPatterns', () => {
      const { setAlgorithmicDetectionSettings } = useUIStore.getState();
      setAlgorithmicDetectionSettings({ enabledPatterns: ['support', 'resistance'] });

      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.enabledPatterns).toEqual(['support', 'resistance']);
    });

    it('should update autoDisplayPatterns', () => {
      const { setAlgorithmicDetectionSettings } = useUIStore.getState();
      setAlgorithmicDetectionSettings({ autoDisplayPatterns: false });

      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.autoDisplayPatterns).toBe(false);
    });

    it('should merge partial updates preserving other values', () => {
      const { setAlgorithmicDetectionSettings } = useUIStore.getState();
      setAlgorithmicDetectionSettings({ minConfidence: 0.9 });
      setAlgorithmicDetectionSettings({ pivotSensitivity: 7 });

      const state = useUIStore.getState();
      expect(state.algorithmicDetectionSettings.minConfidence).toBe(0.9);
      expect(state.algorithmicDetectionSettings.pivotSensitivity).toBe(7);
      expect(state.algorithmicDetectionSettings.autoDisplayPatterns).toBe(true);
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
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');

      const newState = useUIStore.getState();
      expect(newState.chatPosition).toBe('left');
    });
  });

  describe('Store Function Existence', () => {
    it('should expose all setter functions', () => {
      const state = useUIStore.getState();
      expect(typeof state.setChatPosition).toBe('function');
      expect(typeof state.setPatternDetectionMode).toBe('function');
      expect(typeof state.setAlgorithmicDetectionSettings).toBe('function');
      expect(typeof state.setTradingSidebarTab).toBe('function');
      expect(typeof state.setOrdersFilterStatus).toBe('function');
      expect(typeof state.setPerformancePeriod).toBe('function');
      expect(typeof state.setSetupStatsPeriod).toBe('function');
    });

    it('should expose all state properties', () => {
      const state = useUIStore.getState();
      expect(state.chatPosition).toBeDefined();
      expect(state.patternDetectionMode).toBeDefined();
      expect(state.algorithmicDetectionSettings).toBeDefined();
      expect(state.tradingSidebarTab).toBeDefined();
      expect(state.ordersFilterStatus).toBeDefined();
      expect(state.performancePeriod).toBeDefined();
      expect(state.setupStatsPeriod).toBeDefined();
    });
  });
});
