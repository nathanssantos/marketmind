import 'dotenv/config';
import type { VolumeFilterConfig } from '@marketmind/types';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  createBaseConfig,
  parseCliArgs,
  formatCurrency,
  formatPercent,
  printConfig,
  calculateDirectionalMetrics,
  type DirectionalMetrics,
} from './shared-backtest-config';

interface VolumeVariation {
  name: string;
  useVolumeFilter: boolean;
  volumeFilterConfig?: VolumeFilterConfig;
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

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const baseConfig = createBaseConfig();

  const watchers: WatcherConfig[] = [
    {
      symbol,
      interval,
      marketType: 'FUTURES',
      setupTypes: [...ENABLED_SETUPS],
    },
  ];

  console.log(`📊 Symbol: ${symbol}@${interval} (FUTURES)`);
  console.log(`📅 Period: ${startDate} to ${endDate}\n`);

  printConfig();

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

  for (const variation of VARIATIONS) {
    console.log(`⏳ Testing: ${variation.name}...`);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      watchers,
      startDate,
      endDate,
      useVolumeFilter: variation.useVolumeFilter,
      volumeFilterConfig: variation.volumeFilterConfig ?? baseConfig.volumeFilterConfig,
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

  console.log('\n' + '═'.repeat(100));
  console.log('📊 COMBINED RESULTS (LONG + SHORT)');
  console.log('═'.repeat(100) + '\n');

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

  console.log('\n' + '═'.repeat(100));
  console.log('📈 LONG ONLY RESULTS');
  console.log('═'.repeat(100) + '\n');

  console.log('Variação                       P&L       Trades   WinRate   PF      AvgWin    AvgLoss');
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

  console.log('\n' + '═'.repeat(100));
  console.log('📉 SHORT ONLY RESULTS');
  console.log('═'.repeat(100) + '\n');

  console.log('Variação                       P&L       Trades   WinRate   PF      AvgWin    AvgLoss');
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

  const best = sortedResults[0]!;
  const baseline = results.find(r => r.name === 'Sem filtro')!;
  const bestLong = sortedByLong[0]!;
  const bestShort = sortedByShort[0]!;

  console.log('\n' + '═'.repeat(100));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('═'.repeat(100) + '\n');

  console.log(`🏆 Best COMBINED: ${best.name}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);
  if (best.name !== 'Sem filtro') {
    const improvement = best.pnl - baseline.pnl;
    console.log(`   vs No Filter: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
  }

  console.log(`\n📈 Best LONG: ${bestLong.name}`);
  console.log(`   P&L: $${formatCurrency(bestLong.long.pnl)} | WR: ${formatPercent(bestLong.long.winRate)} | Trades: ${bestLong.long.trades}`);

  console.log(`\n📉 Best SHORT: ${bestShort.name}`);
  console.log(`   P&L: $${formatCurrency(bestShort.short.pnl)} | WR: ${formatPercent(bestShort.short.winRate)} | Trades: ${bestShort.short.trades}`);

  const longProfitable = results.filter(r => r.long.pnl > 0);
  const shortProfitable = results.filter(r => r.short.pnl > 0);

  console.log(`\n📌 INSIGHTS:`);
  console.log(`   • ${longProfitable.length}/${results.length} variations profitable for LONG`);
  console.log(`   • ${shortProfitable.length}/${results.length} variations profitable for SHORT`);

  if (bestLong.name !== bestShort.name) {
    console.log(`\n⚠️  LONG and SHORT have DIFFERENT optimal configurations!`);
    console.log(`   Consider using direction-specific volume filter settings.`);
  }

  process.exit(0);
}

runComparison().catch(console.error);
