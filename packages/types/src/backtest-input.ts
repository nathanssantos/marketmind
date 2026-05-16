import { z } from 'zod';

const FIBONACCI_TARGET_LEVEL_VALUES = [
  'auto',
  '1',
  '1.272',
  '1.382',
  '1.618',
  '2',
  '2.618',
  '3',
  '3.618',
  '4.236',
] as const;

export const fibonacciTargetLevelSchema = z.enum(FIBONACCI_TARGET_LEVEL_VALUES);

const directionalVolumeConfigSchema = z.object({
  breakoutMultiplier: z.number().optional(),
  pullbackMultiplier: z.number().optional(),
  useObvCheck: z.boolean().optional(),
  obvLookback: z.number().int().min(1).optional(),
});

const volumeFilterConfigSchema = z.object({
  breakoutMultiplier: z.number().optional(),
  pullbackMultiplier: z.number().optional(),
  useObvCheck: z.boolean().optional(),
  obvLookback: z.number().int().min(1).optional(),
  longConfig: directionalVolumeConfigSchema.optional(),
  shortConfig: directionalVolumeConfigSchema.optional(),
});

const partialExitLevelSchema = z.object({
  percentage: z.number().min(0).max(100),
  rMultiple: z.number().min(0),
});

const fearGreedConfigSchema = z.object({
  enabled: z.boolean().optional(),
  thresholdLow: z.number().min(0).max(100).optional(),
  thresholdHigh: z.number().min(0).max(100).optional(),
  action: z.enum(['block', 'reduce_size', 'warn_only']).optional(),
  sizeReduction: z.number().min(0).max(100).optional(),
});

const fundingRateContextConfigSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().min(0).optional(),
  action: z.enum(['block', 'penalize', 'warn_only']).optional(),
  penalty: z.number().min(0).optional(),
});

const marketContextConfigSchema = z.object({
  fearGreed: fearGreedConfigSchema.optional(),
  fundingRate: fundingRateContextConfigSchema.optional(),
});

export const simpleBacktestInputSchema = z.object({
  symbol: z.string().min(1),
  interval: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  initialCapital: z.number().positive(),

  exchange: z.enum(['BINANCE', 'INTERACTIVE_BROKERS']).optional(),
  assetClass: z.enum(['CRYPTO', 'STOCKS']).optional(),

  setupTypes: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  minProfitPercent: z.number().min(0).optional(),

  minRiskRewardRatio: z.number().min(0).optional(),
  minRiskRewardRatioLong: z.number().min(0).optional(),
  minRiskRewardRatioShort: z.number().min(0).optional(),
  useAlgorithmicLevels: z.boolean().optional(),
  stopLossPercent: z.number().positive().optional(),
  takeProfitPercent: z.number().positive().optional(),
  commission: z.number().min(0).max(1).optional(),
  slippagePercent: z.number().min(0).max(1).optional(),

  useStochasticFilter: z.boolean().optional(),
  useStochasticRecoveryFilter: z.boolean().optional(),
  useStochasticHtfFilter: z.boolean().optional(),
  useStochasticRecoveryHtfFilter: z.boolean().optional(),
  useMomentumTimingFilter: z.boolean().optional(),
  useAdxFilter: z.boolean().optional(),
  useTrendFilter: z.boolean().optional(),
  trendFilterPeriod: z.number().int().min(1).optional(),
  useChoppinessFilter: z.boolean().optional(),
  choppinessThresholdHigh: z.number().min(0).max(100).optional(),
  choppinessThresholdLow: z.number().min(0).max(100).optional(),
  choppinessPeriod: z.number().int().min(1).optional(),
  useSessionFilter: z.boolean().optional(),
  sessionStartUtc: z.number().int().min(0).max(23).optional(),
  sessionEndUtc: z.number().int().min(0).max(23).optional(),
  useBollingerSqueezeFilter: z.boolean().optional(),
  bollingerSqueezeThreshold: z.number().min(0).optional(),
  bollingerSqueezePeriod: z.number().int().min(1).optional(),
  bollingerSqueezeStdDev: z.number().min(0).optional(),
  useVwapFilter: z.boolean().optional(),
  useSuperTrendFilter: z.boolean().optional(),
  superTrendPeriod: z.number().int().min(1).optional(),
  superTrendMultiplier: z.number().min(0).optional(),
  useDirectionFilter: z.boolean().optional(),
  enableLongInBearMarket: z.boolean().optional(),
  enableShortInBullMarket: z.boolean().optional(),
  useMarketRegimeFilter: z.boolean().optional(),
  useVolumeFilter: z.boolean().optional(),
  volumeFilterConfig: volumeFilterConfigSchema.optional(),
  useBtcCorrelationFilter: z.boolean().optional(),
  useFundingFilter: z.boolean().optional(),
  useMtfFilter: z.boolean().optional(),
  useConfluenceScoring: z.boolean().optional(),
  confluenceMinScore: z.number().min(0).max(100).optional(),
  useFvgFilter: z.boolean().optional(),
  fvgFilterProximityPercent: z.number().min(0).optional(),

  positionSizePercent: z.number().min(0.1).max(100).optional(),

  marketType: z.enum(['SPOT', 'FUTURES']).optional(),
  useBnbDiscount: z.boolean().optional(),
  vipLevel: z.number().int().min(0).max(9).optional(),
  leverage: z.number().min(1).max(125).optional(),
  marginType: z.enum(['ISOLATED', 'CROSSED']).optional(),
  simulateFundingRates: z.boolean().optional(),
  simulateLiquidation: z.boolean().optional(),

  strategyParams: z.record(z.string(), z.number()).optional(),

  /**
   * Cap on simultaneously-open positions. When omitted, BacktestEngine
   * applies `FilterManager.maxConcurrentPositions = 10`. Set to 1 to
   * match `MultiWatcherBacktestEngine`'s single-watcher portfolio model
   * (one position at a time on the same watcher).
   */
  maxConcurrentPositions: z.number().int().min(1).max(100).optional(),

  usePartialExits: z.boolean().optional(),
  partialExitLevels: z.array(partialExitLevelSchema).optional(),
  lockProfitsAfterFirstExit: z.boolean().optional(),

  useMarketContextFilter: z.boolean().optional(),
  marketContextConfig: marketContextConfigSchema.optional(),

  useCooldown: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).optional(),

  onlyLong: z.boolean().optional(),
  directionMode: z.enum(['long_only', 'short_only']).optional(),

  tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
  fibonacciTpLevel: z.number().optional(),
  fibonacciTargetLevel: fibonacciTargetLevelSchema.optional(),
  fibonacciTargetLevelLong: fibonacciTargetLevelSchema.optional(),
  fibonacciTargetLevelShort: fibonacciTargetLevelSchema.optional(),
  maxFibonacciEntryProgressPercentLong: z.number().min(0).optional(),
  maxFibonacciEntryProgressPercentShort: z.number().min(0).optional(),
  fibonacciSwingRange: z.enum(['extended', 'nearest']).optional(),
  initialStopMode: z.enum(['fibo_target', 'nearest_swing']).optional(),

  silent: z.boolean().optional(),
});

