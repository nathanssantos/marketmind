import type { TimeframeThreshold } from '@marketmind/types';

export const ML_THRESHOLDS_BY_TIMEFRAME: Record<string, TimeframeThreshold> = {
  '1m': { minProbability: 0.10, minConfidence: 70 },
  '5m': { minProbability: 0.08, minConfidence: 65 },
  '15m': { minProbability: 0.07, minConfidence: 60 },
  '30m': { minProbability: 0.06, minConfidence: 55 },
  '1h': { minProbability: 0.05, minConfidence: 50 },
  '4h': { minProbability: 0.05, minConfidence: 50 },
  '1d': { minProbability: 0.04, minConfidence: 45 },
  '1w': { minProbability: 0.03, minConfidence: 40 },
};

export interface OptimizedStrategyConfig {
  strategy: string;
  symbol: string;
  interval: string;
  mlThreshold: number;
  tier: 1 | 2 | 3;
  expectedMetrics: {
    sharpe: number;
    winRate: number;
    profitFactor: number;
    pnlPercent: number;
    maxDrawdown: number;
    trades: number;
  };
}

export const OPTIMIZED_STRATEGY_CONFIGS: OptimizedStrategyConfig[] = [
  {
    strategy: 'keltner-breakout-optimized',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 10.22, winRate: 91.7, profitFactor: 9.63, pnlPercent: 19.52, maxDrawdown: 1.90, trades: 12 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'SOLUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 9.25, winRate: 76.9, profitFactor: 5.45, pnlPercent: 15.42, maxDrawdown: 1.77, trades: 13 },
  },
  {
    strategy: 'larry-williams-9-3',
    symbol: 'AVAXUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 7.46, winRate: 84.2, profitFactor: 4.79, pnlPercent: 73.90, maxDrawdown: 7.96, trades: 19 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'AVAXUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 6.77, winRate: 70.0, profitFactor: 3.79, pnlPercent: 9.37, maxDrawdown: 2.00, trades: 10 },
  },
  {
    strategy: 'parabolic-sar-crypto',
    symbol: 'AVAXUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 5.67, winRate: 70.3, profitFactor: 2.50, pnlPercent: 165.23, maxDrawdown: 5.86, trades: 91 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'BNBUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 1,
    expectedMetrics: { sharpe: 5.02, winRate: 74.1, profitFactor: 3.22, pnlPercent: 14.96, maxDrawdown: 2.86, trades: 27 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'XRPUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 4.72, winRate: 60.9, profitFactor: 2.02, pnlPercent: 10.22, maxDrawdown: 3.05, trades: 23 },
  },
  {
    strategy: 'parabolic-sar-crypto',
    symbol: 'SOLUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 4.11, winRate: 69.5, profitFactor: 1.90, pnlPercent: 113.75, maxDrawdown: 19.88, trades: 95 },
  },
  {
    strategy: 'larry-williams-9-3',
    symbol: 'XRPUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 3.50, winRate: 63.2, profitFactor: 1.66, pnlPercent: 23.54, maxDrawdown: 11.18, trades: 19 },
  },
  {
    strategy: 'parabolic-sar-crypto',
    symbol: 'XRPUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 3.07, winRate: 55.7, profitFactor: 1.75, pnlPercent: 72.50, maxDrawdown: 19.79, trades: 79 },
  },
  {
    strategy: 'tema-momentum',
    symbol: 'AVAXUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 2.88, winRate: 41.9, profitFactor: 1.61, pnlPercent: 163.62, maxDrawdown: 40.89, trades: 86 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'BNBUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 2.69, winRate: 64.6, profitFactor: 1.46, pnlPercent: 31.75, maxDrawdown: 7.20, trades: 158 },
  },
  {
    strategy: 'bollinger-breakout-crypto',
    symbol: 'XRPUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 2.21, winRate: 70.3, profitFactor: 1.32, pnlPercent: 33.01, maxDrawdown: 24.79, trades: 37 },
  },
  {
    strategy: 'larry-williams-9-3',
    symbol: 'BNBUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 2.12, winRate: 72.2, profitFactor: 1.39, pnlPercent: 7.49, maxDrawdown: 8.28, trades: 18 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'ETHUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 2,
    expectedMetrics: { sharpe: 2.13, winRate: 69.0, profitFactor: 1.41, pnlPercent: 42.69, maxDrawdown: 13.87, trades: 116 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'XRPUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.92, winRate: 61.9, profitFactor: 1.33, pnlPercent: 39.51, maxDrawdown: 20.76, trades: 105 },
  },
  {
    strategy: 'keltner-breakout-optimized',
    symbol: 'AVAXUSDT',
    interval: '4h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.90, winRate: 67.3, profitFactor: 1.39, pnlPercent: 16.08, maxDrawdown: 9.14, trades: 49 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'BTCUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.63, winRate: 68.1, profitFactor: 1.26, pnlPercent: 11.01, maxDrawdown: 9.49, trades: 119 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'ETHUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.55, winRate: 59.2, profitFactor: 1.25, pnlPercent: 14.34, maxDrawdown: 11.53, trades: 120 },
  },
  {
    strategy: 'bollinger-breakout-crypto',
    symbol: 'BNBUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.46, winRate: 58.8, profitFactor: 1.16, pnlPercent: 13.47, maxDrawdown: 20.73, trades: 34 },
  },
  {
    strategy: 'supertrend-follow',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.27, winRate: 60.0, profitFactor: 1.23, pnlPercent: 1.88, maxDrawdown: 3.53, trades: 20 },
  },
  {
    strategy: 'larry-williams-9-1',
    symbol: 'AVAXUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.24, winRate: 57.1, profitFactor: 1.13, pnlPercent: 10.01, maxDrawdown: 17.64, trades: 28 },
  },
  {
    strategy: 'keltner-breakout-optimized',
    symbol: 'SOLUSDT',
    interval: '4h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.17, winRate: 63.4, profitFactor: 1.19, pnlPercent: 5.48, maxDrawdown: 11.39, trades: 41 },
  },
  {
    strategy: 'tema-momentum',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.17, winRate: 38.4, profitFactor: 1.19, pnlPercent: 14.95, maxDrawdown: 14.74, trades: 73 },
  },
  {
    strategy: 'larry-williams-9-3',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.15, winRate: 61.1, profitFactor: 1.17, pnlPercent: 3.14, maxDrawdown: 10.28, trades: 18 },
  },
  {
    strategy: 'parabolic-sar-crypto',
    symbol: 'ETHUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.14, winRate: 57.0, profitFactor: 1.17, pnlPercent: 18.84, maxDrawdown: 22.00, trades: 100 },
  },
  {
    strategy: 'larry-williams-9-3',
    symbol: 'ETHUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.14, winRate: 65.2, profitFactor: 1.17, pnlPercent: 4.95, maxDrawdown: 13.72, trades: 23 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'SOLUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.04, winRate: 64.1, profitFactor: 1.17, pnlPercent: 76.86, maxDrawdown: 15.39, trades: 1280 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'BNBUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.11, winRate: 64.3, profitFactor: 1.22, pnlPercent: 47.95, maxDrawdown: 8.62, trades: 1255 },
  },
  {
    strategy: 'tema-momentum',
    symbol: 'ETHUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.01, winRate: 38.8, profitFactor: 1.13, pnlPercent: 13.58, maxDrawdown: 19.58, trades: 67 },
  },
  {
    strategy: 'bollinger-breakout-crypto',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 1.00, winRate: 63.2, profitFactor: 1.10, pnlPercent: 7.04, maxDrawdown: 16.28, trades: 38 },
  },
  {
    strategy: 'larry-williams-9-1',
    symbol: 'BNBUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 0.95, winRate: 58.3, profitFactor: 1.12, pnlPercent: 4.26, maxDrawdown: 16.65, trades: 24 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'BTCUSDT',
    interval: '1d',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 0.90, winRate: 61.2, profitFactor: 1.16, pnlPercent: 10.77, maxDrawdown: 12.53, trades: 116 },
  },
  {
    strategy: 'williams-momentum',
    symbol: 'AVAXUSDT',
    interval: '1h',
    mlThreshold: 5,
    tier: 3,
    expectedMetrics: { sharpe: 0.88, winRate: 64.0, profitFactor: 1.15, pnlPercent: 60.39, maxDrawdown: 16.95, trades: 1290 },
  },
];

