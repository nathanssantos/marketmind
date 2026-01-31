import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

interface TestResult {
  name: string;
  onlyLong: boolean;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  longPnl: number;
  shortPnl: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
}

async function compare() {
  console.log('=== COMPARAÇÃO: LONG-ONLY vs LONG+SHORT ===');
  console.log('Entry Level: 100% | Timeframe: 12h | Período: 2023-2026');
  console.log('Símbolos:', SYMBOLS.join(', '));
  console.log('BTC Correlation Filter: HABILITADO');
  console.log('');

  const results: TestResult[] = [];

  for (const onlyLong of [false, true]) {
    const modeName = onlyLong ? 'LONG-ONLY' : 'LONG + SHORT';
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 Testando: ${modeName}`);
    console.log(`${'═'.repeat(60)}\n`);

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
      onlyLong,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter((t) => t.side === 'LONG');
    const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
    const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const longWins = longTrades.filter((t) => (t.netPnl || 0) > 0).length;
    const shortWins = shortTrades.filter((t) => (t.netPnl || 0) > 0).length;

    results.push({
      name: modeName,
      onlyLong,
      totalPnl: result.metrics.totalPnl,
      totalPnlPercent: result.metrics.totalPnlPercent,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl,
      shortPnl,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWinRate: longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0,
      shortWinRate: shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0,
    });

    console.log('━'.repeat(60));
    console.log(`📊 ${modeName}`);
    console.log('━'.repeat(60));
    console.log('');
    console.log('Total Trades:', result.metrics.totalTrades);
    console.log(
      'Total P&L: $' + result.metrics.totalPnl.toFixed(2),
      '(' + result.metrics.totalPnlPercent.toFixed(1) + '%)'
    );
    console.log('Win Rate:', result.metrics.winRate.toFixed(1) + '%');
    console.log('Max Drawdown:', result.metrics.maxDrawdownPercent.toFixed(1) + '%');
    console.log('Profit Factor:', (result.metrics.profitFactor ?? 0).toFixed(2));
    console.log('Sharpe Ratio:', (result.metrics.sharpeRatio ?? 0).toFixed(3));
    console.log('');
    const currentResult = results[results.length - 1];
    console.log(
      `LONG:  ${longTrades.length} trades | P&L: $${longPnl.toFixed(2)} | WR: ${currentResult?.longWinRate.toFixed(1) ?? 0}%`
    );
    console.log(
      `SHORT: ${shortTrades.length} trades | P&L: $${shortPnl.toFixed(2)} | WR: ${currentResult?.shortWinRate.toFixed(1) ?? 0}%`
    );
    console.log('');

    console.log('📈 Por Símbolo:');
    for (const ws of result.watcherStats) {
      console.log(
        `  ${ws.symbol}: ${ws.tradesExecuted} trades | Setups: ${ws.totalSetups} | Bloqueados: ${ws.tradesSkipped}`
      );
    }
    console.log('');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMO COMPARATIVO');
  console.log('═'.repeat(60));
  console.log('');

  const longShort = results.find((r) => !r.onlyLong)!;
  const longOnly = results.find((r) => r.onlyLong)!;

  console.log('| Métrica              | LONG+SHORT    | LONG-ONLY     | Diferença     |');
  console.log('|----------------------|---------------|---------------|---------------|');
  console.log(
    `| Total Trades         | ${longShort.totalTrades.toString().padEnd(13)} | ${longOnly.totalTrades.toString().padEnd(13)} | ${(longOnly.totalTrades - longShort.totalTrades).toString().padEnd(13)} |`
  );
  console.log(
    `| Total P&L            | $${longShort.totalPnl.toFixed(2).padEnd(12)} | $${longOnly.totalPnl.toFixed(2).padEnd(12)} | $${(longOnly.totalPnl - longShort.totalPnl).toFixed(2).padEnd(12)} |`
  );
  console.log(
    `| P&L %                | ${longShort.totalPnlPercent.toFixed(1).padEnd(12)}% | ${longOnly.totalPnlPercent.toFixed(1).padEnd(12)}% | ${(longOnly.totalPnlPercent - longShort.totalPnlPercent).toFixed(1).padEnd(12)}% |`
  );
  console.log(
    `| Win Rate             | ${longShort.winRate.toFixed(1).padEnd(12)}% | ${longOnly.winRate.toFixed(1).padEnd(12)}% | ${(longOnly.winRate - longShort.winRate).toFixed(1).padEnd(12)}% |`
  );
  console.log(
    `| Max Drawdown         | ${longShort.maxDrawdown.toFixed(1).padEnd(12)}% | ${longOnly.maxDrawdown.toFixed(1).padEnd(12)}% | ${(longOnly.maxDrawdown - longShort.maxDrawdown).toFixed(1).padEnd(12)}% |`
  );
  console.log(
    `| LONG Trades          | ${longShort.longTrades.toString().padEnd(13)} | ${longOnly.longTrades.toString().padEnd(13)} | ${(longOnly.longTrades - longShort.longTrades).toString().padEnd(13)} |`
  );
  console.log(
    `| SHORT Trades         | ${longShort.shortTrades.toString().padEnd(13)} | ${longOnly.shortTrades.toString().padEnd(13)} | ${(longOnly.shortTrades - longShort.shortTrades).toString().padEnd(13)} |`
  );
  console.log(
    `| SHORT P&L            | $${longShort.shortPnl.toFixed(2).padEnd(12)} | $${longOnly.shortPnl.toFixed(2).padEnd(12)} | $${(longOnly.shortPnl - longShort.shortPnl).toFixed(2).padEnd(12)} |`
  );
  console.log('');

  const pnlDiff = longOnly.totalPnl - longShort.totalPnl;
  const ddDiff = longOnly.maxDrawdown - longShort.maxDrawdown;

  if (pnlDiff > 0 && ddDiff <= 0) {
    console.log('🏆 RECOMENDAÇÃO: USAR LONG-ONLY MODE');
    console.log(`   Melhoria de P&L: +$${pnlDiff.toFixed(2)}`);
    console.log(`   Melhoria de Drawdown: ${Math.abs(ddDiff).toFixed(1)}%`);
  } else if (pnlDiff < 0 && longShort.shortPnl > 0) {
    console.log('🏆 RECOMENDAÇÃO: MANTER LONG+SHORT');
    console.log(`   SHORTs contribuem: +$${longShort.shortPnl.toFixed(2)}`);
    console.log(`   Win Rate SHORT: ${longShort.shortWinRate.toFixed(1)}%`);
  } else if (pnlDiff > 0) {
    console.log('🏆 RECOMENDAÇÃO: USAR LONG-ONLY MODE');
    console.log(`   Melhoria de P&L: +$${pnlDiff.toFixed(2)}`);
    if (ddDiff > 0) console.log(`   ⚠️ Drawdown aumenta: +${ddDiff.toFixed(1)}%`);
  } else {
    console.log('🟡 INCONCLUSIVO: Analisar trade-offs');
    console.log(`   LONG+SHORT P&L: $${longShort.totalPnl.toFixed(2)}`);
    console.log(`   LONG-ONLY P&L: $${longOnly.totalPnl.toFixed(2)}`);
  }

  process.exit(0);
}

compare().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
