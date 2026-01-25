import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { TRADING_DEFAULTS } from '@marketmind/types';
import type { VolumeFilterConfig } from '@marketmind/types';
import { db } from '../db';
import { activeWatchers, autoTradingConfig, tradingProfiles } from '../db/schema';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { MultiWatcherBacktestConfig, WatcherConfig } from '@marketmind/types';

const formatCurrency = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatPercent = (value: number): string => value.toFixed(2) + '%';

interface DirectionalVolumeVariation {
  name: string;
  config: VolumeFilterConfig;
}

const DIRECTIONAL_VARIATIONS: DirectionalVolumeVariation[] = [
  {
    name: 'Baseline (OBV both)',
    config: { useObvCheck: true, obvLookback: 5 },
  },
  {
    name: 'OBV only LONG',
    config: {
      longConfig: { useObvCheck: true, obvLookback: 5 },
      shortConfig: { useObvCheck: false },
    },
  },
  {
    name: 'OBV only SHORT',
    config: {
      longConfig: { useObvCheck: false },
      shortConfig: { useObvCheck: true, obvLookback: 5 },
    },
  },
  {
    name: 'OBV lookback 3 (both)',
    config: { useObvCheck: true, obvLookback: 3 },
  },
  {
    name: 'OBV lookback 7 (both)',
    config: { useObvCheck: true, obvLookback: 7 },
  },
  {
    name: 'OBV lookback 10 (both)',
    config: { useObvCheck: true, obvLookback: 10 },
  },
  {
    name: 'LONG lb=3, SHORT lb=7',
    config: {
      useObvCheck: true,
      longConfig: { obvLookback: 3 },
      shortConfig: { obvLookback: 7 },
    },
  },
  {
    name: 'LONG lb=7, SHORT lb=3',
    config: {
      useObvCheck: true,
      longConfig: { obvLookback: 7 },
      shortConfig: { obvLookback: 3 },
    },
  },
  {
    name: 'LONG lb=5, SHORT lb=10',
    config: {
      useObvCheck: true,
      longConfig: { obvLookback: 5 },
      shortConfig: { obvLookback: 10 },
    },
  },
  {
    name: 'Stricter LONG (vol 2x)',
    config: {
      useObvCheck: true,
      longConfig: { breakoutMultiplier: 2.0, pullbackMultiplier: 1.5 },
      shortConfig: { breakoutMultiplier: 1.5, pullbackMultiplier: 1.0 },
    },
  },
  {
    name: 'Stricter SHORT (vol 2x)',
    config: {
      useObvCheck: true,
      longConfig: { breakoutMultiplier: 1.5, pullbackMultiplier: 1.0 },
      shortConfig: { breakoutMultiplier: 2.0, pullbackMultiplier: 1.5 },
    },
  },
  {
    name: 'Loose LONG (vol 1x)',
    config: {
      useObvCheck: true,
      longConfig: { breakoutMultiplier: 1.0, pullbackMultiplier: 0.5 },
      shortConfig: { breakoutMultiplier: 1.5, pullbackMultiplier: 1.0 },
    },
  },
  {
    name: 'Loose SHORT (vol 1x)',
    config: {
      useObvCheck: true,
      longConfig: { breakoutMultiplier: 1.5, pullbackMultiplier: 1.0 },
      shortConfig: { breakoutMultiplier: 1.0, pullbackMultiplier: 0.5 },
    },
  },
  {
    name: 'No vol check (OBV only)',
    config: {
      useObvCheck: true,
      breakoutMultiplier: 0,
      pullbackMultiplier: 0,
    },
  },
];

interface DirectionalMetrics {
  pnl: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

const calculateDirectionalMetrics = (trades: Array<{ side: 'LONG' | 'SHORT'; pnl?: number }>): DirectionalMetrics => {
  if (trades.length === 0) return { pnl: 0, trades: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0 };

  const completedTrades = trades.filter(t => t.pnl !== undefined);
  if (completedTrades.length === 0) return { pnl: 0, trades: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0 };

  const wins = completedTrades.filter(t => t.pnl! > 0);
  const losses = completedTrades.filter(t => t.pnl! <= 0);
  const totalPnl = completedTrades.reduce((sum, t) => sum + t.pnl!, 0);
  const totalWins = wins.reduce((sum, t) => sum + t.pnl!, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0));

  return {
    pnl: totalPnl,
    trades: completedTrades.length,
    winRate: (wins.length / completedTrades.length) * 100,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    avgWin: wins.length > 0 ? totalWins / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
  };
};

