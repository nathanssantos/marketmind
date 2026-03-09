import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

interface FilterConfig {
  name: string;
  useTrendFilter: boolean;
  useAdxFilter: boolean;
  useMomentumTimingFilter: boolean;
  useMarketRegimeFilter: boolean;
}

const FILTER_CONFIGS: FilterConfig[] = [
  {
    name: 'NENHUM (Baseline)',
    useTrendFilter: false,
    useAdxFilter: false,
    useMomentumTimingFilter: false,
    useMarketRegimeFilter: false,
  },
  {
    name: 'EMA Trend Only',
    useTrendFilter: true,
    useAdxFilter: false,
    useMomentumTimingFilter: false,
    useMarketRegimeFilter: false,
  },
  {
    name: 'ADX Only',
    useTrendFilter: false,
    useAdxFilter: true,
    useMomentumTimingFilter: false,
    useMarketRegimeFilter: false,
  },
  {
    name: 'Momentum Timing Only',
    useTrendFilter: false,
    useAdxFilter: false,
    useMomentumTimingFilter: true,
    useMarketRegimeFilter: false,
  },
  {
    name: 'Market Regime Only',
    useTrendFilter: false,
    useAdxFilter: false,
    useMomentumTimingFilter: false,
    useMarketRegimeFilter: true,
  },
  {
    name: 'EMA + ADX',
    useTrendFilter: true,
    useAdxFilter: true,
    useMomentumTimingFilter: false,
    useMarketRegimeFilter: false,
  },
  {
    name: 'EMA + Momentum',
    useTrendFilter: true,
    useAdxFilter: false,
    useMomentumTimingFilter: true,
    useMarketRegimeFilter: false,
  },
  {
    name: 'TODOS (EMA+ADX+Momentum+Regime)',
    useTrendFilter: true,
    useAdxFilter: true,
    useMomentumTimingFilter: true,
    useMarketRegimeFilter: true,
  },
];

interface TestResult {
  name: string;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  longPnl: number;
  shortPnl: number;
  blockedByTrend: number;
  blockedByAdx: number;
  blockedByMomentum: number;
  blockedByRegime: number;
}