const DEFAULT_THRESHOLD: TimeframeThreshold = {
  minProbability: 0.05,
  minConfidence: 50,
};

export const getThresholdForTimeframe = (interval: string): TimeframeThreshold => {
  return ML_THRESHOLDS_BY_TIMEFRAME[interval] ?? DEFAULT_THRESHOLD;
};

export const updateThresholdForTimeframe = (
  interval: string,
  threshold: TimeframeThreshold
): void => {
  ML_THRESHOLDS_BY_TIMEFRAME[interval] = threshold;
};

export const setThresholdsFromOptimization = (
  thresholds: Record<string, TimeframeThreshold>
): void => {
  for (const [interval, threshold] of Object.entries(thresholds)) {
    ML_THRESHOLDS_BY_TIMEFRAME[interval] = threshold;
  }
};

export const getAllThresholds = (): Record<string, TimeframeThreshold> => {
  return { ...ML_THRESHOLDS_BY_TIMEFRAME };
};

export const getOptimizedConfigsForStrategy = (strategy: string): OptimizedStrategyConfig[] => {
  return OPTIMIZED_STRATEGY_CONFIGS.filter((c) => c.strategy === strategy);
};

export const getOptimizedConfigsForSymbol = (symbol: string): OptimizedStrategyConfig[] => {
  return OPTIMIZED_STRATEGY_CONFIGS.filter((c) => c.symbol === symbol);
};

export const getOptimizedConfigsForInterval = (interval: string): OptimizedStrategyConfig[] => {
  return OPTIMIZED_STRATEGY_CONFIGS.filter((c) => c.interval === interval);
};

export const getOptimizedConfigsByTier = (tier: 1 | 2 | 3): OptimizedStrategyConfig[] => {
  return OPTIMIZED_STRATEGY_CONFIGS.filter((c) => c.tier === tier);
};

export const getOptimizedConfig = (
  strategy: string,
  symbol: string,
  interval: string
): OptimizedStrategyConfig | undefined => {
  return OPTIMIZED_STRATEGY_CONFIGS.find(
    (c) => c.strategy === strategy && c.symbol === symbol && c.interval === interval
  );
};

export const isOptimizedCombination = (
  strategy: string,
  symbol: string,
  interval: string
): boolean => {
  return OPTIMIZED_STRATEGY_CONFIGS.some(
    (c) => c.strategy === strategy && c.symbol === symbol && c.interval === interval
  );
};
