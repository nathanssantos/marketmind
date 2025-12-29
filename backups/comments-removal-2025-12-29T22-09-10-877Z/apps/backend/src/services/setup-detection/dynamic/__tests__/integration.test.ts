import type { Kline, StrategyDefinition } from '@marketmind/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { SetupDetectionService } from '../../SetupDetectionService';

function createMockKline(close: number, index: number): Kline {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: (close * 0.99).toString(),
    high: (close * 1.02).toString(),
    low: (close * 0.98).toString(),
    close: close.toString(),
    volume: (1000 + Math.random() * 500).toString(),
    quoteVolume: ((1000 + Math.random() * 500) * close).toString(),
    trades: Math.floor(100 + Math.random() * 100),
    takerBuyBaseVolume: (500 + Math.random() * 250).toString(),
    takerBuyQuoteVolume: ((500 + Math.random() * 250) * close).toString(),
  };
}

function generateTrendingKlines(count: number, direction: 'up' | 'down'): Kline[] {
  let price = 100;
  const klines: Kline[] = [];

  for (let i = 0; i < count; i++) {
    price += direction === 'up' ? 0.5 + Math.random() * 0.5 : -0.5 - Math.random() * 0.5;
    klines.push(createMockKline(price, i));
  }

  return klines;
}

function generateCrossoverKlines(): Kline[] {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < 30; i++) {
    price -= 0.3;
    klines.push(createMockKline(price, i));
  }

  for (let i = 30; i < 60; i++) {
    price += 0.8;
    klines.push(createMockKline(price, i));
  }

  return klines;
}