export type SimpleBacktestInput = z.infer<typeof simpleBacktestInputSchema>;

const watcherInputSchema = z.object({
  symbol: z.string().min(1),
  interval: z.string().min(1),
  setupTypes: z.array(z.string()).optional(),
  marketType: z.enum(['SPOT', 'FUTURES']).optional(),
  profileId: z.string().optional(),
});

export const multiWatcherBacktestInputSchema = simpleBacktestInputSchema
  .omit({ symbol: true, interval: true })
  .extend({
    walletId: z.string().optional(),
    watchers: z.array(watcherInputSchema).optional(),
    useSharedExposure: z.boolean().optional(),
  });

export type MultiWatcherBacktestInput = z.infer<typeof multiWatcherBacktestInputSchema>;

export const DEFAULT_ENABLED_SETUP_IDS = [
  '7day-momentum-crypto',
  'breakout-retest',
  'bull-trap',
  'cumulative-rsi-r3',
  'divergence-rsi-macd',
  'golden-cross-sma',
  'hull-ma-trend',
  'liquidity-sweep',
  'macd-divergence',
  'momentum-breakout-2025',
  'nr7-breakout',
  'pin-inside-combo',
  'triple-ema-confluence',
] as const;

export type DefaultEnabledSetupId = (typeof DEFAULT_ENABLED_SETUP_IDS)[number];

export const getDefaultBacktestInput = (): SimpleBacktestInput => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  initialCapital: 10_000,
  marketType: 'FUTURES',
  positionSizePercent: 10,
  leverage: 1,
  commission: 0.0004,
  slippagePercent: 0.0005,
  minRiskRewardRatioLong: 1,
  minRiskRewardRatioShort: 1,
  useTrendFilter: true,
  trendFilterPeriod: 21,
  useAdxFilter: true,
  useChoppinessFilter: true,
  choppinessThresholdHigh: 61.8,
  choppinessThresholdLow: 38.2,
  choppinessPeriod: 14,
  useVwapFilter: true,
  useCooldown: true,
  cooldownMinutes: 15,
  tpCalculationMode: 'fibonacci',
  fibonacciTargetLevelLong: '1.272',
  fibonacciTargetLevelShort: '1.272',
  maxFibonacciEntryProgressPercentLong: 127.2,
  maxFibonacciEntryProgressPercentShort: 127.2,
  fibonacciSwingRange: 'nearest',
  initialStopMode: 'fibo_target',
});
