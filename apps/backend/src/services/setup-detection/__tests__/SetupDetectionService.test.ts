import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline, StrategyDefinition, TradingSetup } from '@marketmind/types';

const mockDetect = vi.fn();
const mockLoadAll = vi.fn();
const mockLoadFromString = vi.fn();

vi.mock('../dynamic', () => ({
  StrategyInterpreter: class MockStrategyInterpreter {
    detect = mockDetect;
    constructor() {}
  },
  StrategyLoader: class MockStrategyLoader {
    loadAll = mockLoadAll;
    loadFromString = mockLoadFromString;
    constructor() {}
  },
}));

import { SetupDetectionService, createDefaultSetupDetectionConfig } from '../SetupDetectionService';

const createMockKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    klines.push({
      openTime: Date.now() - (count - i) * 3600000,
      closeTime: Date.now() - (count - i - 1) * 3600000,
      open: '50000',
      high: '50500',
      low: '49500',
      close: '50100',
      volume: '1000',
      quoteVolume: '50100000',
      trades: 1000,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '25050000',
    });
  }
  return klines;
};

const createMockStrategy = (id: string, name: string): StrategyDefinition => ({
  id,
  name,
  version: '1.0.0',
  description: 'Test strategy',
  author: 'test',
  parameters: {},
  indicators: {},
  entry: {},
  exit: {
    stopLoss: { type: 'percent', value: 2 },
    takeProfit: { type: 'percent', value: 4 },
  },
});

const createMockSetup = (type: string, direction: 'LONG' | 'SHORT', confidence: number): TradingSetup => ({
  id: `setup-${Date.now()}`,
  type,
  direction,
  confidence,
  entryPrice: 50000,
  stopLoss: 49000,
  takeProfit: 52000,
  openTime: Date.now(),
  klineIndex: 49,
  riskRewardRatio: 2,
  volumeConfirmation: true,
  indicatorConfluence: 0.8,
  setupData: {},
  visible: true,
  source: 'algorithm',
});

