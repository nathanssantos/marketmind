import { eq } from 'drizzle-orm';
import type { MultiWatcherBacktestConfig, WatcherConfig } from '@marketmind/types';
import { BACKTEST_DEFAULTS } from '../../constants';
import { db } from '../../db';
import { autoTradingConfig, activeWatchers, tradingProfiles } from '../../db/schema';

interface DateRangeOptions {
  startDate: string;
  endDate: string;
  initialCapital?: number;
}

interface ConfigOverrides {
  tpCalculationMode?: 'default' | 'fibonacci';
  fibonacciTargetLevel?: 'auto' | '1.272' | '1.618' | '2';
  useTrailingStop?: boolean;
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  useFundingFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
  useMomentumTimingFilter?: boolean;
  useTrendFilter?: boolean;
  useStochasticFilter?: boolean;
  useAdxFilter?: boolean;
}

export const loadMultiWatcherConfigFromAutoTrading = async (
  walletId: string,
  options: DateRangeOptions,
  overrides?: ConfigOverrides
): Promise<MultiWatcherBacktestConfig> => {
  const [config] = await db
    .select()
    .from(autoTradingConfig)
    .where(eq(autoTradingConfig.walletId, walletId))
    .limit(1);

  if (!config) {
    throw new Error(`No auto-trading config found for wallet ${walletId}`);
  }

  const watcherRows = await db
    .select()
    .from(activeWatchers)
    .where(eq(activeWatchers.walletId, walletId));

  if (watcherRows.length === 0) {
    throw new Error(`No active watchers found for wallet ${walletId}`);
  }

  const watchers: WatcherConfig[] = await Promise.all(
    watcherRows.map(async (w) => {
      let setupTypes: string[] | undefined;

      if (w.profileId) {
        const [profile] = await db
          .select()
          .from(tradingProfiles)
          .where(eq(tradingProfiles.id, w.profileId))
          .limit(1);

        if (profile) {
          setupTypes = JSON.parse(profile.enabledSetupTypes);
        }
      }

      return {
        symbol: w.symbol,
        interval: w.interval,
        marketType: w.marketType,
        setupTypes: setupTypes ?? JSON.parse(config.enabledSetupTypes),
        profileId: w.profileId ?? undefined,
      };
    })
  );

  return {
    watchers,
    startDate: options.startDate,
    endDate: options.endDate,
    initialCapital: options.initialCapital ?? 10000,

    exposureMultiplier: parseFloat(config.exposureMultiplier),

    useStochasticFilter: overrides?.useStochasticFilter ?? config.useStochasticFilter,
    useAdxFilter: overrides?.useAdxFilter ?? config.useAdxFilter,
    onlyWithTrend: overrides?.useTrendFilter ?? config.useTrendFilter,

    useMtfFilter: overrides?.useMtfFilter ?? config.useMtfFilter,
    useBtcCorrelationFilter: overrides?.useBtcCorrelationFilter ?? config.useBtcCorrelationFilter,
    useMarketRegimeFilter: overrides?.useMarketRegimeFilter ?? config.useMarketRegimeFilter,
    useVolumeFilter: overrides?.useVolumeFilter ?? config.useVolumeFilter,
    useFundingFilter: overrides?.useFundingFilter ?? config.useFundingFilter,
    useConfluenceScoring: overrides?.useConfluenceScoring ?? config.useConfluenceScoring,
    confluenceMinScore: overrides?.confluenceMinScore ?? config.confluenceMinScore,
    useMomentumTimingFilter: overrides?.useMomentumTimingFilter ?? config.useMomentumTimingFilter,
    useTrendFilter: overrides?.useTrendFilter ?? config.useTrendFilter,
    trendFilterPeriod: 21,

    useTrailingStop: overrides?.useTrailingStop ?? false,

    setupTypes: JSON.parse(config.enabledSetupTypes),
    useSharedExposure: true,
    marketType: watchers[0]?.marketType ?? 'SPOT',
    leverage: config.leverage ?? 1,
    tpCalculationMode: overrides?.tpCalculationMode ?? config.tpCalculationMode,
    fibonacciTargetLevel: overrides?.fibonacciTargetLevel ?? config.fibonacciTargetLevel,
  };
};

export const buildMultiWatcherConfigFromWatchers = (
  watcherConfigs: WatcherConfig[],
  options: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    exposureMultiplier?: number;
    useStochasticFilter?: boolean;
    useAdxFilter?: boolean;
    onlyWithTrend?: boolean;
    minRiskRewardRatio?: number;
    cooldownMinutes?: number;
    marketType?: 'SPOT' | 'FUTURES';
    leverage?: number;
    tpCalculationMode?: 'default' | 'fibonacci';
    useMtfFilter?: boolean;
    useBtcCorrelationFilter?: boolean;
    useMarketRegimeFilter?: boolean;
    useVolumeFilter?: boolean;
    useFundingFilter?: boolean;
    useConfluenceScoring?: boolean;
    confluenceMinScore?: number;
    useMomentumTimingFilter?: boolean;
    useTrendFilter?: boolean;
    trendFilterPeriod?: number;
    useTrailingStop?: boolean;
    fibonacciTargetLevel?: 'auto' | '1.272' | '1.618' | '2';
  }
): MultiWatcherBacktestConfig => {
  const allSetupTypes = new Set<string>();
  for (const watcher of watcherConfigs) {
    if (watcher.setupTypes) {
      for (const setup of watcher.setupTypes) {
        allSetupTypes.add(setup);
      }
    }
  }

  return {
    watchers: watcherConfigs,
    startDate: options.startDate,
    endDate: options.endDate,
    initialCapital: options.initialCapital,

    exposureMultiplier: options.exposureMultiplier ?? BACKTEST_DEFAULTS.EXPOSURE_MULTIPLIER,

    useStochasticFilter: options.useStochasticFilter ?? false,
    useAdxFilter: options.useAdxFilter ?? false,
    onlyWithTrend: options.onlyWithTrend ?? false,
    minRiskRewardRatio: options.minRiskRewardRatio ?? BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO,
    useCooldown: true,
    cooldownMinutes: options.cooldownMinutes ?? 15,

    useMtfFilter: options.useMtfFilter ?? true,
    useBtcCorrelationFilter: options.useBtcCorrelationFilter ?? true,
    useMarketRegimeFilter: options.useMarketRegimeFilter ?? true,
    useVolumeFilter: options.useVolumeFilter ?? false,
    useFundingFilter: options.useFundingFilter ?? true,
    useConfluenceScoring: options.useConfluenceScoring ?? true,
    confluenceMinScore: options.confluenceMinScore ?? 60,
    useMomentumTimingFilter: options.useMomentumTimingFilter ?? true,
    useTrendFilter: options.useTrendFilter ?? false,
    trendFilterPeriod: options.trendFilterPeriod ?? 21,
    useTrailingStop: options.useTrailingStop ?? false,

    setupTypes: Array.from(allSetupTypes),
    useSharedExposure: true,
    marketType: options.marketType ?? 'SPOT',
    leverage: options.leverage ?? 1,
    tpCalculationMode: options.tpCalculationMode ?? 'default',
    fibonacciTargetLevel: options.fibonacciTargetLevel ?? 'auto',
  };
};
