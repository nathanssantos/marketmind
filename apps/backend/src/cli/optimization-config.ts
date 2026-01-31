import type { Interval } from '@marketmind/types';

export const OPTIMIZATION_DEFAULTS = {
  symbol: 'BTCUSDT',
  marketType: 'FUTURES' as const,
  initialCapital: 1000,
  capitalPerTrade: 1.0,
  leverage: 5,
  mainInterval: '2h' as Interval,
  granularInterval: '5m' as Interval,
  startDate: '2023-01-01',
  endDate: '2026-01-31',
} as const;

export const TRAILING_STOP_PARAM_RANGES = {
  quick: {
    activationPercent: [80, 100, 120],
    distancePercent: [25, 30, 35],
    atrMultiplier: [2.0],
    breakevenProfitThreshold: [1.0],
  },
  medium: {
    activationPercent: { min: 70, max: 120, step: 10 },
    distancePercent: { min: 20, max: 50, step: 10 },
    atrMultiplier: { min: 1.5, max: 3.0, step: 0.5 },
    breakevenProfitThreshold: { min: 0.5, max: 1.5, step: 0.5 },
  },
  full: {
    activationPercent: { min: 50, max: 150, step: 10 },
    distancePercent: { min: 10, max: 60, step: 10 },
    atrMultiplier: { min: 1.0, max: 3.5, step: 0.5 },
    breakevenProfitThreshold: { min: 0.5, max: 2.0, step: 0.5 },
  },
} as const;

export const FIBONACCI_LEVELS = ['auto', '1', '1.272', '1.382', '1.5', '1.618', '2', '2.272', '2.618'] as const;

export const TREND_EMA_PERIODS = [9, 21, 50, 70, 100, 150, 200] as const;

export const FILTER_KEYS = [
  'useMtfFilter',
  'useMarketRegimeFilter',
  'useTrendFilter',
  'useDirectionFilter',
  'useMomentumTimingFilter',
  'useStochasticFilter',
  'useAdxFilter',
  'useVolumeFilter',
  'useFundingFilter',
  'useBtcCorrelationFilter',
  'useChoppinessFilter',
  'useBollingerSqueezeFilter',
  'useVwapFilter',
  'useSupertrendFilter',
] as const;

export const SCORE_WEIGHTS = {
  pnl: 0.4,
  sharpe: 0.4,
  maxDrawdown: 0.2,
} as const;

export const BACKTEST_TIMEFRAMES: Interval[] = ['30m', '1h', '2h', '4h', '6h', '8h'];

export type OptimizationMode = 'quick' | 'medium' | 'full';

export interface DirectionalTrailingConfig {
  activationPercent: number;
  distancePercent: number;
  atrMultiplier: number;
  breakevenProfitThreshold: number;
}

export const generateRange = (min: number, max: number, step: number): number[] => {
  const values: number[] = [];
  for (let v = min; v <= max + 0.0001; v += step) {
    values.push(Math.round(v * 100) / 100);
  }
  return values;
};

export const generateDirectionalConfigs = (
  mode: OptimizationMode
): DirectionalTrailingConfig[] => {
  const ranges = TRAILING_STOP_PARAM_RANGES[mode];

  if (mode === 'quick') {
    const quickRanges = ranges as typeof TRAILING_STOP_PARAM_RANGES.quick;
    const configs: DirectionalTrailingConfig[] = [];
    for (const activation of quickRanges.activationPercent) {
      for (const distance of quickRanges.distancePercent) {
        for (const atrMult of quickRanges.atrMultiplier) {
          for (const breakeven of quickRanges.breakevenProfitThreshold) {
            configs.push({
              activationPercent: activation,
              distancePercent: distance,
              atrMultiplier: atrMult,
              breakevenProfitThreshold: breakeven,
            });
          }
        }
      }
    }
    return configs;
  }

  const rangeConfig = ranges as typeof TRAILING_STOP_PARAM_RANGES.medium;
  const configs: DirectionalTrailingConfig[] = [];
  const activations = generateRange(
    rangeConfig.activationPercent.min,
    rangeConfig.activationPercent.max,
    rangeConfig.activationPercent.step
  );
  const distances = generateRange(
    rangeConfig.distancePercent.min,
    rangeConfig.distancePercent.max,
    rangeConfig.distancePercent.step
  );
  const atrMults = generateRange(
    rangeConfig.atrMultiplier.min,
    rangeConfig.atrMultiplier.max,
    rangeConfig.atrMultiplier.step
  );
  const breakevenThresholds = generateRange(
    rangeConfig.breakevenProfitThreshold.min,
    rangeConfig.breakevenProfitThreshold.max,
    rangeConfig.breakevenProfitThreshold.step
  );

  for (const activation of activations) {
    for (const distance of distances) {
      for (const atrMult of atrMults) {
        for (const breakeven of breakevenThresholds) {
          configs.push({
            activationPercent: activation,
            distancePercent: distance,
            atrMultiplier: atrMult,
            breakevenProfitThreshold: breakeven,
          });
        }
      }
    }
  }

  return configs;
};

export const calculateCompositeScore = (
  pnl: number,
  sharpeRatio: number,
  maxDrawdown: number
): number => {
  return (
    pnl * SCORE_WEIGHTS.pnl +
    sharpeRatio * 1000 * SCORE_WEIGHTS.sharpe -
    maxDrawdown * 10000 * SCORE_WEIGHTS.maxDrawdown
  );
};

export const formatCurrency = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPercent = (value: number): string => value.toFixed(2) + '%';

export const parseCliArgs = (defaults = OPTIMIZATION_DEFAULTS) => {
  const symbolArg = process.argv.find(arg => arg.startsWith('--symbol='));
  const intervalArg = process.argv.find(arg => arg.startsWith('--interval='));
  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));
  const modeArg = process.argv.find(arg => arg.startsWith('--mode='));

  return {
    symbol: symbolArg ? symbolArg.split('=')[1]! : defaults.symbol,
    interval: intervalArg ? intervalArg.split('=')[1]! as Interval : defaults.mainInterval,
    startDate: startDateArg ? startDateArg.split('=')[1]! : defaults.startDate,
    endDate: endDateArg ? endDateArg.split('=')[1]! : defaults.endDate,
    mode: (modeArg ? modeArg.split('=')[1]! : 'medium') as OptimizationMode,
  };
};