describe('Dynamic Strategy Integration', () => {
  let service: SetupDetectionService;

  const emaCrossoverStrategy: StrategyDefinition = {
    id: 'test-ema-crossover',
    name: 'Test EMA Crossover',
    version: '1.0.0',
    description: 'Test strategy for integration',
    tags: ['test'],
    parameters: {
      fastPeriod: { default: 5, min: 3, max: 10, step: 1 },
      slowPeriod: { default: 10, min: 8, max: 20, step: 1 },
      atrMultiplier: { default: 1.5, min: 1, max: 3, step: 0.5 },
    },
    indicators: {
      emaFast: { type: 'ema', params: { period: '$fastPeriod' } },
      emaSlow: { type: 'ema', params: { period: '$slowPeriod' } },
      atr: { type: 'atr', params: { period: 14 } },
    },
    entry: {
      long: {
        operator: 'AND',
        conditions: [{ left: 'emaFast', op: 'crossover', right: 'emaSlow' }],
      },
      short: {
        operator: 'AND',
        conditions: [{ left: 'emaFast', op: 'crossunder', right: 'emaSlow' }],
      },
    },
    exit: {
      stopLoss: { type: 'atr', multiplier: '$atrMultiplier', indicator: 'atr' },
      takeProfit: { type: 'riskReward', multiplier: 2 },
    },
    filters: {
      minConfidence: 50,
      minRiskReward: 1.0,
    },
  };

  const rsiOversoldStrategy: StrategyDefinition = {
    id: 'test-rsi-oversold',
    name: 'Test RSI Oversold',
    version: '1.0.0',
    description: 'Buy when RSI is oversold',
    tags: ['test', 'mean-reversion'],
    parameters: {
      rsiPeriod: { default: 14, min: 7, max: 21, step: 1 },
      oversoldLevel: { default: 30, min: 20, max: 40, step: 5 },
    },
    indicators: {
      rsi: { type: 'rsi', params: { period: '$rsiPeriod' } },
      atr: { type: 'atr', params: { period: 14 } },
    },
    entry: {
      long: {
        operator: 'AND',
        conditions: [{ left: 'rsi', op: '<', right: '$oversoldLevel' }],
      },
    },
    exit: {
      stopLoss: { type: 'percent', value: 2 },
      takeProfit: { type: 'percent', value: 4 },
    },
  };

  beforeEach(() => {
    service = new SetupDetectionService();
  });

  describe('SetupDetectionService with dynamic strategies', () => {
    it('should load a dynamic strategy', () => {
      service.loadStrategy(emaCrossoverStrategy);

      const loaded = service.getLoadedStrategies();

      expect(loaded).toContain('test-ema-crossover');
    });

    it('should load multiple dynamic strategies', () => {
      service.loadStrategy(emaCrossoverStrategy);
      service.loadStrategy(rsiOversoldStrategy);

      const loaded = service.getLoadedStrategies();

      expect(loaded).toHaveLength(2);
      expect(loaded).toContain('test-ema-crossover');
      expect(loaded).toContain('test-rsi-oversold');
    });

    it('should unload a dynamic strategy', () => {
      service.loadStrategy(emaCrossoverStrategy);
      expect(service.getLoadedStrategies()).toHaveLength(1);

      const removed = service.unloadStrategy('test-ema-crossover');

      expect(removed).toBe(true);
      expect(service.getLoadedStrategies()).toHaveLength(0);
    });

    it('should return false when unloading non-existent strategy', () => {
      const removed = service.unloadStrategy('non-existent');

      expect(removed).toBe(false);
    });

    it('should load strategy with parameter overrides', () => {
      service.loadStrategy(emaCrossoverStrategy, { fastPeriod: 3, slowPeriod: 8 });

      const loaded = service.getLoadedStrategies();

      expect(loaded).toContain('test-ema-crossover');
    });

    it('should load strategy from JSON string', () => {
      const json = JSON.stringify(emaCrossoverStrategy);

      const loaded = service.loadStrategyFromJson(json);

      expect(loaded.id).toBe('test-ema-crossover');
      expect(service.getLoadedStrategies()).toContain('test-ema-crossover');
    });
  });

  describe('Setup detection with dynamic strategies', () => {
    it('should detect setups from dynamic strategy', () => {
      service.loadStrategy(emaCrossoverStrategy);
      const klines = generateCrossoverKlines();

      const setups = service.detectSetups(klines);

      expect(Array.isArray(setups)).toBe(true);
    });

    it('should detect setups in range', () => {
      service.loadStrategy(emaCrossoverStrategy);
      const klines = generateCrossoverKlines();

      const setups = service.detectSetupsInRange(klines, 50, 59);

      expect(Array.isArray(setups)).toBe(true);
    });

    it('should return empty array when no strategies are loaded', () => {
      const klines = generateTrendingKlines(100, 'up');

      const setups = service.detectSetups(klines);

      expect(setups).toHaveLength(0);
    });

    it('should return empty array for insufficient klines', () => {
      service.loadStrategy(emaCrossoverStrategy);
      const klines = generateTrendingKlines(20, 'up');

      const setups = service.detectSetups(klines);

      expect(setups).toHaveLength(0);
    });

    it('should sort setups by confidence', () => {
      service.loadStrategy(emaCrossoverStrategy);
      service.loadStrategy(rsiOversoldStrategy);
      const klines = generateCrossoverKlines();

      const setups = service.detectSetups(klines);

      if (setups.length > 1) {
        for (let i = 1; i < setups.length; i++) {
          expect(setups[i - 1]!.confidence).toBeGreaterThanOrEqual(setups[i]!.confidence);
        }
      }
    });
  });

  describe('Setup structure', () => {
    it('should return setup with correct structure', () => {
      service.loadStrategy(rsiOversoldStrategy);
      const klines = generateTrendingKlines(100, 'down');

      const setups = service.detectSetupsInRange(klines, 50, 99);

      if (setups.length > 0) {
        const setup = setups[0]!;
        expect(setup).toHaveProperty('id');
        expect(setup).toHaveProperty('type');
        expect(setup).toHaveProperty('direction');
        expect(setup).toHaveProperty('entryPrice');
        expect(setup).toHaveProperty('stopLoss');
        expect(setup).toHaveProperty('takeProfit');
        expect(setup).toHaveProperty('confidence');
        expect(setup).toHaveProperty('riskRewardRatio');
        expect(setup).toHaveProperty('openTime');
        expect(['LONG', 'SHORT']).toContain(setup.direction);
        expect(typeof setup.entryPrice).toBe('number');
        expect(typeof setup.stopLoss).toBe('number');
        expect(typeof setup.takeProfit).toBe('number');
        expect(typeof setup.confidence).toBe('number');
        expect(setup.confidence).toBeGreaterThanOrEqual(0);
        expect(setup.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('should set correct setup type from strategy id', () => {
      service.loadStrategy(rsiOversoldStrategy);
      const klines = generateTrendingKlines(100, 'down');

      const setups = service.detectSetupsInRange(klines, 50, 99);

      if (setups.length > 0) {
        expect(setups[0]!.type).toBe('test-rsi-oversold');
      }
    });
  });

  describe('Config updates', () => {
    it('should respect configuration', () => {
      const serviceConfig = new SetupDetectionService({
        minConfidence: 70,
        minRiskReward: 2.0,
      });

      serviceConfig.loadStrategy(emaCrossoverStrategy);

      expect(serviceConfig.getLoadedStrategies()).toContain('test-ema-crossover');
    });

    it('should work with dynamic strategies', () => {
      const serviceDynamic = new SetupDetectionService();

      serviceDynamic.loadStrategy(emaCrossoverStrategy);

      expect(serviceDynamic.getLoadedStrategies()).toContain('test-ema-crossover');
    });
  });
});