describe('SetupDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetect.mockReturnValue({ setup: null, confidence: 0 });
    mockLoadAll.mockResolvedValue([]);
    mockLoadFromString.mockReturnValue(createMockStrategy('parsed', 'Parsed Strategy'));
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new SetupDetectionService();
      const config = service.getConfig();

      expect(config.enableTrendFilter).toBe(false);
      expect(config.allowCounterTrend).toBe(true);
      expect(config.trendEmaPeriod).toBe(200);
      expect(config.setupCooldownPeriod).toBe(10);
      expect(config.minConfidence).toBe(50);
      expect(config.minRiskReward).toBe(1.0);
    });

    it('should create with custom config', () => {
      const service = new SetupDetectionService({
        enableTrendFilter: true,
        allowCounterTrend: false,
        trendEmaPeriod: 100,
        setupCooldownPeriod: 5,
        minConfidence: 70,
        minRiskReward: 1.5,
      });

      const config = service.getConfig();
      expect(config.enableTrendFilter).toBe(true);
      expect(config.allowCounterTrend).toBe(false);
      expect(config.trendEmaPeriod).toBe(100);
      expect(config.setupCooldownPeriod).toBe(5);
      expect(config.minConfidence).toBe(70);
      expect(config.minRiskReward).toBe(1.5);
    });

    it('should load inline strategies from config', () => {
      const strategies = [createMockStrategy('inline-1', 'Inline Strategy 1')];
      const service = new SetupDetectionService({
        dynamicStrategies: strategies,
      });

      expect(service.getLoadedStrategies()).toContain('inline-1');
    });
  });

  describe('loadStrategy', () => {
    it('should load a strategy definition', () => {
      const service = new SetupDetectionService();
      const strategy = createMockStrategy('test-strategy', 'Test Strategy');

      service.loadStrategy(strategy);

      expect(service.getLoadedStrategies()).toContain('test-strategy');
    });

    it('should load strategy with parameter overrides', () => {
      const service = new SetupDetectionService();
      const strategy = createMockStrategy('param-strategy', 'Param Strategy');

      service.loadStrategy(strategy, { period: 20, multiplier: 2.5 });

      expect(service.getLoadedStrategies()).toContain('param-strategy');
    });
  });

  describe('loadStrategyFromJson', () => {
    it('should load strategy from JSON string', () => {
      const service = new SetupDetectionService();
      const jsonContent = JSON.stringify(createMockStrategy('json-strategy', 'JSON Strategy'));

      const result = service.loadStrategyFromJson(jsonContent);

      expect(result.id).toBe('parsed');
      expect(mockLoadFromString).toHaveBeenCalledWith(jsonContent);
    });

    it('should load strategy with parameter overrides', () => {
      const service = new SetupDetectionService();
      const jsonContent = JSON.stringify(createMockStrategy('json-strategy', 'JSON Strategy'));

      service.loadStrategyFromJson(jsonContent, { period: 14 });

      expect(service.getLoadedStrategies()).toContain('parsed');
    });
  });

  describe('unloadStrategy', () => {
    it('should unload a loaded strategy', () => {
      const service = new SetupDetectionService();
      const strategy = createMockStrategy('to-unload', 'To Unload');
      service.loadStrategy(strategy);

      const result = service.unloadStrategy('to-unload');

      expect(result).toBe(true);
      expect(service.getLoadedStrategies()).not.toContain('to-unload');
    });

    it('should return false for non-existent strategy', () => {
      const service = new SetupDetectionService();

      const result = service.unloadStrategy('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getLoadedStrategies', () => {
    it('should return empty array when no strategies loaded', () => {
      const service = new SetupDetectionService();

      expect(service.getLoadedStrategies()).toEqual([]);
    });

    it('should return list of loaded strategy IDs', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('strategy-1', 'Strategy 1'));
      service.loadStrategy(createMockStrategy('strategy-2', 'Strategy 2'));

      const loaded = service.getLoadedStrategies();

      expect(loaded).toHaveLength(2);
      expect(loaded).toContain('strategy-1');
      expect(loaded).toContain('strategy-2');
    });
  });

  describe('loadStrategiesFromDirectory', () => {
    it('should load strategies from directory', async () => {
      const strategies = [
        createMockStrategy('dir-1', 'Dir Strategy 1'),
        createMockStrategy('dir-2', 'Dir Strategy 2'),
      ];
      mockLoadAll.mockResolvedValue(strategies);

      const service = new SetupDetectionService();
      await service.loadStrategiesFromDirectory('/path/to/strategies');

      expect(mockLoadAll).toHaveBeenCalled();
      expect(service.getLoadedStrategies()).toContain('dir-1');
      expect(service.getLoadedStrategies()).toContain('dir-2');
    });

    it('should handle empty directory', async () => {
      mockLoadAll.mockResolvedValue([]);

      const service = new SetupDetectionService();
      await service.loadStrategiesFromDirectory('/empty/path');

      expect(service.getLoadedStrategies()).toEqual([]);
    });
  });

  describe('detectSetups', () => {
    it('should return empty array for empty klines', () => {
      const service = new SetupDetectionService();

      const setups = service.detectSetups([]);

      expect(setups).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const service = new SetupDetectionService();
      const klines = createMockKlines(49);

      const setups = service.detectSetups(klines);

      expect(setups).toEqual([]);
    });

    it('should detect setups from loaded strategies', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('detector', 'Detector'));

      const mockSetup = createMockSetup('detector', 'LONG', 80);
      mockDetect.mockReturnValue({ setup: mockSetup, confidence: 80 });

      const klines = createMockKlines(100);
      const setups = service.detectSetups(klines);

      expect(setups).toHaveLength(1);
      expect(setups[0]!.type).toBe('detector');
    });

    it('should sort setups by confidence descending', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('low-conf', 'Low Confidence'));
      service.loadStrategy(createMockStrategy('high-conf', 'High Confidence'));

      const lowSetup = createMockSetup('low-conf', 'LONG', 60);
      const highSetup = createMockSetup('high-conf', 'SHORT', 90);

      mockDetect
        .mockReturnValueOnce({ setup: lowSetup, confidence: 60 })
        .mockReturnValueOnce({ setup: highSetup, confidence: 90 });

      const klines = createMockKlines(100);
      const setups = service.detectSetups(klines);

      expect(setups).toHaveLength(2);
      expect(setups[0]!.confidence).toBe(90);
      expect(setups[1]!.confidence).toBe(60);
    });

    it('should respect cooldown period', () => {
      const service = new SetupDetectionService({ setupCooldownPeriod: 5 });
      service.loadStrategy(createMockStrategy('cooldown-test', 'Cooldown Test'));

      const mockSetup = createMockSetup('cooldown-test', 'LONG', 75);
      mockDetect.mockReturnValue({ setup: mockSetup, confidence: 75 });

      const klines = createMockKlines(100);

      const firstSetups = service.detectSetups(klines);
      expect(firstSetups).toHaveLength(1);

      const secondSetups = service.detectSetups(klines);
      expect(secondSetups).toHaveLength(0);
    });

    it('should not detect when no strategies loaded', () => {
      const service = new SetupDetectionService();
      const klines = createMockKlines(100);

      const setups = service.detectSetups(klines);

      expect(setups).toEqual([]);
    });
  });

  describe('detectSetupsInRange', () => {
    it('should detect setups in specified range', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('range-detector', 'Range Detector'));

      const mockSetup = createMockSetup('range-detector', 'LONG', 70);
      mockDetect.mockReturnValue({ setup: mockSetup, confidence: 70 });

      const klines = createMockKlines(100);
      service.detectSetupsInRange(klines, 50, 55);

      expect(mockDetect).toHaveBeenCalledTimes(6);
    });

    it('should sort results by confidence', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('range-sort', 'Range Sort'));

      mockDetect
        .mockReturnValueOnce({ setup: createMockSetup('range-sort', 'LONG', 50), confidence: 50 })
        .mockReturnValueOnce({ setup: createMockSetup('range-sort', 'LONG', 80), confidence: 80 })
        .mockReturnValueOnce({ setup: createMockSetup('range-sort', 'LONG', 65), confidence: 65 });

      const klines = createMockKlines(100);
      const setups = service.detectSetupsInRange(klines, 50, 52);

      expect(setups[0]!.confidence).toBe(80);
      expect(setups[1]!.confidence).toBe(65);
      expect(setups[2]!.confidence).toBe(50);
    });

    it('should return empty array when no setups found', () => {
      const service = new SetupDetectionService();
      service.loadStrategy(createMockStrategy('empty-range', 'Empty Range'));

      mockDetect.mockReturnValue({ setup: null, confidence: 0 });

      const klines = createMockKlines(100);
      const setups = service.detectSetupsInRange(klines, 50, 55);

      expect(setups).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('should update enableTrendFilter', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ enableTrendFilter: true });

      expect(service.getConfig().enableTrendFilter).toBe(true);
    });

    it('should update allowCounterTrend', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ allowCounterTrend: false });

      expect(service.getConfig().allowCounterTrend).toBe(false);
    });

    it('should update trendEmaPeriod', () => {
      const service = new SetupDetectionService();

      service.updateConfig({ trendEmaPeriod: 50 });

      expect(service.getConfig().trendEmaPeriod).toBe(50);
    });

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
        enableTrendFilter: true,
        minConfidence: 75,
        minRiskReward: 1.5,
      });

      const config = service.getConfig();
      expect(config.enableTrendFilter).toBe(true);
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
});

describe('createDefaultSetupDetectionConfig', () => {
  it('should return default config values', () => {
    const config = createDefaultSetupDetectionConfig();

    expect(config.enableTrendFilter).toBe(false);
    expect(config.allowCounterTrend).toBe(true);
    expect(config.trendEmaPeriod).toBe(200);
    expect(config.setupCooldownPeriod).toBe(10);
    expect(config.minConfidence).toBe(50);
    expect(config.minRiskReward).toBe(1.0);
  });
});
