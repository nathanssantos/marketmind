import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

async function validate() {
  console.log('═'.repeat(70));
  console.log('> VALIDAÇÃO DA CONFIGURAÇÃO OTIMIZADA');
  console.log('═'.repeat(70));
  console.log('');
  console.log('> CONFIGURAÇÃO:');
  console.log('   • Entry Level Fibo: 100% (breakout)');
  console.log('   • BTC Correlation Filter: HABILITADO');
  console.log('   • Volume Filter: HABILITADO');
  console.log('   • Momentum Timing Filter: HABILITADO');
  console.log('   • EMA Trend Filter: DESABILITADO');
  console.log('   • ADX Filter: DESABILITADO');
  console.log('   • Timeframe: 12h');
  console.log('   • Período: 2023-01-01 a 2026-01-31 (3 anos)');
  console.log('   • Símbolos:', SYMBOLS.join(', '));
  console.log('');

  const baseConfig = createBaseConfig();

  const watchers: WatcherConfig[] = SYMBOLS.map((symbol) => ({
    symbol,
    interval: '12h' as const,
    marketType: 'FUTURES' as const,
    setupTypes: [...ENABLED_SETUPS],
  }));

  const engine = new MultiWatcherBacktestEngine({
    ...baseConfig,
    watchers,
    startDate: '2023-01-01',
    endDate: '2026-01-31',
    maxFibonacciEntryProgressPercent: 100,
    minRiskRewardRatio: 0.75,
    useBtcCorrelationFilter: true,
    useVolumeFilter: true,
    useMomentumTimingFilter: true,
    useTrendFilter: false,
    useAdxFilter: false,
    useMarketRegimeFilter: false,
    silent: true,
  });

  console.log('> Iniciando backtest...\n');
  const startTime = Date.now();

  const result = await engine.run();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const longTrades = result.trades.filter((t) => t.side === 'LONG');
  const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
  const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
  const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
  const longWins = longTrades.filter((t) => (t.netPnl || 0) > 0).length;
  const shortWins = shortTrades.filter((t) => (t.netPnl || 0) > 0).length;

  console.log('═'.repeat(70));
  console.log('> RESULTADOS');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`⏱️  Tempo de execução: ${elapsed}s`);
  console.log('');
  console.log('━'.repeat(70));
  console.log('MÉTRICAS GERAIS');
  console.log('━'.repeat(70));
  console.log(`Total Trades:     ${result.metrics.totalTrades}`);
  console.log(`Total P&L:        $${result.metrics.totalPnl.toFixed(2)} (${result.metrics.totalPnlPercent.toFixed(1)}%)`);
  console.log(`Win Rate:         ${result.metrics.winRate.toFixed(1)}%`);
  console.log(`Max Drawdown:     ${result.metrics.maxDrawdownPercent.toFixed(1)}%`);
  console.log(`Profit Factor:    ${(result.metrics.profitFactor ?? 0).toFixed(2)}`);
  console.log(`Avg Win:          $${result.metrics.avgWin.toFixed(2)}`);
  console.log(`Avg Loss:         $${result.metrics.avgLoss.toFixed(2)}`);
  console.log(`Largest Win:      $${result.metrics.largestWin.toFixed(2)}`);
  console.log(`Largest Loss:     $${result.metrics.largestLoss.toFixed(2)}`);
  console.log('');
  console.log('━'.repeat(70));
  console.log('POR DIREÇÃO');
  console.log('━'.repeat(70));
  console.log(`LONG:  ${longTrades.length} trades | P&L: $${longPnl.toFixed(2)} | WR: ${longTrades.length > 0 ? ((longWins / longTrades.length) * 100).toFixed(1) : 0}%`);
  console.log(`SHORT: ${shortTrades.length} trades | P&L: $${shortPnl.toFixed(2)} | WR: ${shortTrades.length > 0 ? ((shortWins / shortTrades.length) * 100).toFixed(1) : 0}%`);
  console.log('');
  console.log('━'.repeat(70));
  console.log('POR SÍMBOLO');
  console.log('━'.repeat(70));

  for (const ws of result.watcherStats) {
    const blockedReasons = Object.entries(ws.skippedReasons)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    console.log(`${ws.symbol.padEnd(10)} | Trades: ${ws.tradesExecuted.toString().padStart(2)} | Setups: ${ws.totalSetups.toString().padStart(5)} | Bloqueados: ${ws.tradesSkipped.toString().padStart(5)} | Top: ${blockedReasons}`);
  }

  console.log('');
  console.log('━'.repeat(70));
  console.log('FILTROS APLICADOS');
  console.log('━'.repeat(70));

  let totalBlocked = 0;
  const blockReasons: Record<string, number> = {};

  for (const ws of result.watcherStats) {
    totalBlocked += ws.tradesSkipped;
    for (const [reason, count] of Object.entries(ws.skippedReasons)) {
      blockReasons[reason] = (blockReasons[reason] || 0) + (count as number);
    }
  }

  const sortedReasons = Object.entries(blockReasons).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons) {
    const pct = ((count / totalBlocked) * 100).toFixed(1);
    console.log(`${reason.padEnd(20)} ${count.toString().padStart(6)} (${pct}%)`);
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('✓ VALIDAÇÃO CONCLUÍDA');
  console.log('═'.repeat(70));

  const pnlTarget = 4500;
  const ddTarget = 25;
  const wrTarget = 60;

  const pnlOk = result.metrics.totalPnl >= pnlTarget;
  const ddOk = result.metrics.maxDrawdownPercent <= ddTarget;
  const wrOk = result.metrics.winRate >= wrTarget;

  console.log('');
  console.log('TARGETS:');
  console.log(`  P&L >= $${pnlTarget}:     ${pnlOk ? '✓ PASS' : '✗ FAIL'} ($${result.metrics.totalPnl.toFixed(0)})`);
  console.log(`  DD <= ${ddTarget}%:       ${ddOk ? '✓ PASS' : '✗ FAIL'} (${result.metrics.maxDrawdownPercent.toFixed(1)}%)`);
  console.log(`  WR >= ${wrTarget}%:       ${wrOk ? '✓ PASS' : '✗ FAIL'} (${result.metrics.winRate.toFixed(1)}%)`);
  console.log('');

  if (pnlOk && ddOk && wrOk) {
    console.log('✓ CONFIGURAÇÃO VALIDADA COM SUCESSO!');
  } else {
    console.log('!  Alguns targets não foram atingidos. Revisar configuração.');
  }

  process.exit(0);
}

validate().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
