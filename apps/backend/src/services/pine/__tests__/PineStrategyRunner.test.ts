import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import type { Kline } from '@marketmind/types';
import { PineStrategyRunner } from '../PineStrategyRunner';
import { PineStrategyLoader } from '../PineStrategyLoader';

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

const makeTrendingKlines = (count: number, startPrice = 50000, step = 100): Kline[] =>
  Array.from({ length: count }, (_, i) => makeKline(i, startPrice + i * step));

const makeSinusoidalKlines = (count: number, base = 50000, amplitude = 5000): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    makeKline(i, base + Math.sin(i * 0.05) * amplitude + i * 10)
  );

describe('PineStrategyRunner', () => {
  const runner = new PineStrategyRunner();
  const loader = new PineStrategyLoader([STRATEGIES_DIR]);

  describe('detectSignals', () => {
    it('should return empty array for empty klines', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Test')
plot(0, 'signal')
`, 'test');
      const results = await runner.detectSignals(strategy, []);
      expect(results).toEqual([]);
    });

    it('should detect long signals from plot output', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Always Long', overlay=true)
plot(1, 'signal', display=display.none)
plot(close * 0.95, 'stopLoss', display=display.none)
plot(close * 1.15, 'takeProfit', display=display.none)
plot(75, 'confidence', display=display.none)
`, 'always-long');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines);

      expect(results.length).toBeGreaterThan(0);
      const withSetup = results.filter((r) => r.setup !== null);
      expect(withSetup.length).toBeGreaterThan(0);
      for (const r of withSetup) {
        expect(r.setup!.direction).toBe('LONG');
        expect(r.setup!.stopLoss).toBeDefined();
        expect(r.setup!.takeProfit).toBeDefined();
        expect(r.confidence).toBe(75);
      }
    });

    it('should detect short signals', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Always Short', overlay=true)
plot(-1, 'signal', display=display.none)
plot(close * 1.05, 'stopLoss', display=display.none)
plot(close * 0.85, 'takeProfit', display=display.none)
plot(80, 'confidence', display=display.none)
`, 'always-short');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines);

      expect(results.length).toBeGreaterThan(0);
      const withSetup = results.filter((r) => r.setup !== null);
      expect(withSetup.length).toBeGreaterThan(0);
      for (const r of withSetup) {
        expect(r.setup!.direction).toBe('SHORT');
      }
    });

    it('should skip bars with no signal (value 0)', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Sparse Signal', overlay=true)
sig = bar_index == 5 ? 1 : 0
plot(sig, 'signal', display=display.none)
plot(sig == 1 ? close * 0.95 : na, 'stopLoss', display=display.none)
plot(sig == 1 ? close * 1.15 : na, 'takeProfit', display=display.none)
`, 'sparse');

      const klines = makeTrendingKlines(20);
      const results = await runner.detectSignals(strategy, klines);

      const withSetup = results.filter((r) => r.setup !== null);
      expect(withSetup.length).toBe(1);
      expect(withSetup[0]!.triggerKlineIndex).toBe(5);
    });

    it('should filter by minConfidence', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Low Confidence', overlay=true)
plot(1, 'signal', display=display.none)
plot(close - 100, 'stopLoss', display=display.none)
plot(close + 200, 'takeProfit', display=display.none)
plot(30, 'confidence', display=display.none)
`, 'low-conf');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines, {
        minConfidence: 50,
      });

      for (const r of results) {
        expect(r.setup).toBeNull();
        expect(r.confidence).toBe(30);
      }
    });

    it('should filter by minRiskReward', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Bad RR', overlay=true)
plot(1, 'signal', display=display.none)
plot(close - 100, 'stopLoss', display=display.none)
plot(close + 50, 'takeProfit', display=display.none)
plot(80, 'confidence', display=display.none)
`, 'bad-rr');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines, {
        minRiskReward: 2.0,
      });

      for (const r of results) {
        expect(r.setup).toBeNull();
      }
    });

    it('should enforce minimum stop distance', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Tiny Stop', overlay=true)
plot(1, 'signal', display=display.none)
plot(close - 0.01, 'stopLoss', display=display.none)
plot(close + 5000, 'takeProfit', display=display.none)
plot(80, 'confidence', display=display.none)
`, 'tiny-stop');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines, {
        minRiskReward: 0,
      });

      const withSetup = results.filter((r) => r.setup !== null);
      expect(withSetup.length).toBeGreaterThan(0);
      for (const r of withSetup) {
        const distance = Math.abs(r.setup!.entryPrice - r.setup!.stopLoss!);
        const minDistance = r.setup!.entryPrice * 0.01;
        expect(distance).toBeGreaterThanOrEqual(minDistance - 0.01);
      }
    });

    it('should use default confidence of 70 when confidence plot is missing', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('No Confidence Plot', overlay=true)
plot(1, 'signal', display=display.none)
plot(close - 500, 'stopLoss', display=display.none)
plot(close + 1000, 'takeProfit', display=display.none)
`, 'no-conf');

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines);

      const withSetup = results.filter((r) => r.setup !== null);
      expect(withSetup.length).toBeGreaterThan(0);
      expect(withSetup[0]!.confidence).toBe(70);
    });

    it('should set correct setup metadata', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Meta Test', overlay=true)
plot(bar_index == 3 ? 1 : 0, 'signal', display=display.none)
plot(bar_index == 3 ? close - 500 : na, 'stopLoss', display=display.none)
plot(bar_index == 3 ? close + 1000 : na, 'takeProfit', display=display.none)
`, 'meta-test');
      strategy.metadata.name = 'Meta Test Strategy';

      const klines = makeTrendingKlines(10);
      const results = await runner.detectSignals(strategy, klines);

      const setup = results.find((r) => r.setup !== null)?.setup;
      expect(setup).toBeDefined();
      expect(setup!.type).toBe('meta-test');
      expect(setup!.source).toBe('algorithm');
      expect(setup!.visible).toBe(true);
      expect(setup!.setupData).toEqual({
        source: 'pine',
        strategyName: 'Meta Test Strategy',
      });
    });
  });

  describe('detectAtIndex', () => {
    it('should detect signal at specific index', async () => {
      const strategy = loader.loadFromString(`
//@version=5
indicator('Index Test', overlay=true)
sig = bar_index == 5 ? 1 : 0
plot(sig, 'signal', display=display.none)
plot(sig == 1 ? close - 500 : na, 'stopLoss', display=display.none)
plot(sig == 1 ? close + 1000 : na, 'takeProfit', display=display.none)
`, 'idx-test');

      const klines = makeTrendingKlines(20);

      const resultAtSignal = await runner.detectAtIndex(strategy, klines, 5);
      expect(resultAtSignal.setup).not.toBeNull();
      expect(resultAtSignal.setup!.direction).toBe('LONG');

      const resultNoSignal = await runner.detectAtIndex(strategy, klines, 3);
      expect(resultNoSignal.setup).toBeNull();
    });
  });

  describe('builtin strategy integration', () => {
    it('golden-cross-sma.pine should produce valid signals on sinusoidal data', async () => {
      const strategy = await loader.loadFile(
        join(STRATEGIES_DIR, 'golden-cross-sma.pine')
      );
      expect(strategy.metadata.id).toBe('golden-cross-sma');
      expect(strategy.metadata.name).toBe('Golden Cross SMA 50/200');

      const klines = makeSinusoidalKlines(300);
      const results = await runner.detectSignals(strategy, klines);

      const signals = results.filter((r) => r.setup !== null);
      expect(signals.length).toBeGreaterThan(0);

      for (const r of signals) {
        expect(r.setup!.type).toBe('golden-cross-sma');
        expect(['LONG', 'SHORT']).toContain(r.setup!.direction);
        expect(r.setup!.entryPrice).toBeGreaterThan(0);
        expect(r.setup!.stopLoss).toBeGreaterThan(0);
        expect(r.setup!.takeProfit).toBeGreaterThan(0);
        expect(r.confidence).toBeGreaterThanOrEqual(50);
      }
    });

    it('hull-ma-trend.pine should produce valid signals', async () => {
      const strategy = await loader.loadFile(
        join(STRATEGIES_DIR, 'hull-ma-trend.pine')
      );
      expect(strategy.metadata.id).toBe('hull-ma-trend');

      const klines = makeSinusoidalKlines(300);
      const results = await runner.detectSignals(strategy, klines);

      const signals = results.filter((r) => r.setup !== null);
      expect(signals.length).toBeGreaterThan(0);

      for (const r of signals) {
        expect(r.setup!.type).toBe('hull-ma-trend');
        expect(r.setup!.riskRewardRatio).toBeGreaterThan(0);
      }
    });

    it('nr7-breakout.pine should detect NR7 pattern', async () => {
      const strategy = await loader.loadFile(
        join(STRATEGIES_DIR, 'nr7-breakout.pine')
      );
      expect(strategy.metadata.id).toBe('nr7-breakout');

      const klines: Kline[] = [];
      for (let i = 0; i < 100; i++) {
        const base = 50000 + i * 100;
        const range = i === 50 ? 10 : 400;
        klines.push(makeKline(i, base, range, 1500));
      }

      const results = await runner.detectSignals(strategy, klines, {
        minConfidence: 0,
        minRiskReward: 0,
      });

      const signals = results.filter((r) => r.setup !== null);
      expect(signals.length).toBeGreaterThanOrEqual(1);

      const nr7Signal = signals.find((r) => r.triggerKlineIndex === 50);
      expect(nr7Signal).toBeDefined();
      expect(nr7Signal!.setup!.direction).toBe('LONG');
    });
  });
});
