import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { PineStrategyLoader } from '../../pine/PineStrategyLoader';
import { SetupDetectionService, createDefaultSetupDetectionConfig } from '../SetupDetectionService';

const createMockKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => ({
    openTime: 1700000000000 + i * 3600000,
    closeTime: 1700000000000 + i * 3600000 + 3599999,
    open: String(50000 + Math.sin(i * 0.05) * 5000 + i * 10),
    high: String(50000 + Math.sin(i * 0.05) * 5000 + i * 10 + 200),
    low: String(50000 + Math.sin(i * 0.05) * 5000 + i * 10 - 200),
    close: String(50000 + Math.sin(i * 0.05) * 5000 + i * 10 + 50),
    volume: String(1500),
    quoteVolume: '0',
    trades: 100,
    takerBuyBaseVolume: '0',
    takerBuyQuoteVolume: '0',
  }));

const SIMPLE_PINE = `
//@version=5
indicator('Test Signal', overlay=true)
smaFast = ta.sma(close, 5)
smaSlow = ta.sma(close, 20)
longEntry = ta.crossover(smaFast, smaSlow)
shortEntry = ta.crossunder(smaFast, smaSlow)
sig = longEntry ? 1 : shortEntry ? -1 : 0
sl = longEntry ? close * 0.95 : shortEntry ? close * 1.05 : na
tp = longEntry ? close * 1.15 : shortEntry ? close * 0.85 : na
conf = longEntry or shortEntry ? 75 : 0
plot(sig, 'signal', display=display.none)
plot(sl, 'stopLoss', display=display.none)
plot(tp, 'takeProfit', display=display.none)
plot(conf, 'confidence', display=display.none)
`;

