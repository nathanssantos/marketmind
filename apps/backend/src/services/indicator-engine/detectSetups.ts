import type {
  Kline,
  StrategyDefinition,
  TimeInterval,
  TradingSetup,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';
import { StrategyInterpreter } from '../setup-detection/dynamic/StrategyInterpreter';
import type { SetupRejection } from '../setup-detection/BaseSetupDetector';
import { IndicatorEngine } from './IndicatorEngine';

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
  rejection?: SetupRejection;
  triggerKlineIndex?: number;
  triggerCandleData?: TriggerCandleSnapshot[];
  triggerIndicatorValues?: TriggerIndicatorValues;
}

export const detectSetups = (input: {
  klines: Kline[];
  strategies: StrategyDefinition[];
  currentIndex?: number;
  config: DetectSetupsConfig;
  indicatorEngine?: IndicatorEngine;
}): DetectSetupsResult[] => {
  const { klines, strategies, config } = input;
  const currentIndex = input.currentIndex ?? klines.length - 1;
  const results: DetectSetupsResult[] = [];
  const sharedEngine = input.indicatorEngine ?? new IndicatorEngine();

  for (const strategy of strategies) {
    const interpreter = new StrategyInterpreter({
      enabled: true,
      minConfidence: config.minConfidence,
      minRiskReward: config.minRiskReward,
      strategy,
      silent: config.silent ?? true,
      interval: config.interval,
      directionMode: config.directionMode,
      maxFibonacciEntryProgressPercentLong: config.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: config.maxFibonacciEntryProgressPercentShort,
      fibonacciSwingRange: config.fibonacciSwingRange,
      initialStopMode: config.initialStopMode,
      indicatorEngine: sharedEngine,
    });

    const result = interpreter.detect(klines, currentIndex);

    results.push({
      setup: result.setup,
      confidence: result.confidence,
      strategyId: strategy.id,
      rejection: result.rejection,
      triggerKlineIndex: result.triggerKlineIndex,
      triggerCandleData: result.triggerCandleData,
      triggerIndicatorValues: result.triggerIndicatorValues,
    });
  }

  return results;
};
