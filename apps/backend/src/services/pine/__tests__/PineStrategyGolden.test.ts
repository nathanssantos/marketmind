import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Kline, PositionSide } from '@marketmind/types';
import { PineStrategyLoader } from '../PineStrategyLoader';
import { PineStrategyRunner } from '../PineStrategyRunner';

const STRATEGIES_DIR = join(__dirname, '../../../../strategies/builtin');
const FIXTURE_KLINE_COUNT = 300;
const STRATEGY_TIMEOUT_MS = 30_000;

const makeKline = (
  index: number,
  base: number,
  range = 400,
  vol = 1500,
): Kline => ({
  openTime: 1_700_000_000_000 + index * 3_600_000,
  open: String(base),
  high: String(base + range / 2),
  low: String(base - range / 2),
  close: String(base + 50),
  volume: String(vol),
  closeTime: 1_700_000_000_000 + index * 3_600_000 + 3_599_999,
  quoteVolume: '0',
  trades: 100,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const buildFixtureKlines = (): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < FIXTURE_KLINE_COUNT; i += 1) {
    const trend = i * 10;
    const wave = Math.sin(i * 0.05) * 5000;
    const bump = Math.cos(i * 0.13) * 800;
    const base = 50_000 + trend + wave + bump;
    const rangePulse = 300 + Math.abs(Math.sin(i * 0.07)) * 500;
    const volPulse = 1200 + Math.abs(Math.sin(i * 0.11)) * 800;
    klines.push(makeKline(i, base, rangePulse, volPulse));
  }
  return klines;
};

const round = (n: number, decimals = 4): number => {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

interface SerializedSetup {
  triggerKlineIndex: number | undefined;
  direction: PositionSide;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  confidence: number;
  riskRewardRatio: number;
  klineIndex: number;
}

interface SerializedSnapshot {
  strategyId: string;
  signalCount: number;
  firstTriggerIndex: number | null;
  lastTriggerIndex: number | null;
  longCount: number;
  shortCount: number;
  setups: SerializedSetup[];
}

const serializeDetections = (
  strategyId: string,
  detections: Array<{
    setup: {
      direction: PositionSide;
      entryPrice: number;
      stopLoss?: number;
      takeProfit?: number;
      confidence: number;
      riskRewardRatio: number;
      klineIndex: number;
    } | null;
    triggerKlineIndex?: number;
  }>,
): SerializedSnapshot => {
  const withSetup = detections.filter(
    (d): d is typeof d & { setup: NonNullable<typeof d.setup> } =>
      d.setup !== null,
  );

  const setups: SerializedSetup[] = withSetup.map((d) => ({
    triggerKlineIndex: d.triggerKlineIndex,
    direction: d.setup.direction,
    entryPrice: round(d.setup.entryPrice),
    stopLoss: d.setup.stopLoss === undefined ? null : round(d.setup.stopLoss),
    takeProfit:
      d.setup.takeProfit === undefined ? null : round(d.setup.takeProfit),
    confidence: round(d.setup.confidence, 2),
    riskRewardRatio: round(d.setup.riskRewardRatio, 3),
    klineIndex: d.setup.klineIndex,
  }));

  const triggerIndices = withSetup
    .map((d) => d.triggerKlineIndex)
    .filter((i): i is number => typeof i === 'number');

  return {
    strategyId,
    signalCount: setups.length,
    firstTriggerIndex: triggerIndices.length ? Math.min(...triggerIndices) : null,
    lastTriggerIndex: triggerIndices.length ? Math.max(...triggerIndices) : null,
    longCount: setups.filter((s) => s.direction === 'LONG').length,
    shortCount: setups.filter((s) => s.direction === 'SHORT').length,
    setups,
  };
};

const strategyFiles = readdirSync(STRATEGIES_DIR)
  .filter((f) => f.endsWith('.pine'))
  .sort();

describe('Pine strategy golden snapshots', () => {
  const loader = new PineStrategyLoader([STRATEGIES_DIR]);
  const runner = new PineStrategyRunner();
  const klines = buildFixtureKlines();

  it('discovers at least 100 builtin strategies', () => {
    expect(strategyFiles.length).toBeGreaterThanOrEqual(100);
  });

  describe.each(strategyFiles)('%s', (filename) => {
    it(
      'produces a stable detection snapshot',
      async () => {
        const strategy = await loader.loadFile(
          join(STRATEGIES_DIR, filename),
        );
        const detections = await runner.detectSignals(strategy, klines);
        const snapshot = serializeDetections(strategy.metadata.id, detections);
        expect(snapshot).toMatchSnapshot();
      },
      STRATEGY_TIMEOUT_MS,
    );
  });
});
