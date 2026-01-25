import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { db } from '../db';
import { activeWatchers, autoTradingConfig, tradingProfiles } from '../db/schema';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { MultiWatcherBacktestConfig, WatcherConfig } from '@marketmind/types';

const formatCurrency = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatPercent = (value: number): string => value.toFixed(2) + '%';

async function runComparison() {
  console.log('🔬 Volume Filter Comparison Backtest');
  console.log('=====================================\n');

  const [config] = await db.select().from(autoTradingConfig).limit(1);
  if (!config) {
    console.error('❌ No auto-trading config found');
    process.exit(1);
  }

  const watcherRows = await db
    .select()
    .from(activeWatchers)
    .where(eq(activeWatchers.walletId, config.walletId));

  if (watcherRows.length === 0) {
    console.error('❌ No active watchers found');
    process.exit(1);
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
        if (profile) setupTypes = JSON.parse(profile.enabledSetupTypes);
      }
      return {
        symbol: w.symbol,
        interval: w.interval,
        marketType: w.marketType as 'SPOT' | 'FUTURES',
        setupTypes: setupTypes ?? JSON.parse(config.enabledSetupTypes),
        profileId: w.profileId ?? undefined,
      };
    })
  );

  console.log(`📊 Watchers: ${watchers.map(w => `${w.symbol}@${w.interval}`).join(', ')}`);

  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));
  const startDate = startDateArg ? startDateArg.split('=')[1]! : '2024-06-01';
  const endDate = endDateArg ? endDateArg.split('=')[1]! : '2025-01-01';
  const initialCapital = 10000;

  console.log(`📅 Period: ${startDate} to ${endDate}`);
  console.log(`💰 Initial Capital: $${formatCurrency(initialCapital)}\n`);

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'useVolumeFilter'> = {
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
    useMtfFilter: false,
    useBtcCorrelationFilter: false,
    useMarketRegimeFilter: false,
    useFundingFilter: false,
    useConfluenceScoring: false,
    useMomentumTimingFilter: false,
    trendFilterPeriod: 21,
    setupTypes: JSON.parse(config.enabledSetupTypes),
    useSharedExposure: true,
    marketType: watchers[0]?.marketType ?? 'FUTURES',
    leverage: config.leverage ?? 1,
    tpCalculationMode: config.tpCalculationMode ?? 'default',
  };

  console.log('⏳ Running backtest WITHOUT volume filter...\n');
  const engineWithout = new MultiWatcherBacktestEngine({ ...baseConfig, useVolumeFilter: false });
  const resultWithout = await engineWithout.run();

  console.log('⏳ Running backtest WITH volume filter...\n');
  const engineWith = new MultiWatcherBacktestEngine({ ...baseConfig, useVolumeFilter: true });
  const resultWith = await engineWith.run();

  console.log('\n📊 COMPARISON RESULTS');
  console.log('=====================\n');

  console.log('                           WITHOUT Filter    WITH Filter      Δ');
  console.log('─'.repeat(70));

  const pnlDelta = resultWith.metrics.totalPnl - resultWithout.metrics.totalPnl;
  const pnlPctDelta = resultWith.metrics.totalPnlPercent - resultWithout.metrics.totalPnlPercent;
  console.log(
    `Total P&L:                 $${formatCurrency(resultWithout.metrics.totalPnl).padStart(10)}      $${formatCurrency(resultWith.metrics.totalPnl).padStart(10)}    ${pnlDelta >= 0 ? '+' : ''}$${formatCurrency(pnlDelta)}`
  );
  console.log(
    `Total P&L %:               ${formatPercent(resultWithout.metrics.totalPnlPercent).padStart(10)}      ${formatPercent(resultWith.metrics.totalPnlPercent).padStart(10)}    ${pnlPctDelta >= 0 ? '+' : ''}${formatPercent(pnlPctDelta)}`
  );

  const ddDelta = resultWith.metrics.maxDrawdownPercent - resultWithout.metrics.maxDrawdownPercent;
  console.log(
    `Max Drawdown:              ${formatPercent(resultWithout.metrics.maxDrawdownPercent).padStart(10)}      ${formatPercent(resultWith.metrics.maxDrawdownPercent).padStart(10)}    ${ddDelta >= 0 ? '+' : ''}${formatPercent(ddDelta)}`
  );

  console.log('─'.repeat(70));

  const tradesDelta = resultWith.metrics.totalTrades - resultWithout.metrics.totalTrades;
  console.log(
    `Total Trades:              ${String(resultWithout.metrics.totalTrades).padStart(10)}      ${String(resultWith.metrics.totalTrades).padStart(10)}    ${tradesDelta >= 0 ? '+' : ''}${tradesDelta}`
  );

  const winRateDelta = resultWith.metrics.winRate - resultWithout.metrics.winRate;
  console.log(
    `Win Rate:                  ${formatPercent(resultWithout.metrics.winRate).padStart(10)}      ${formatPercent(resultWith.metrics.winRate).padStart(10)}    ${winRateDelta >= 0 ? '+' : ''}${formatPercent(winRateDelta)}`
  );

  const pfDelta = resultWith.metrics.profitFactor - resultWithout.metrics.profitFactor;
  console.log(
    `Profit Factor:             ${resultWithout.metrics.profitFactor.toFixed(2).padStart(10)}      ${resultWith.metrics.profitFactor.toFixed(2).padStart(10)}    ${pfDelta >= 0 ? '+' : ''}${pfDelta.toFixed(2)}`
  );

  const avgWinDelta = resultWith.metrics.avgWin - resultWithout.metrics.avgWin;
  console.log(
    `Avg Win:                   $${formatCurrency(resultWithout.metrics.avgWin).padStart(9)}      $${formatCurrency(resultWith.metrics.avgWin).padStart(9)}    ${avgWinDelta >= 0 ? '+' : ''}$${formatCurrency(avgWinDelta)}`
  );

  const avgLossDelta = Math.abs(resultWith.metrics.avgLoss) - Math.abs(resultWithout.metrics.avgLoss);
  console.log(
    `Avg Loss:                  $${formatCurrency(Math.abs(resultWithout.metrics.avgLoss)).padStart(9)}      $${formatCurrency(Math.abs(resultWith.metrics.avgLoss)).padStart(9)}    ${avgLossDelta >= 0 ? '+' : ''}$${formatCurrency(avgLossDelta)}`
  );

  console.log('─'.repeat(70));

  const skippedWithout = resultWithout.watcherStats.reduce((sum, s) => sum + s.tradesSkipped, 0);
  const skippedWith = resultWith.watcherStats.reduce((sum, s) => sum + s.tradesSkipped, 0);
  const volumeSkipped = resultWith.watcherStats.reduce(
    (sum, s) => sum + (s.skippedReasons?.['skippedVolume'] ?? 0),
    0
  );

  console.log(`Total Skipped Trades:      ${String(skippedWithout).padStart(10)}      ${String(skippedWith).padStart(10)}    +${skippedWith - skippedWithout}`);
  console.log(`Skipped by Volume Filter:  ${String(0).padStart(10)}      ${String(volumeSkipped).padStart(10)}    +${volumeSkipped}`);

  console.log('\n📈 VERDICT:');
  if (resultWith.metrics.totalPnl > resultWithout.metrics.totalPnl) {
    console.log(`   ✅ Volume filter IMPROVED results by $${formatCurrency(pnlDelta)} (${formatPercent(pnlPctDelta)})`);
  } else if (resultWith.metrics.totalPnl < resultWithout.metrics.totalPnl) {
    console.log(`   ❌ Volume filter REDUCED results by $${formatCurrency(Math.abs(pnlDelta))} (${formatPercent(Math.abs(pnlPctDelta))})`);
  } else {
    console.log('   ➖ Volume filter had NO IMPACT on results');
  }

  if (resultWith.metrics.winRate > resultWithout.metrics.winRate) {
    console.log(`   ✅ Win rate improved by ${formatPercent(winRateDelta)}`);
  } else if (winRateDelta < -1) {
    console.log(`   ⚠️  Win rate decreased by ${formatPercent(Math.abs(winRateDelta))}`);
  }

  if (resultWith.metrics.maxDrawdownPercent < resultWithout.metrics.maxDrawdownPercent) {
    console.log(`   ✅ Max drawdown reduced by ${formatPercent(Math.abs(ddDelta))}`);
  } else if (ddDelta > 1) {
    console.log(`   ⚠️  Max drawdown increased by ${formatPercent(ddDelta)}`);
  }

  process.exit(0);
}

runComparison().catch(console.error);
