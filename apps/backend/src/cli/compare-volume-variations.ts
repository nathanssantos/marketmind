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

interface VolumeVariation {
  name: string;
  useVolumeFilter: boolean;
  volumeFilterConfig?: {
    breakoutMultiplier?: number;
    pullbackMultiplier?: number;
    useObvCheck?: boolean;
  };
}

const VARIATIONS: VolumeVariation[] = [
  { name: 'Sem filtro', useVolumeFilter: false },
  { name: 'Padrao (OBV + 1.5x)', useVolumeFilter: true },
  { name: 'Apenas OBV (sem volume)', useVolumeFilter: true, volumeFilterConfig: { breakoutMultiplier: 0, pullbackMultiplier: 0, useObvCheck: true } },
  { name: 'Volume 1.2x + OBV', useVolumeFilter: true, volumeFilterConfig: { breakoutMultiplier: 1.2, pullbackMultiplier: 0.8 } },
  { name: 'Volume 1.0x + OBV', useVolumeFilter: true, volumeFilterConfig: { breakoutMultiplier: 1.0, pullbackMultiplier: 0.5 } },
  { name: 'Volume 1.5x (sem OBV)', useVolumeFilter: true, volumeFilterConfig: { useObvCheck: false } },
  { name: 'Volume 0.8x + OBV', useVolumeFilter: true, volumeFilterConfig: { breakoutMultiplier: 0.8, pullbackMultiplier: 0.5 } },
];

async function runComparison() {
  console.log('🔬 Volume Filter Variations Comparison');
  console.log('======================================\n');

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
  }> = [];

  for (const variation of VARIATIONS) {
    console.log(`⏳ Testing: ${variation.name}...`);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      useVolumeFilter: variation.useVolumeFilter,
      volumeFilterConfig: variation.volumeFilterConfig,
    });

    const result = await engine.run();

    results.push({
      name: variation.name,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
    });

    console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
  }

  console.log('\n📊 COMPARISON RESULTS');
  console.log('=====================\n');

  console.log('Variação                       P&L         P&L%    Trades   WinRate   PF    MaxDD');
  console.log('─'.repeat(90));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (const r of sortedResults) {
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);

    const isBest = r === sortedResults[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${r.name.padEnd(26)} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr}`);
  }

  console.log('─'.repeat(90));

  const best = sortedResults[0]!;
  const baseline = results.find(r => r.name === 'Sem filtro')!;

  console.log(`\n📈 ANÁLISE:`);
  console.log(`   🏆 Melhor resultado: ${best.name}`);
  console.log(`      P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);

  if (best.name !== 'Sem filtro') {
    const improvement = best.pnl - baseline.pnl;
    console.log(`      vs Sem filtro: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
  }

  const bestWinRate = sortedResults.reduce((a, b) => a.winRate > b.winRate ? a : b);
  const lowestDrawdown = sortedResults.reduce((a, b) => a.maxDrawdown < b.maxDrawdown ? a : b);

  console.log(`\n   📊 Melhor Win Rate: ${bestWinRate.name} (${formatPercent(bestWinRate.winRate)})`);
  console.log(`   📉 Menor Drawdown: ${lowestDrawdown.name} (${formatPercent(lowestDrawdown.maxDrawdown)})`);

  process.exit(0);
}

runComparison().catch(console.error);
