import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import type { Kline } from '@marketmind/types';
import { PineStrategyLoader } from '../PineStrategyLoader';
import { PineStrategyRunner } from '../PineStrategyRunner';
import { SetupDetectionService } from '../../setup-detection/SetupDetectionService';

const STRATEGIES_DIR = join(__dirname, '../../../../strategies/builtin');

const makeKline = (
  index: number,
  base: number,
  range = 400,
  vol = 1500
): Kline => ({
  openTime: 1700000000000 + index * 3600000,
  open: String(base),
  high: String(base + range / 2),
  low: String(base - range / 2),
  close: String(base + 50),
  volume: String(vol),
  closeTime: 1700000000000 + index * 3600000 + 3599999,
  quoteVolume: '0',
  trades: 100,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const makeSinusoidalKlines = (count: number, base = 50000, amplitude = 5000): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    makeKline(i, base + Math.sin(i * 0.05) * amplitude + i * 10)
  );

describe('Pine Integration with SetupDetectionService', () => {
  describe('loadPineStrategy + detectSetupsInRange', () => {
    it('should detect setups from a loaded Pine strategy', async () => {
      const service = new SetupDetectionService({
        minConfidence: 0,
        minRiskReward: 0,
      });

      const pineLoader = new PineStrategyLoader([STRATEGIES_DIR]);
      const hullStrategy = await pineLoader.loadFile(
        join(STRATEGIES_DIR, 'hull-ma-trend.pine')
      );
      service.loadPineStrategy(hullStrategy);

      expect(service.getLoadedStrategies()).toContain('hull-ma-trend');

      const klines = makeSinusoidalKlines(300);
      const setups = await service.detectSetupsInRange(klines, 50, 299);

      expect(setups.length).toBeGreaterThan(0);
      for (const setup of setups) {
        expect(setup.type).toBe('hull-ma-trend');
        expect(['LONG', 'SHORT']).toContain(setup.direction);
        expect(setup.entryPrice).toBeGreaterThan(0);
      }
    });

    it('should load multiple Pine strategies in same service', async () => {
      const service = new SetupDetectionService({
        minConfidence: 0,
        minRiskReward: 0,
      });

      const pineLoader = new PineStrategyLoader([STRATEGIES_DIR]);
      const goldenCrossPine = await pineLoader.loadFile(
        join(STRATEGIES_DIR, 'golden-cross-sma.pine')
      );
      service.loadPineStrategy(goldenCrossPine);

      const hullPine = await pineLoader.loadFile(
        join(STRATEGIES_DIR, 'hull-ma-trend.pine')
      );
      service.loadPineStrategy(hullPine);

      const loaded = service.getLoadedStrategies();
      expect(loaded).toContain('golden-cross-sma');
      expect(loaded).toContain('hull-ma-trend');

      const klines = makeSinusoidalKlines(300);
      const setups = await service.detectSetupsInRange(klines, 50, 299);

      const types = new Set(setups.map((s) => s.type));
      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it('should unload Pine strategies', () => {
      const service = new SetupDetectionService();
      const pineLoader = new PineStrategyLoader([]);
      const strategy = pineLoader.loadFromString(`
//@version=5
indicator('Test')
plot(0, 'signal')
`, 'test-pine');

      service.loadPineStrategy(strategy);
      expect(service.getLoadedStrategies()).toContain('test-pine');

      service.unloadStrategy('test-pine');
      expect(service.getLoadedStrategies()).not.toContain('test-pine');
    });
  });

  describe('Pine signal validation', () => {
    it('golden-cross-sma.pine should produce signals on crossover data', async () => {
      const klines = makeSinusoidalKlines(500, 50000, 8000);

      const pineRunner = new PineStrategyRunner();
      const pineLoader = new PineStrategyLoader([STRATEGIES_DIR]);
      const goldenCrossPine = await pineLoader.loadFile(
        join(STRATEGIES_DIR, 'golden-cross-sma.pine')
      );
      const pineResults = await pineRunner.detectSignals(goldenCrossPine, klines, {
        minConfidence: 0,
        minRiskReward: 0,
      });
      const pineSetups = pineResults
        .filter((r) => r.setup !== null && (r.triggerKlineIndex ?? 0) >= 50)
        .map((r) => r.setup!);

      expect(pineSetups.length).toBeGreaterThan(0);
      for (const setup of pineSetups) {
        expect(['LONG', 'SHORT']).toContain(setup.direction);
        expect(setup.entryPrice).toBeGreaterThan(0);
      }
    });

    it('hull-ma-trend: Pine signals should have valid SL/TP levels', async () => {
      const klines = makeSinusoidalKlines(300);

      const pineRunner = new PineStrategyRunner();
      const pineLoader = new PineStrategyLoader([STRATEGIES_DIR]);
      const hullPine = await pineLoader.loadFile(
        join(STRATEGIES_DIR, 'hull-ma-trend.pine')
      );
      const pineResults = await pineRunner.detectSignals(hullPine, klines, {
        minConfidence: 0,
        minRiskReward: 0,
      });
      const pineSetups = pineResults.filter((r) => r.setup !== null).map((r) => r.setup!);

      expect(pineSetups.length).toBeGreaterThan(0);
      for (const setup of pineSetups) {
        if (setup.direction === 'LONG') {
          expect(setup.stopLoss).toBeLessThan(setup.entryPrice);
          expect(setup.takeProfit).toBeGreaterThan(setup.entryPrice);
        } else {
          expect(setup.stopLoss).toBeGreaterThan(setup.entryPrice);
          expect(setup.takeProfit).toBeLessThan(setup.entryPrice);
        }
        expect(setup.riskRewardRatio).toBeGreaterThan(0);
      }
    });
  });
});
