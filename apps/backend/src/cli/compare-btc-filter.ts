import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const ALTCOINS = ['ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];

interface TestResult {
  name: string;
  useBtcFilter: boolean;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  longPnl: number;
  shortPnl: number;
  longTrades: number;
  shortTrades: number;
  blockedByBtcTrend: number;
}

async function compare() {
  console.log('=== COMPARAÇÃO: COM vs SEM BTC CORRELATION FILTER (ALTCOINS) ===');
  console.log('Entry Level: 100% | Timeframe: 12h | Período: 2023-2026');
  console.log('Altcoins:', ALTCOINS.join(', '));
  console.log('');

  const results: TestResult[] = [];

  for (const useBtcFilter of [true, false]) {
    const filterName = useBtcFilter ? 'COM BTC Filter' : 'SEM BTC Filter';
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`> Testando: ${filterName}`);
    console.log(`${'═'.repeat(60)}\n`);

    const baseConfig = createBaseConfig();

    const watchers: WatcherConfig[] = ALTCOINS.map((symbol) => ({
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
      maxFibonacciEntryProgressPercentLong: 100,
      maxFibonacciEntryProgressPercentShort: 100,
      minRiskRewardRatio: 0.75,
      useBtcCorrelationFilter: useBtcFilter,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter((t) => t.side === 'LONG');
    const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
    const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);

    let blockedByBtcTrend = 0;
    for (const ws of result.watcherStats) {
      blockedByBtcTrend += (ws.skippedReasons['btcTrend'] as number) || 0;
    }

    results.push({
      name: filterName,
      useBtcFilter,
      totalPnl: result.metrics.totalPnl,
      totalPnlPercent: result.metrics.totalPnlPercent,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl,
      shortPnl,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      blockedByBtcTrend,
    });

    console.log('━'.repeat(60));
    console.log(`> ${  filterName.toUpperCase()}`);
    console.log('━'.repeat(60));
    console.log('');
    console.log('Total Trades:', result.metrics.totalTrades);
    console.log(
      `Total P&L: $${  result.metrics.totalPnl.toFixed(2)}`,
      `(${  result.metrics.totalPnlPercent.toFixed(1)  }%)`
    );
    console.log('Win Rate:', `${result.metrics.winRate.toFixed(1)  }%`);
    console.log('Max Drawdown:', `${result.metrics.maxDrawdownPercent.toFixed(1)  }%`);
    console.log('');
    console.log(`LONG:  ${longTrades.length} trades | P&L: $${longPnl.toFixed(2)}`);
    console.log(`SHORT: ${shortTrades.length} trades | P&L: $${shortPnl.toFixed(2)}`);
    console.log('');
    console.log(`Bloqueados por BTC Trend: ${blockedByBtcTrend}`);

    console.log('\n> Por Símbolo:');
    for (const ws of result.watcherStats) {
      console.log(
        `  ${ws.symbol}: ${ws.tradesExecuted} trades | Setups: ${ws.totalSetups} | Bloqueados: ${ws.tradesSkipped}`
      );
    }
    console.log('');
  }

  console.log(`\n${  '═'.repeat(60)}`);
  console.log('> RESUMO COMPARATIVO');
  console.log('═'.repeat(60));
  console.log('');

  const comFilter = results.find((r) => r.useBtcFilter)!;
  const semFilter = results.find((r) => !r.useBtcFilter)!;

  console.log('| Métrica              | COM Filter    | SEM Filter    | Diferença     |');
  console.log('|----------------------|---------------|---------------|---------------|');
  console.log(
    `| Total Trades         | ${comFilter.totalTrades.toString().padEnd(13)} | ${semFilter.totalTrades.toString().padEnd(13)} | ${(semFilter.totalTrades - comFilter.totalTrades).toString().padEnd(13)} |`
  );
  console.log(
    `| Total P&L            | $${comFilter.totalPnl.toFixed(2).padEnd(12)} | $${semFilter.totalPnl.toFixed(2).padEnd(12)} | $${(semFilter.totalPnl - comFilter.totalPnl).toFixed(2).padEnd(12)} |`
  );
  console.log(
    `| P&L %                | ${comFilter.totalPnlPercent.toFixed(1).padEnd(13)}% | ${semFilter.totalPnlPercent.toFixed(1).padEnd(13)}% | ${(semFilter.totalPnlPercent - comFilter.totalPnlPercent).toFixed(1).padEnd(13)}% |`
  );
  console.log(
    `| Win Rate             | ${comFilter.winRate.toFixed(1).padEnd(13)}% | ${semFilter.winRate.toFixed(1).padEnd(13)}% | ${(semFilter.winRate - comFilter.winRate).toFixed(1).padEnd(13)}% |`
  );
  console.log(
    `| Max Drawdown         | ${comFilter.maxDrawdown.toFixed(1).padEnd(13)}% | ${semFilter.maxDrawdown.toFixed(1).padEnd(13)}% | ${(semFilter.maxDrawdown - comFilter.maxDrawdown).toFixed(1).padEnd(13)}% |`
  );
  console.log(
    `| Bloqueados BTC Trend | ${comFilter.blockedByBtcTrend.toString().padEnd(13)} | ${semFilter.blockedByBtcTrend.toString().padEnd(13)} | ${(semFilter.blockedByBtcTrend - comFilter.blockedByBtcTrend).toString().padEnd(13)} |`
  );
  console.log('');

  const pnlDiff = semFilter.totalPnl - comFilter.totalPnl;
  const wrDiff = semFilter.winRate - comFilter.winRate;

  if (pnlDiff > 0 && wrDiff >= 0) {
    console.log('> RECOMENDAÇÃO: DESABILITAR BTC Correlation Filter');
    console.log(`   Melhoria de P&L: +$${pnlDiff.toFixed(2)} (+${(semFilter.totalPnlPercent - comFilter.totalPnlPercent).toFixed(1)}%)`);
  } else if (pnlDiff < 0) {
    console.log('> RECOMENDAÇÃO: MANTER BTC Correlation Filter');
    console.log(`   Proteção de P&L: $${Math.abs(pnlDiff).toFixed(2)}`);
  } else {
    console.log('~ INCONCLUSIVO: Diferença mínima - testar com mais dados');
  }

  process.exit(0);
}

compare().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
