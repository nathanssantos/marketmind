import { eq } from 'drizzle-orm';
import type { MultiWatcherBacktestConfig, WatcherConfig } from '@marketmind/types';
import { FILTER_DEFAULTS } from '@marketmind/types';
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
  fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236';
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useDirectionFilter?: boolean;
  enableLongInBearMarket?: boolean;
  enableShortInBullMarket?: boolean;
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

    positionSizePercent: parseFloat(config.positionSizePercent),

    useStochasticFilter: overrides?.useStochasticFilter ?? config.useStochasticFilter,
    useAdxFilter: overrides?.useAdxFilter ?? config.useAdxFilter,

    useMtfFilter: overrides?.useMtfFilter ?? config.useMtfFilter,
    useBtcCorrelationFilter: overrides?.useBtcCorrelationFilter ?? config.useBtcCorrelationFilter,
    useMarketRegimeFilter: overrides?.useMarketRegimeFilter ?? config.useMarketRegimeFilter,
    useDirectionFilter: overrides?.useDirectionFilter ?? config.useDirectionFilter,
    enableLongInBearMarket: overrides?.enableLongInBearMarket ?? config.enableLongInBearMarket,
    enableShortInBullMarket: overrides?.enableShortInBullMarket ?? config.enableShortInBullMarket,
    useVolumeFilter: overrides?.useVolumeFilter ?? config.useVolumeFilter,
    useFundingFilter: overrides?.useFundingFilter ?? config.useFundingFilter,
    useConfluenceScoring: overrides?.useConfluenceScoring ?? config.useConfluenceScoring,
    confluenceMinScore: overrides?.confluenceMinScore ?? config.confluenceMinScore,
    useMomentumTimingFilter: overrides?.useMomentumTimingFilter ?? config.useMomentumTimingFilter,
    useTrendFilter: overrides?.useTrendFilter ?? config.useTrendFilter,
    trendFilterPeriod: FILTER_DEFAULTS.trendFilterPeriod,

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
    positionSizePercent?: number;
    useStochasticFilter?: boolean;
    useAdxFilter?: boolean;
    minRiskRewardRatio?: number;
    useCooldown?: boolean;
    cooldownMinutes?: number;
    marketType?: 'SPOT' | 'FUTURES';
    leverage?: number;
    tpCalculationMode?: 'default' | 'fibonacci';
    useMtfFilter?: boolean;
    useBtcCorrelationFilter?: boolean;
    useMarketRegimeFilter?: boolean;
    useDirectionFilter?: boolean;
    enableLongInBearMarket?: boolean;
    enableShortInBullMarket?: boolean;
    useVolumeFilter?: boolean;
    useFundingFilter?: boolean;
    useConfluenceScoring?: boolean;
    confluenceMinScore?: number;
    useMomentumTimingFilter?: boolean;
    useTrendFilter?: boolean;
    trendFilterPeriod?: number;
    fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236';
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

    positionSizePercent: options.positionSizePercent ?? FILTER_DEFAULTS.positionSizePercent,

    useStochasticFilter: options.useStochasticFilter ?? FILTER_DEFAULTS.useStochasticFilter,
    useAdxFilter: options.useAdxFilter ?? FILTER_DEFAULTS.useAdxFilter,
    minRiskRewardRatio: options.minRiskRewardRatio ?? BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO,
    useCooldown: options.useCooldown ?? FILTER_DEFAULTS.useCooldown,
    cooldownMinutes: options.cooldownMinutes ?? FILTER_DEFAULTS.cooldownMinutes,

    useMtfFilter: options.useMtfFilter ?? FILTER_DEFAULTS.useMtfFilter,
    useBtcCorrelationFilter: options.useBtcCorrelationFilter ?? FILTER_DEFAULTS.useBtcCorrelationFilter,
    useMarketRegimeFilter: options.useMarketRegimeFilter ?? FILTER_DEFAULTS.useMarketRegimeFilter,
    useDirectionFilter: options.useDirectionFilter ?? FILTER_DEFAULTS.useDirectionFilter,
    enableLongInBearMarket: options.enableLongInBearMarket ?? FILTER_DEFAULTS.enableLongInBearMarket,
    enableShortInBullMarket: options.enableShortInBullMarket ?? FILTER_DEFAULTS.enableShortInBullMarket,
    useVolumeFilter: options.useVolumeFilter ?? FILTER_DEFAULTS.useVolumeFilter,
    useFundingFilter: options.useFundingFilter ?? FILTER_DEFAULTS.useFundingFilter,
    useConfluenceScoring: options.useConfluenceScoring ?? FILTER_DEFAULTS.useConfluenceScoring,
    confluenceMinScore: options.confluenceMinScore ?? FILTER_DEFAULTS.confluenceMinScore,
    useMomentumTimingFilter: options.useMomentumTimingFilter ?? FILTER_DEFAULTS.useMomentumTimingFilter,
    useTrendFilter: options.useTrendFilter ?? FILTER_DEFAULTS.useTrendFilter,
    trendFilterPeriod: options.trendFilterPeriod ?? FILTER_DEFAULTS.trendFilterPeriod,

    setupTypes: Array.from(allSetupTypes),
    useSharedExposure: true,
    marketType: options.marketType ?? 'SPOT',
    leverage: options.leverage ?? 1,
    tpCalculationMode: options.tpCalculationMode ?? 'default',
    fibonacciTargetLevel: options.fibonacciTargetLevel ?? 'auto',
  };
};
