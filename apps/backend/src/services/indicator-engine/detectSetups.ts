import type {
  Kline,
  TimeInterval,
  TradingSetup,
} from '@marketmind/types';
import { PineStrategyRunner } from '../pine/PineStrategyRunner';
import type { PineStrategy, PineRunOptions } from '../pine/types';

export interface DetectSetupsConfig {
  minConfidence: number;
  minRiskReward: number;
  directionMode?: 'long_only' | 'short_only';
  interval?: TimeInterval;
  maxFibonacciEntryProgressPercentLong?: number;
  maxFibonacciEntryProgressPercentShort?: number;
  fibonacciSwingRange?: 'extended' | 'nearest';
  initialStopMode?: 'fibo_target' | 'nearest_swing';
  silent?: boolean;
}

export interface DetectSetupsResult {
  setup: TradingSetup | null;
  confidence: number;
  strategyId: string;
  rejection?: { reason: string; details?: Record<string, string | number | boolean | null> };
  triggerKlineIndex?: number;
}

export const detectSetups = async (input: {
  klines: Kline[];
  strategies: PineStrategy[];
  currentIndex?: number;
  config: DetectSetupsConfig;
  /**
   * Pre-loaded HTF klines for multi-TF strategies (those declaring
   * `@requires-tf`). Keyed by timeframe label ('4h', '1d'). Live
   * callers (auto-trader watcher loop) must fetch + maintain these
   * alongside the primary klines; backtest callers route via
   * BacktestEngine.initializeStrategies which does the fetch.
   *
   * TODO(phase-0b-followup): the live watcher loop in signal-helpers.ts
   * doesn't yet load HTF klines on its own — multi-TF strategies need
   * the caller to pre-load and pass them here. Until then,
   * `@requires-tf` strategies will throw at runtime when the auto-trader
   * tries to run them. Backtest path is fully wired.
   */
  secondaryKlines?: Record<string, Kline[]>;
}): Promise<DetectSetupsResult[]> => {
  const { klines, strategies, config, secondaryKlines } = input;
  const currentIndex = input.currentIndex ?? klines.length - 1;
  const results: DetectSetupsResult[] = [];
  const runner = new PineStrategyRunner();

  const pineOptions: PineRunOptions = {
    minConfidence: config.minConfidence,
    minRiskReward: config.minRiskReward,
    ...(config.interval ? { primaryTimeframe: config.interval } : {}),
    ...(secondaryKlines && Object.keys(secondaryKlines).length > 0
      ? { secondaryKlines }
      : {}),
  };

  for (const strategy of strategies) {
    const detectionResults = await runner.detectSignals(strategy, klines.slice(0, currentIndex + 1), pineOptions);

    for (const result of detectionResults) {
      const idx = result.triggerKlineIndex ?? -1;
      if (idx !== currentIndex) continue;

      if (config.directionMode === 'long_only' && result.setup?.direction === 'SHORT') continue;
      if (config.directionMode === 'short_only' && result.setup?.direction === 'LONG') continue;

      results.push({
        setup: result.setup,
        confidence: result.confidence,
        strategyId: strategy.metadata.id,
        triggerKlineIndex: result.triggerKlineIndex,
      });
    }

    if (!detectionResults.some((r) => r.triggerKlineIndex === currentIndex)) {
      results.push({
        setup: null,
        confidence: 0,
        strategyId: strategy.metadata.id,
      });
    }
  }

  return results;
};