async function compare() {
  console.log('=== COMPARAÇÃO: TREND FILTERS ===');
  console.log('Entry Level: 100% | Timeframe: 12h | Período: 2023-2026');
  console.log('Símbolos:', SYMBOLS.join(', '));
  console.log('BTC Correlation Filter: HABILITADO (sempre)');
  console.log('Volume Filter: HABILITADO (sempre)');
  console.log('');

  const results: TestResult[] = [];

  for (const filterCfg of FILTER_CONFIGS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`> Testando: ${filterCfg.name}`);
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
      maxFibonacciEntryProgressPercentLong: 100,
      maxFibonacciEntryProgressPercentShort: 100,
      minRiskRewardRatio: 0.75,
      useBtcCorrelationFilter: true,
      useVolumeFilter: true,
      useTrendFilter: filterCfg.useTrendFilter,
      useAdxFilter: filterCfg.useAdxFilter,
      useMomentumTimingFilter: filterCfg.useMomentumTimingFilter,
      useMarketRegimeFilter: filterCfg.useMarketRegimeFilter,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter((t) => t.side === 'LONG');
    const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
    const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);

    let blockedByTrend = 0;
    let blockedByAdx = 0;
    let blockedByMomentum = 0;
    let blockedByRegime = 0;

    for (const ws of result.watcherStats) {
      blockedByTrend += (ws.skippedReasons['trend'] as number) || 0;
      blockedByAdx += (ws.skippedReasons['adx'] as number) || 0;
      blockedByMomentum += (ws.skippedReasons['momentumTiming'] as number) || 0;
      blockedByRegime += (ws.skippedReasons['marketRegime'] as number) || 0;
    }

    results.push({
      name: filterCfg.name,
      totalPnl: result.metrics.totalPnl,
      totalPnlPercent: result.metrics.totalPnlPercent,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      profitFactor: result.metrics.profitFactor ?? 0,
      longPnl,
      shortPnl,
      blockedByTrend,
      blockedByAdx,
      blockedByMomentum,
      blockedByRegime,
    });

    console.log('━'.repeat(60));
    console.log(`> ${filterCfg.name}`);
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
    console.log('');
    console.log(`LONG:  ${longTrades.length} trades | P&L: $${longPnl.toFixed(2)}`);
    console.log(`SHORT: ${shortTrades.length} trades | P&L: $${shortPnl.toFixed(2)}`);
    console.log('');
    console.log(`Bloqueados - Trend: ${blockedByTrend} | ADX: ${blockedByAdx} | Momentum: ${blockedByMomentum} | Regime: ${blockedByRegime}`);
    console.log('');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('> RESUMO COMPARATIVO (ordenado por P&L)');
  console.log('═'.repeat(80));
  console.log('');

  const sortedResults = [...results].sort((a, b) => b.totalPnl - a.totalPnl);

  console.log('| # | Filter                         | P&L        | P&L%    | WR     | DD     | PF    | Trades |');
  console.log('|---|--------------------------------|------------|---------|--------|--------|-------|--------|');

  sortedResults.forEach((r, i) => {
    const rank = i === 0 ? '>' : `${i + 1}`;
    console.log(
      `| ${rank.padEnd(2)}| ${r.name.padEnd(30)} | $${r.totalPnl.toFixed(0).padStart(9)} | ${r.totalPnlPercent.toFixed(1).padStart(6)}% | ${r.winRate.toFixed(1).padStart(5)}% | ${r.maxDrawdown.toFixed(1).padStart(5)}% | ${r.profitFactor.toFixed(2).padStart(5)} | ${r.totalTrades.toString().padStart(6)} |`
    );
  });

  console.log('');
  console.log('═'.repeat(80));
  console.log('> ANÁLISE');
  console.log('═'.repeat(80));
  console.log('');

  const baseline = results.find((r) => r.name.includes('Baseline'));
  const best = sortedResults[0];

  if (!baseline || !best) {
    console.log('✗ Erro: baseline ou best não encontrado');
  } else if (best.name !== baseline.name) {
    const improvement = best.totalPnl - baseline.totalPnl;
    const improvementPct = ((improvement / baseline.totalPnl) * 100).toFixed(1);
    console.log(`> MELHOR FILTER: ${best.name}`);
    console.log(`   P&L: $${best.totalPnl.toFixed(2)} (+$${improvement.toFixed(2)} vs baseline, +${improvementPct}%)`);
    console.log(`   Win Rate: ${best.winRate.toFixed(1)}%`);
    console.log(`   Max Drawdown: ${best.maxDrawdown.toFixed(1)}%`);
    console.log(`   Profit Factor: ${best.profitFactor.toFixed(2)}`);
  } else {
    console.log('~ Nenhum filter superou o baseline significativamente');
  }

  console.log('');
  console.log('> RECOMENDAÇÕES:');

  const emaOnly = results.find((r) => r.name === 'EMA Trend Only');
  const adxOnly = results.find((r) => r.name === 'ADX Only');
  const momentumOnly = results.find((r) => r.name === 'Momentum Timing Only');

  if (emaOnly && adxOnly) {
    if (emaOnly.totalPnl > adxOnly.totalPnl) {
      console.log(`   - EMA Trend ($${emaOnly.totalPnl.toFixed(0)}) > ADX ($${adxOnly.totalPnl.toFixed(0)})`);
    } else {
      console.log(`   - ADX ($${adxOnly.totalPnl.toFixed(0)}) > EMA Trend ($${emaOnly.totalPnl.toFixed(0)})`);
    }
  }

  if (momentumOnly && emaOnly) {
    if (momentumOnly.totalPnl > emaOnly.totalPnl) {
      console.log(`   - Momentum Timing ($${momentumOnly.totalPnl.toFixed(0)}) supera EMA Trend`);
    }
  }

  const todos = results.find((r) => r.name.includes('TODOS'));
  if (todos && best && best.name !== todos.name) {
    console.log(`   - ! Combinar TODOS os filtros NÃO é a melhor opção (P&L: $${todos.totalPnl.toFixed(0)})`);
  }

  process.exit(0);
}

compare().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
