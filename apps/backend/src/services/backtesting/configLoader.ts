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

export const loadMultiWatcherConfigFromAutoTrading = async (
  walletId: string,
  options: DateRangeOptions
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
    maxPositionSize: parseFloat(config.maxPositionSize),
    maxConcurrentPositions: config.maxConcurrentPositions,
    dailyLossLimit: parseFloat(config.dailyLossLimit),

    useStochasticFilter: config.useStochasticFilter,
    useAdxFilter: config.useAdxFilter,
    onlyWithTrend: config.useTrendFilter,

    setupTypes: JSON.parse(config.enabledSetupTypes),
    useSharedExposure: true,
    marketType: watchers[0]?.marketType ?? 'SPOT',
    leverage: config.leverage ?? 1,
    tpCalculationMode: config.tpCalculationMode,
  };
};

export const buildMultiWatcherConfigFromWatchers = (
  watcherConfigs: WatcherConfig[],
  options: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    exposureMultiplier?: number;
    maxPositionSize?: number;
    dailyLossLimit?: number;
    useStochasticFilter?: boolean;
    useAdxFilter?: boolean;
    onlyWithTrend?: boolean;
    minRiskRewardRatio?: number;
    cooldownMinutes?: number;
    marketType?: 'SPOT' | 'FUTURES';
    leverage?: number;
    tpCalculationMode?: 'default' | 'fibonacci';
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
    maxPositionSize: options.maxPositionSize ?? 15,
    dailyLossLimit: options.dailyLossLimit ?? 5,

    useStochasticFilter: options.useStochasticFilter ?? false,
    useAdxFilter: options.useAdxFilter ?? false,
    onlyWithTrend: options.onlyWithTrend ?? false,
    minRiskRewardRatio: options.minRiskRewardRatio ?? BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO,
    useCooldown: true,
    cooldownMinutes: options.cooldownMinutes ?? 15,

    setupTypes: Array.from(allSetupTypes),
    useSharedExposure: true,
    marketType: options.marketType ?? 'SPOT',
    leverage: options.leverage ?? 1,
    tpCalculationMode: options.tpCalculationMode ?? 'default',
  };
};
