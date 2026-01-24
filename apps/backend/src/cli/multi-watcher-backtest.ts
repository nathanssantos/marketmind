import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { db } from '../db';
import { activeWatchers, autoTradingConfig, tradingProfiles } from '../db/schema';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { MultiWatcherBacktestConfig, WatcherConfig } from '@marketmind/types';

const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPercent = (value: number): string => {
  return value.toFixed(2) + '%';
};

async function runMultiWatcherBacktest() {
  console.log('🚀 Multi-Watcher Backtest Runner');
  console.log('================================\n');

  const [config] = await db.select().from(autoTradingConfig).limit(1);

  if (!config) {
    console.error('❌ No auto-trading config found in database');
    process.exit(1);
  }

  console.log('📋 Auto-Trading Config:');
  console.log(`   - Wallet ID: ${config.walletId}`);
  console.log(`   - Exposure Multiplier: ${config.exposureMultiplier}`);
  console.log(`   - Max Position Size: ${config.maxPositionSize}%`);
  console.log(`   - Daily Loss Limit: ${config.dailyLossLimit}%`);
  console.log(`   - Leverage: ${config.leverage}x`);
  console.log(`   - TP Mode: ${config.tpCalculationMode}`);
  console.log(`   - Filters: Stochastic=${config.useStochasticFilter}, ADX=${config.useAdxFilter}, Trend=${config.useTrendFilter}`);
  console.log();

  const watcherRows = await db
    .select()
    .from(activeWatchers)
    .where(eq(activeWatchers.walletId, config.walletId));

  if (watcherRows.length === 0) {
    console.error('❌ No active watchers found for wallet');
    process.exit(1);
  }

  console.log(`📊 Active Watchers (${watcherRows.length}):`);

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

      const watcherSetupTypes = setupTypes ?? JSON.parse(config.enabledSetupTypes);
      console.log(`   - ${w.symbol} @ ${w.interval} (${w.marketType}) - Strategies: ${watcherSetupTypes.join(', ')}`);

      return {
        symbol: w.symbol,
        interval: w.interval,
        marketType: w.marketType as 'SPOT' | 'FUTURES',
        setupTypes: watcherSetupTypes,
        profileId: w.profileId ?? undefined,
      };
    })
  );

  console.log();

  const defaultStartDate = '2024-01-11';
  const defaultEndDate = '2025-01-11';
  const initialCapital = 10000;

  const fibLevelArg = process.argv.find(arg => arg.startsWith('--fib-level='));
  const fibonacciTpLevel = fibLevelArg ? parseFloat(fibLevelArg.split('=')[1] ?? '0') : undefined;

  const fibTargetArg = process.argv.find(arg => arg.startsWith('--fib-target='));
  const fibonacciTargetLevelStr = fibTargetArg
    ? (fibTargetArg.split('=')[1] as 'auto' | '1' | '1.272' | '1.618' | '2')
    : config.fibonacciTargetLevel ?? 'auto';

  const fibLevelMap: Record<string, number | undefined> = {
    'auto': undefined,
    '1': 1.0,
    '1.272': 1.272,
    '1.618': 1.618,
    '2': 2.0,
  };
  const fibonacciTargetLevelNum = fibLevelMap[fibonacciTargetLevelStr];

  const tpModeArg = process.argv.find(arg => arg.startsWith('--tp-mode='));
  const tpMode = tpModeArg ? (tpModeArg.split('=')[1] as 'default' | 'fibonacci') : config.tpCalculationMode ?? 'default';

  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const startDate = startDateArg ? startDateArg.split('=')[1]! : defaultStartDate;

  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));
  const endDate = endDateArg ? endDateArg.split('=')[1]! : defaultEndDate;

  console.log(`📅 Backtest Period: ${startDate} to ${endDate}`);
  console.log(`💰 Initial Capital: $${formatCurrency(initialCapital)}`);
  console.log(`🎯 TP Mode: ${tpMode}${tpMode === 'fibonacci' ? ` (target: ${fibonacciTargetLevelStr})` : ''}`);
  if (fibonacciTpLevel || fibonacciTargetLevelNum) {
    const level = fibonacciTpLevel ?? fibonacciTargetLevelNum;
    if (level) console.log(`   Fibonacci TP Level: ${(level * 100).toFixed(1)}%`);
  }
  console.log();

  const backtestConfig: MultiWatcherBacktestConfig = {
    watchers,
    startDate,
    endDate,
    initialCapital,

    exposureMultiplier: parseFloat(config.exposureMultiplier),

    useStochasticFilter: config.useStochasticFilter,
    useAdxFilter: config.useAdxFilter,
    useTrendFilter: config.useTrendFilter,
    minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
    useCooldown: true,
    cooldownMinutes: 15,

    useMtfFilter: config.useMtfFilter,
    useBtcCorrelationFilter: config.useBtcCorrelationFilter,
    useMarketRegimeFilter: config.useMarketRegimeFilter,
    useVolumeFilter: config.useVolumeFilter,
    useFundingFilter: config.useFundingFilter,
    useConfluenceScoring: config.useConfluenceScoring,
    confluenceMinScore: config.confluenceMinScore,
    useMomentumTimingFilter: config.useMomentumTimingFilter,
    trendFilterPeriod: 21,

    setupTypes: JSON.parse(config.enabledSetupTypes),
    useSharedExposure: true,
    marketType: watchers[0]?.marketType ?? 'FUTURES',
    leverage: config.leverage ?? 1,
    tpCalculationMode: tpMode,
    fibonacciTpLevel: fibonacciTpLevel ?? fibonacciTargetLevelNum,
  };

  console.log('⏳ Running backtest... (this may take a few minutes)\n');

  const engine = new MultiWatcherBacktestEngine(backtestConfig);
  const startTime = Date.now();

  try {
    const result = await engine.run();
    const duration = (Date.now() - startTime) / 1000;

    console.log('\n📈 BACKTEST RESULTS');
    console.log('===================\n');

    console.log('💵 Performance:');
    console.log(`   - Final Equity: $${formatCurrency(initialCapital + result.metrics.totalPnl)}`);
    console.log(`   - Total P&L: $${formatCurrency(result.metrics.totalPnl)} (${formatPercent(result.metrics.totalPnlPercent)})`);
    console.log(`   - Max Drawdown: $${formatCurrency(result.metrics.maxDrawdown)} (${formatPercent(result.metrics.maxDrawdownPercent)})`);
    console.log();

    console.log('📊 Trade Statistics:');
    console.log(`   - Total Trades: ${result.metrics.totalTrades}`);
    console.log(`   - Winning: ${result.metrics.winningTrades} | Losing: ${result.metrics.losingTrades}`);
    console.log(`   - Win Rate: ${formatPercent(result.metrics.winRate)}`);
    console.log(`   - Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
    console.log(`   - Avg Win: $${formatCurrency(result.metrics.avgWin)} | Avg Loss: $${formatCurrency(Math.abs(result.metrics.avgLoss))}`);
    console.log(`   - Largest Win: $${formatCurrency(result.metrics.largestWin)} | Largest Loss: $${formatCurrency(Math.abs(result.metrics.largestLoss))}`);
    console.log(`   - Total Commission: $${formatCurrency(result.metrics.totalCommission)}`);
    console.log();

    console.log('⏱️ Trade Duration:');
    console.log(`   - Average: ${result.metrics.avgTradeDuration.toFixed(0)} min`);
    console.log(`   - Avg Win: ${result.metrics.avgWinDuration.toFixed(0)} min | Avg Loss: ${result.metrics.avgLossDuration.toFixed(0)} min`);
    console.log();

    console.log('📋 Watcher Performance:');
    for (const stats of result.watcherStats) {
      const winRateStr = stats.winRate > 0 ? formatPercent(stats.winRate) : 'N/A';
      console.log(`   ${stats.symbol} @ ${stats.interval}:`);
      console.log(`      Setups: ${stats.totalSetups} | Executed: ${stats.tradesExecuted} | Skipped: ${stats.tradesSkipped}`);
      console.log(`      P&L: $${formatCurrency(stats.pnl)} | Win Rate: ${winRateStr}`);

      if (Object.keys(stats.skippedReasons).length > 0) {
        console.log(`      Skip Reasons: ${JSON.stringify(stats.skippedReasons)}`);
      }
    }
    console.log();

    console.log(`✅ Backtest completed in ${duration.toFixed(1)}s`);
    console.log(`   Backtest ID: ${result.id}`);

  } catch (error) {
    console.error('❌ Backtest failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMultiWatcherBacktest().catch(console.error);
