import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  createBaseConfig,
  parseCliArgs,
  formatCurrency,
  formatPercent,
  formatDuration,
  printConfig,
  calculateDirectionalMetrics,
} from './shared-backtest-config';

const TIMEFRAMES = ['30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];

async function runTimeframeComparison() {
  console.log('🕐 Comparação de Timeframes - BTC FUTURES');
  console.log('==========================================\n');

  const { symbol, startDate, endDate } = parseCliArgs();
  const baseConfig = createBaseConfig();

  console.log(`📊 Symbol: ${symbol} (FUTURES)`);
  console.log(`📅 Período: ${startDate} até ${endDate}`);
  console.log(`⏱️  Timeframes: ${TIMEFRAMES.join(', ')}\n`);

  printConfig();

  const results: Array<{
    interval: string;
    pnl: number;
    pnlPct: number;
    trades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    avgTradeDuration: number;
    long: ReturnType<typeof calculateDirectionalMetrics>;
    short: ReturnType<typeof calculateDirectionalMetrics>;
  }> = [];

  for (const interval of TIMEFRAMES) {
    console.log(`⏳ Testando ${interval}...`);

    const watchers: WatcherConfig[] = [
      {
        symbol,
        interval,
        marketType: 'FUTURES',
        setupTypes: [...ENABLED_SETUPS],
      },
    ];

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      watchers,
      startDate,
      endDate,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      interval,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      avgTradeDuration: result.metrics.avgTradeDuration,
      long: longMetrics,
      short: shortMetrics,
    });

    console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
  }

  console.log('\n' + '═'.repeat(120));
  console.log('📊 RESULTADOS POR P&L');
  console.log('═'.repeat(120) + '\n');

  console.log('Interval    P&L          P&L%     Trades   WinRate    PF     MaxDD    AvgDuration   LONG P&L     SHORT P&L');
  console.log('─'.repeat(115));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (const r of sortedResults) {
    const intervalStr = r.interval.padEnd(8);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(6);
    const ddStr = formatPercent(r.maxDrawdown).padStart(8);
    const durationStr = formatDuration(r.avgTradeDuration).padStart(12);
    const longPnlStr = `$${formatCurrency(r.long.pnl)}`.padStart(12);
    const shortPnlStr = `$${formatCurrency(r.short.pnl)}`.padStart(12);

    const isBest = r === sortedResults[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${intervalStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${durationStr} ${longPnlStr} ${shortPnlStr}`);
  }

  console.log('─'.repeat(115));

  console.log('\n' + '═'.repeat(120));
  console.log('📈 RESULTADOS POR WIN RATE');
  console.log('═'.repeat(120) + '\n');

  const sortedByWinRate = [...results].sort((a, b) => b.winRate - a.winRate);

  console.log('Interval    WinRate    Trades   PF       P&L          LONG WR     SHORT WR');
  console.log('─'.repeat(80));

  for (const r of sortedByWinRate) {
    const intervalStr = r.interval.padEnd(8);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(6);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const longWrStr = formatPercent(r.long.winRate).padStart(10);
    const shortWrStr = formatPercent(r.short.winRate).padStart(10);

    const isBest = r === sortedByWinRate[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${intervalStr} ${wrStr} ${tradesStr} ${pfStr} ${pnlStr} ${longWrStr} ${shortWrStr}`);
  }

  console.log('─'.repeat(80));

  console.log('\n' + '═'.repeat(120));
  console.log('📉 RESULTADOS POR DRAWDOWN (menor é melhor)');
  console.log('═'.repeat(120) + '\n');

  const sortedByDrawdown = [...results].sort((a, b) => a.maxDrawdown - b.maxDrawdown);

  console.log('Interval    MaxDD      P&L          WinRate    PF       Trades');
  console.log('─'.repeat(70));

  for (const r of sortedByDrawdown) {
    const intervalStr = r.interval.padEnd(8);
    const ddStr = formatPercent(r.maxDrawdown).padStart(8);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(6);
    const tradesStr = String(r.trades).padStart(6);

    const isBest = r === sortedByDrawdown[0];
    const marker = isBest ? '🏆' : '  ';

    console.log(`${marker} ${intervalStr} ${ddStr} ${pnlStr} ${wrStr} ${pfStr} ${tradesStr}`);
  }

  console.log('─'.repeat(70));

  const bestByPnl = sortedResults[0]!;
  const bestByWinRate = sortedByWinRate[0]!;
  const bestByDrawdown = sortedByDrawdown[0]!;

  console.log('\n' + '═'.repeat(120));
  console.log('🏆 RESUMO FINAL');
  console.log('═'.repeat(120) + '\n');

  console.log(`📊 MELHOR P&L: ${bestByPnl.interval}`);
  console.log(`   • P&L: $${formatCurrency(bestByPnl.pnl)} (${formatPercent(bestByPnl.pnlPct)})`);
  console.log(`   • Win Rate: ${formatPercent(bestByPnl.winRate)} | Profit Factor: ${bestByPnl.profitFactor.toFixed(2)}`);
  console.log(`   • Trades: ${bestByPnl.trades} | Max Drawdown: ${formatPercent(bestByPnl.maxDrawdown)}`);
  console.log(`   • LONG: $${formatCurrency(bestByPnl.long.pnl)} | SHORT: $${formatCurrency(bestByPnl.short.pnl)}`);

  if (bestByWinRate.interval !== bestByPnl.interval) {
    console.log(`\n📈 MELHOR WIN RATE: ${bestByWinRate.interval}`);
    console.log(`   • Win Rate: ${formatPercent(bestByWinRate.winRate)} | P&L: $${formatCurrency(bestByWinRate.pnl)}`);
  }

  if (bestByDrawdown.interval !== bestByPnl.interval && bestByDrawdown.interval !== bestByWinRate.interval) {
    console.log(`\n📉 MENOR DRAWDOWN: ${bestByDrawdown.interval}`);
    console.log(`   • Max Drawdown: ${formatPercent(bestByDrawdown.maxDrawdown)} | P&L: $${formatCurrency(bestByDrawdown.pnl)}`);
  }

  const profitableTimeframes = results.filter(r => r.pnl > 0);
  const unprofitableTimeframes = results.filter(r => r.pnl <= 0);

  console.log(`\n📌 ESTATÍSTICAS GERAIS:`);
  console.log(`   • Timeframes lucrativos: ${profitableTimeframes.length}/${results.length}`);
  if (profitableTimeframes.length > 0) {
    console.log(`     ${profitableTimeframes.map(r => r.interval).join(', ')}`);
  }
  if (unprofitableTimeframes.length > 0) {
    console.log(`   • Timeframes não lucrativos: ${unprofitableTimeframes.map(r => r.interval).join(', ')}`);
  }

  const avgPnl = results.reduce((sum, r) => sum + r.pnl, 0) / results.length;
  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
  const avgTrades = results.reduce((sum, r) => sum + r.trades, 0) / results.length;

  console.log(`\n📊 MÉDIAS:`);
  console.log(`   • P&L médio: $${formatCurrency(avgPnl)}`);
  console.log(`   • Win Rate médio: ${formatPercent(avgWinRate)}`);
  console.log(`   • Trades médio: ${avgTrades.toFixed(0)}`);

  console.log('\n' + '═'.repeat(120));
  console.log(`\n✅ Análise completa! Recomendação: usar timeframe ${bestByPnl.interval} para melhor P&L.`);

  process.exit(0);
}

runTimeframeComparison().catch(console.error);