async function runDirectionalComparison() {
  console.log('🔬 Directional Volume Filter Comparison');
  console.log('========================================\n');

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

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'useVolumeFilter' | 'volumeFilterConfig'> = {
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

  const results: Array<{
    name: string;
    pnl: number;
    pnlPct: number;
    trades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    long: DirectionalMetrics;
    short: DirectionalMetrics;
  }> = [];

  for (const variation of DIRECTIONAL_VARIATIONS) {
    console.log(`⏳ Testing: ${variation.name}...`);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      useVolumeFilter: true,
      volumeFilterConfig: variation.config,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      name: variation.name,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      long: longMetrics,
      short: shortMetrics,
    });

    console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
    console.log(`     LONG:  P&L: $${formatCurrency(longMetrics.pnl)} | WR: ${formatPercent(longMetrics.winRate)} | Trades: ${longMetrics.trades}`);
    console.log(`     SHORT: P&L: $${formatCurrency(shortMetrics.pnl)} | WR: ${formatPercent(shortMetrics.winRate)} | Trades: ${shortMetrics.trades}`);
  }

  console.log('\n' + '═'.repeat(110));
  console.log('📊 COMBINED RESULTS');
  console.log('═'.repeat(110) + '\n');

  console.log('Config                         P&L         P&L%    Trades   WinRate   PF    MaxDD');
  console.log('─'.repeat(90));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (const r of sortedResults) {
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);

    const isBest = r === sortedResults[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${r.name.padEnd(26)} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr}`);
  }

  console.log('─'.repeat(90));

  console.log('\n' + '═'.repeat(110));
  console.log('📈 LONG ONLY RESULTS');
  console.log('═'.repeat(110) + '\n');

  console.log('Config                         P&L       Trades   WinRate   PF      AvgWin    AvgLoss');
  console.log('─'.repeat(90));

  const sortedByLong = [...results].sort((a, b) => b.long.pnl - a.long.pnl);

  for (const r of sortedByLong) {
    const pnlStr = `$${formatCurrency(r.long.pnl)}`.padStart(12);
    const tradesStr = String(r.long.trades).padStart(6);
    const wrStr = formatPercent(r.long.winRate).padStart(8);
    const pfStr = r.long.profitFactor === Infinity ? '  ∞' : r.long.profitFactor.toFixed(2).padStart(5);
    const avgWinStr = `$${formatCurrency(r.long.avgWin)}`.padStart(10);
    const avgLossStr = `$${formatCurrency(r.long.avgLoss)}`.padStart(10);

    const isBest = r === sortedByLong[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${r.name.padEnd(26)} ${pnlStr} ${tradesStr} ${wrStr} ${pfStr} ${avgWinStr} ${avgLossStr}`);
  }

  console.log('─'.repeat(90));

  console.log('\n' + '═'.repeat(110));
  console.log('📉 SHORT ONLY RESULTS');
  console.log('═'.repeat(110) + '\n');

  console.log('Config                         P&L       Trades   WinRate   PF      AvgWin    AvgLoss');
  console.log('─'.repeat(90));

  const sortedByShort = [...results].sort((a, b) => b.short.pnl - a.short.pnl);

  for (const r of sortedByShort) {
    const pnlStr = `$${formatCurrency(r.short.pnl)}`.padStart(12);
    const tradesStr = String(r.short.trades).padStart(6);
    const wrStr = formatPercent(r.short.winRate).padStart(8);
    const pfStr = r.short.profitFactor === Infinity ? '  ∞' : r.short.profitFactor.toFixed(2).padStart(5);
    const avgWinStr = `$${formatCurrency(r.short.avgWin)}`.padStart(10);
    const avgLossStr = `$${formatCurrency(r.short.avgLoss)}`.padStart(10);

    const isBest = r === sortedByShort[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${r.name.padEnd(26)} ${pnlStr} ${tradesStr} ${wrStr} ${pfStr} ${avgWinStr} ${avgLossStr}`);
  }

  console.log('─'.repeat(90));

  const bestCombined = sortedResults[0]!;
  const bestLong = sortedByLong[0]!;
  const bestShort = sortedByShort[0]!;
  const baseline = results.find(r => r.name === 'Baseline (OBV both)')!;

  console.log('\n' + '═'.repeat(110));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('═'.repeat(110) + '\n');

  console.log(`🏆 Best COMBINED: ${bestCombined.name}`);
  console.log(`   P&L: $${formatCurrency(bestCombined.pnl)} (${formatPercent(bestCombined.pnlPct)})`);
  if (bestCombined.name !== 'Baseline (OBV both)') {
    const improvement = bestCombined.pnl - baseline.pnl;
    console.log(`   vs Baseline: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
  }

  console.log(`\n📈 Best LONG config: ${bestLong.name}`);
  console.log(`   P&L: $${formatCurrency(bestLong.long.pnl)} | WR: ${formatPercent(bestLong.long.winRate)} | Trades: ${bestLong.long.trades}`);

  console.log(`\n📉 Best SHORT config: ${bestShort.name}`);
  console.log(`   P&L: $${formatCurrency(bestShort.short.pnl)} | WR: ${formatPercent(bestShort.short.winRate)} | Trades: ${bestShort.short.trades}`);

  if (bestLong.name !== bestShort.name) {
    console.log(`\n⚠️  IMPORTANT: LONG and SHORT have DIFFERENT optimal configurations!`);
    console.log(`   Recommended: Use direction-specific volume filter settings:`);
    console.log(`   - LONG:  ${bestLong.name}`);
    console.log(`   - SHORT: ${bestShort.name}`);
  }

  const longProfitable = results.filter(r => r.long.pnl > 0).length;
  const shortProfitable = results.filter(r => r.short.pnl > 0).length;

  console.log(`\n📌 PROFITABILITY:`);
  console.log(`   • ${longProfitable}/${results.length} configs profitable for LONG`);
  console.log(`   • ${shortProfitable}/${results.length} configs profitable for SHORT`);

  process.exit(0);
}

runDirectionalComparison().catch(console.error);
