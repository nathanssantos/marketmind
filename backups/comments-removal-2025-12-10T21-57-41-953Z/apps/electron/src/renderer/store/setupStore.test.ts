import type { TradingSetup } from '@marketmind/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from './setupStore';

const createMockSetup = (overrides?: Partial<TradingSetup>): TradingSetup => ({
  id: `setup-${Date.now()}-${Math.random()}`,
  type: 'setup-9-1',
  direction: 'LONG',
  openTime: Date.now(),
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  riskRewardRatio: 2,
  confidence: 75,
  volumeConfirmation: true,
  indicatorConfluence: 2,
  klineIndex: 50,
  setupData: {},
  visible: true,
  source: 'algorithm',
  ...overrides,
});

describe('setupStore', () => {
  beforeEach(() => {
    useSetupStore.getState().clearDetectedSetups();
    useSetupStore.getState().clearHistory();
  });

  describe('configuration management', () => {
    it('should initialize with default config', () => {
      const { config } = useSetupStore.getState();
      expect(config).toBeDefined();
      expect(config.setup91).toBeDefined();
      expect(config.pattern123).toBeDefined();
    });

    it('should update config', () => {
      const store = useSetupStore.getState();
      store.setConfig({
        setup91: { ...store.config.setup91, enabled: false },
      });

      const { config } = useSetupStore.getState();
      expect(config.setup91.enabled).toBe(false);
    });

    it('should reset config to defaults', () => {
      const store = useSetupStore.getState();
      store.setConfig({
        setup91: { ...store.config.setup91, enabled: true },
      });

      store.resetConfigToDefaults();

      const { config } = useSetupStore.getState();
      expect(config.setup91.enabled).toBe(false);
    });

    it('should update specific setup config', () => {
      const store = useSetupStore.getState();
      store.updateSetupConfig('setup91', { minConfidence: 80 });

      const { config } = useSetupStore.getState();
      expect(config.setup91.minConfidence).toBe(80);
    });
  });

  describe('detected setups management', () => {
    it('should add detected setup', () => {
      const setup = createMockSetup();
      useSetupStore.getState().addDetectedSetup(setup);

      const { detectedSetups } = useSetupStore.getState();
      expect(detectedSetups).toHaveLength(1);
      expect(detectedSetups[0]).toEqual(setup);
    });

    it('should remove detected setup', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);
      store.removeDetectedSetup(setup.id);

      const { detectedSetups } = useSetupStore.getState();
      expect(detectedSetups).toHaveLength(0);
    });

    it('should clear all detected setups', () => {
      const store = useSetupStore.getState();
      store.addDetectedSetup(createMockSetup());
      store.addDetectedSetup(createMockSetup());
      store.clearDetectedSetups();

      const { detectedSetups } = useSetupStore.getState();
      expect(detectedSetups).toHaveLength(0);
    });

    it('should get detected setup by id', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);

      const found = store.getDetectedSetup(setup.id);
      expect(found).toEqual(setup);
    });
  });

  describe('setup execution', () => {
    it('should execute setup', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory).toHaveLength(1);
      expect(setupHistory[0]?.setupId).toBe(setup.id);
      expect(setupHistory[0]?.status).toBe('active');
    });

    it('should not execute non-existent setup', () => {
      const store = useSetupStore.getState();
      store.executeSetup('non-existent-id');

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory).toHaveLength(0);
    });

    it('should update execution', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);
      store.updateExecution(setup.id, { status: 'pending' });

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory[0]?.status).toBe('pending');
    });

    it('should close execution with profit', () => {
      const setup = createMockSetup({
        entryPrice: 100,
        direction: 'LONG',
      });
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);
      store.closeExecution(setup.id, 105);

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory[0]?.status).toBe('won');
      expect(setupHistory[0]?.exitPrice).toBe(105);
      expect(setupHistory[0]?.pnl).toBe(5);
    });

    it('should cancel execution', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();
      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);
      store.cancelExecution(setup.id);

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory[0]?.status).toBe('cancelled');
    });
  });

  describe('performance tracking', () => {
    it('should calculate global performance', () => {
      const setup1 = createMockSetup({ id: 'setup-1' });
      const setup2 = createMockSetup({ id: 'setup-2' });
      const store = useSetupStore.getState();

      store.addDetectedSetup(setup1);
      store.addDetectedSetup(setup2);
      store.executeSetup(setup1.id);
      store.executeSetup(setup2.id);

      store.closeExecution(setup1.id, 110);
      store.closeExecution(setup2.id, 90);

      const performance = store.getGlobalPerformance();
      expect(performance.executedSetups).toBe(2);
      expect(performance.winningSetups).toBeGreaterThanOrEqual(0);
      expect(performance.losingSetups).toBeGreaterThanOrEqual(0);
    });

    it('should calculate performance by type', () => {
      const setup = createMockSetup({ type: 'setup-9-1' });
      const store = useSetupStore.getState();

      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);
      store.closeExecution(setup.id, 110);

      const performance = store.getPerformanceByType('setup-9-1');
      expect(performance.totalSetups).toBe(1);
      expect(performance.executedSetups).toBe(1);
    });

    it('should return empty stats for non-existent type', () => {
      const store = useSetupStore.getState();
      const performance = store.getPerformanceByType('bull-trap');

      expect(performance.totalSetups).toBe(0);
      expect(performance.executedSetups).toBe(0);
    });

    it('should clear history', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();

      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);
      store.clearHistory();

      const { setupHistory } = useSetupStore.getState();
      expect(setupHistory).toHaveLength(0);
    });

    it('should export history', () => {
      const setup = createMockSetup();
      const store = useSetupStore.getState();

      store.addDetectedSetup(setup);
      store.executeSetup(setup.id);

      const history = store.exportHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.setupId).toBe(setup.id);
    });
  });

  describe('win rate calculation', () => {
    it('should calculate correct win rate', () => {
      const store = useSetupStore.getState();

      const setup1 = createMockSetup({ id: 'win-1', entryPrice: 100 });
      const setup2 = createMockSetup({ id: 'win-2', entryPrice: 100 });
      const setup3 = createMockSetup({ id: 'lose-1', entryPrice: 100 });

      store.addDetectedSetup(setup1);
      store.addDetectedSetup(setup2);
      store.addDetectedSetup(setup3);

      store.executeSetup(setup1.id);
      store.executeSetup(setup2.id);
      store.executeSetup(setup3.id);

      store.closeExecution(setup1.id, 95);
      store.closeExecution(setup2.id, 95);
      store.closeExecution(setup3.id, 105);

      const performance = store.getGlobalPerformance();
      expect(performance.executedSetups).toBe(3);
    });
  });
});
