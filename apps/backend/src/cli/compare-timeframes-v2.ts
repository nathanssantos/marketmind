import 'dotenv/config';
import * as fs from 'fs';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, TimeInterval } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig, formatCurrency } from './shared-backtest-config';

const LOCK_FILE = '/tmp/compare-timeframes-v2.lock';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const TIMEFRAMES: TimeInterval[] = ['30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      try {
        process.kill(parseInt(pid), 0);
        console.error(`✗ Outro processo já está rodando (PID: ${pid})`);
        console.error(`   Para forçar, delete: rm ${LOCK_FILE}`);
        return false;
      } catch {
        console.log(`!  Lock file órfão encontrado, removendo...`);
        fs.unlinkSync(LOCK_FILE);
      }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    return true;
  } catch (err) {
    console.error('Erro ao adquirir lock:', err);
    return false;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch { /* ignore */ }
}

process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(1); });
process.on('SIGTERM', () => { releaseLock(); process.exit(1); });

interface TimeframeResult {
  timeframe: string;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  longPnl: number;
  shortPnl: number;
}

async function testTimeframe(timeframe: TimeInterval): Promise<TimeframeResult> {
  const baseConfig = createBaseConfig();

  const watchers: WatcherConfig[] = SYMBOLS.map((symbol) => ({
    symbol,
    interval: timeframe,
    marketType: 'FUTURES' as const,
    setupTypes: [...ENABLED_SETUPS],
  }));

  const engine = new MultiWatcherBacktestEngine({
    ...baseConfig,
    watchers,
    startDate: '2023-01-01',
    endDate: '2026-01-31',
    maxFibonacciEntryProgressPercentLong: 100,
    maxFibonacciEntryProgressPercentShort: 100,
    minRiskRewardRatio: 0.75,
    useBtcCorrelationFilter: true,
    useVolumeFilter: true,
    useMomentumTimingFilter: true,
    useTrendFilter: false,
    useAdxFilter: false,
    silent: true,
  });

  const result = await engine.run();

  const longTrades = result.trades.filter((t) => t.side === 'LONG');
  const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
  const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
  const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);

  return {
    timeframe,
    totalPnl: result.metrics.totalPnl,
    totalPnlPercent: result.metrics.totalPnlPercent,
    totalTrades: result.metrics.totalTrades,
    winRate: result.metrics.winRate,
    maxDrawdown: result.metrics.maxDrawdownPercent,
    profitFactor: result.metrics.profitFactor ?? 0,
    sharpeRatio: result.metrics.sharpeRatio ?? 0,
    longPnl,
    shortPnl,
  };
}

async function main() {
  if (!acquireLock()) {
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('═'.repeat(80));
  console.log('# COMPARAÇÃO DE TIMEFRAMES - TOP 21 ESTRATÉGIAS');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`⏰ Iniciado: ${new Date().toISOString()}`);
  console.log(`> PID: ${process.pid}`);
  console.log('');
  console.log('> CONFIGURAÇÃO:');
  console.log('   • Símbolos:', SYMBOLS.join(', '));
  console.log('   • Timeframes:', TIMEFRAMES.join(', '));
  console.log('   • Estratégias:', ENABLED_SETUPS.length);
  console.log('   • Período: 2023-01-01 a 2026-01-31 (3 anos)');
  console.log('   • Entry Level: 100% (breakout)');
  console.log('   • Filtros: BTC Correlation + Volume + Momentum Timing');
  console.log('');
  console.log('> Estratégias habilitadas:');
  ENABLED_SETUPS.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
  console.log('');

  const results: TimeframeResult[] = [];

  for (let i = 0; i < TIMEFRAMES.length; i++) {
    const tf = TIMEFRAMES[i]!;
    const tfStart = Date.now();
    console.log(`\n> [${i + 1}/${TIMEFRAMES.length}] Testando timeframe: ${tf}...`);
    try {
      const result = await testTimeframe(tf);
      results.push(result);
      const tfElapsed = ((Date.now() - tfStart) / 1000).toFixed(1);
      console.log(`   ✓ ${tf}: P&L $${formatCurrency(result.totalPnl)} | ${result.totalTrades} trades | WR ${result.winRate.toFixed(1)}% | ⏱️ ${tfElapsed}s`);
    } catch (err) {
      console.error(`   ✗ Erro em ${tf}:`, err);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n⏱️ Tempo total: ${totalElapsed} minutos`);

  console.log('\n');
  console.log('═'.repeat(100));
  console.log('> RESULTADOS COMPARATIVOS (ordenado por P&L)');
  console.log('═'.repeat(100));
  console.log('');

  const sortedResults = [...results].sort((a, b) => b.totalPnl - a.totalPnl);

  console.log('| #  | Timeframe | P&L         | P&L%     | Trades | WinRate | PF    | MaxDD   | Sharpe | LONG P&L   | SHORT P&L  |');
  console.log('|----|-----------|-------------|----------|--------|---------|-------|---------|--------|------------|------------|');

  sortedResults.forEach((r, i) => {
    const rank = i === 0 ? '>' : `${i + 1}`.padStart(2);
    const pnlColor = r.totalPnl >= 0 ? '+' : '';
    console.log(
      `| ${rank} | ${r.timeframe.padEnd(9)} | ${pnlColor}$${formatCurrency(r.totalPnl).padStart(10)} | ${r.totalPnlPercent >= 0 ? '+' : ''}${r.totalPnlPercent.toFixed(1).padStart(6)}% | ${r.totalTrades.toString().padStart(6)} | ${r.winRate.toFixed(1).padStart(6)}% | ${r.profitFactor.toFixed(2).padStart(5)} | ${r.maxDrawdown.toFixed(1).padStart(6)}% | ${r.sharpeRatio.toFixed(2).padStart(6)} | $${formatCurrency(r.longPnl).padStart(9)} | $${formatCurrency(r.shortPnl).padStart(9)} |`
    );
  });

  console.log('');
  console.log('═'.repeat(100));
  console.log('> ANÁLISE');
  console.log('═'.repeat(100));
  console.log('');

  const profitable = sortedResults.filter((r) => r.totalPnl > 0);
  const best = sortedResults[0];

  if (profitable.length > 0 && best) {
    console.log(`✓ ${profitable.length}/${results.length} timeframes lucrativos`);
    console.log('');
    console.log('> MELHOR TIMEFRAME:', best.timeframe);
    console.log(`   P&L: $${formatCurrency(best.totalPnl)} (${best.totalPnlPercent.toFixed(1)}%)`);
    console.log(`   Trades: ${best.totalTrades}`);
    console.log(`   Win Rate: ${best.winRate.toFixed(1)}%`);
    console.log(`   Profit Factor: ${best.profitFactor.toFixed(2)}`);
    console.log(`   Max Drawdown: ${best.maxDrawdown.toFixed(1)}%`);
    console.log(`   Sharpe Ratio: ${best.sharpeRatio.toFixed(2)}`);
    console.log(`   LONG P&L: $${formatCurrency(best.longPnl)}`);
    console.log(`   SHORT P&L: $${formatCurrency(best.shortPnl)}`);
  } else {
    console.log('✗ Nenhum timeframe lucrativo');
  }

  console.log('');

  const shortPositive = sortedResults.filter((r) => r.shortPnl > 0);
  if (shortPositive.length > 0) {
    console.log('> Timeframes com SHORT lucrativo:');
    shortPositive.forEach((r) => console.log(`   • ${r.timeframe}: SHORT $${formatCurrency(r.shortPnl)}`));
  } else {
    console.log('!  Nenhum timeframe tem SHORT lucrativo - considerar LONG-only');
  }

  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