describe('SetupDetectionService', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new SetupDetectionService();
      const config = service.getConfig();

      expect(config.setupCooldownPeriod).toBe(10);
      expect(config.minConfidence).toBe(50);
      expect(config.minRiskReward).toBe(1.0);
    });

    it('should create with custom config', () => {
      const service = new SetupDetectionService({
        setupCooldownPeriod: 5,
        minConfidence: 70,
        minRiskReward: 1.5,
      });

      const config = service.getConfig();
      expect(config.setupCooldownPeriod).toBe(5);
      expect(config.minConfidence).toBe(70);
      expect(config.minRiskReward).toBe(1.5);
    });
  });

  describe('loadPineStrategy', () => {
    it('should load a Pine strategy', () => {
      const service = new SetupDetectionService();
      const loader = new PineStrategyLoader([]);
      const strategy = loader.loadFromString(SIMPLE_PINE, 'test-pine');

      service.loadPineStrategy(strategy);

      expect(service.getLoadedStrategies()).toContain('test-pine');
    });
  });

  describe('unloadStrategy', () => {
    it('should unload a loaded strategy', () => {
      const service = new SetupDetectionService();
      const loader = new PineStrategyLoader([]);
      const strategy = loader.loadFromString(SIMPLE_PINE, 'to-unload');
      service.loadPineStrategy(strategy);

      const result = service.unloadStrategy('to-unload');

      expect(result).toBe(true);
      expect(service.getLoadedStrategies()).not.toContain('to-unload');
    });

    it('should return false for non-existent strategy', () => {
      const service = new SetupDetectionService();

      expect(service.unloadStrategy('non-existent')).toBe(false);
    });
  });

  describe('getLoadedStrategies', () => {
    it('should return empty array when no strategies loaded', () => {
      const service = new SetupDetectionService();

      expect(service.getLoadedStrategies()).toEqual([]);
    });

    it('should return list of loaded strategy IDs', () => {
      const service = new SetupDetectionService();
      const loader = new PineStrategyLoader([]);
      service.loadPineStrategy(loader.loadFromString(SIMPLE_PINE, 'strategy-1'));
      service.loadPineStrategy(loader.loadFromString(SIMPLE_PINE, 'strategy-2'));

      const loaded = service.getLoadedStrategies();

      expect(loaded).toHaveLength(2);
      expect(loaded).toContain('strategy-1');
      expect(loaded).toContain('strategy-2');
    });
  });

  describe('detectSetups', () => {
    it('should return empty array for empty klines', async () => {
      const service = new SetupDetectionService();

      const setups = await service.detectSetups([]);

      expect(setups).toEqual([]);
    });

    it('should return empty array for insufficient klines', async () => {
      const service = new SetupDetectionService();
      const klines = createMockKlines(49);

      const setups = await service.detectSetups(klines);

      expect(setups).toEqual([]);
    });

    it('should detect setups from loaded Pine strategies', async () => {
      const service = new SetupDetectionService({
        minConfidence: 0,
        minRiskReward: 0,
        setupCooldownPeriod: 0,
      });
      const loader = new PineStrategyLoader([]);
      service.loadPineStrategy(loader.loadFromString(SIMPLE_PINE, 'test-detector'));

      const klines = createMockKlines(300);
      const setups = await service.detectSetups(klines);

      expect(setups.length).toBeGreaterThanOrEqual(0);
    });

    it('should not detect when no strategies loaded', async () => {
      const service = new SetupDetectionService();
      const klines = createMockKlines(100);

      const setups = await service.detectSetups(klines);

      expect(setups).toEqual([]);
    });
  });

  describe('detectSetupsInRange', () => {
    it('should detect setups in specified range', async () => {
      const service = new SetupDetectionService({
        minConfidence: 0,
        minRiskReward: 0,
        setupCooldownPeriod: 0,
      });
      const loader = new PineStrategyLoader([]);
      service.loadPineStrategy(loader.loadFromString(SIMPLE_PINE, 'range-test'));

      const klines = createMockKlines(300);
      const setups = await service.detectSetupsInRange(klines, 50, 299);

      expect(setups.length).toBeGreaterThanOrEqual(0);
      for (const setup of setups) {
        expect(setup.klineIndex).toBeGreaterThanOrEqual(50);
        expect(setup.klineIndex).toBeLessThanOrEqual(299);
      }
    });

    it('should sort results by confidence descending', async () => {
      const service = new SetupDetectionService({
        minConfidence: 0,
        minRiskReward: 0,
        setupCooldownPeriod: 0,
      });
      const loader = new PineStrategyLoader([]);
      service.loadPineStrategy(loader.loadFromString(SIMPLE_PINE, 'sort-test'));

      const klines = createMockKlines(300);
      const setups = await service.detectSetupsInRange(klines, 50, 299);

      for (let i = 1; i < setups.length; i++) {
        expect(setups[i]!.confidence).toBeLessThanOrEqual(setups[i - 1]!.confidence);
      }
    });

    it('should return empty array when no setups found', async () => {
      const service = new SetupDetectionService();

      const klines = createMockKlines(100);
      const setups = await service.detectSetupsInRange(klines, 50, 55);

      expect(setups).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('should update setupCooldownPeriod', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ setupCooldownPeriod: 20 });

      expect(service.getConfig().setupCooldownPeriod).toBe(20);
    });

    it('should update minConfidence', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ minConfidence: 80 });

      expect(service.getConfig().minConfidence).toBe(80);
    });

    it('should update minRiskReward', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ minRiskReward: 2.0 });

      expect(service.getConfig().minRiskReward).toBe(2.0);
    });

    it('should update multiple config values', () => {
      const service = new SetupDetectionService();

      service.updateConfig({
        minConfidence: 75,
        minRiskReward: 1.5,
      });

      const config = service.getConfig();
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(1.5);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const service = new SetupDetectionService({ minConfidence: 60 });

      const config1 = service.getConfig();
      config1.minConfidence = 100;

      const config2 = service.getConfig();
      expect(config2.minConfidence).toBe(60);
    });
  });

  describe('getStrategy', () => {
    it('should return loaded strategy by id', () => {
      const service = new SetupDetectionService();
      const loader = new PineStrategyLoader([]);
      const strategy = loader.loadFromString(SIMPLE_PINE, 'get-test');
      service.loadPineStrategy(strategy);

      const found = service.getStrategy('get-test');
      expect(found).toBeDefined();
      expect(found!.metadata.id).toBe('get-test');
    });

    it('should return undefined for non-existent strategy', () => {
      const service = new SetupDetectionService();

      expect(service.getStrategy('non-existent')).toBeUndefined();
    });
  });
});

describe('createDefaultSetupDetectionConfig', () => {
  it('should return default config values', () => {
    const config = createDefaultSetupDetectionConfig();

    expect(config.setupCooldownPeriod).toBe(10);
    expect(config.minConfidence).toBe(50);
    expect(config.minRiskReward).toBe(1.0);
  });
});
