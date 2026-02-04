import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import { createBaseConfig, formatCurrency } from './shared-backtest-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');

interface StrategyResult {
  name: string;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  longPnl: number;
  shortPnl: number;
  longTrades: number;
  shortTrades: number;
}

const loadAllStrategies = (): string[] => {
  const files = fs.readdirSync(STRATEGIES_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
};

const testStrategy = async (strategyName: string): Promise<StrategyResult | null> => {
  try {
    const baseConfig = createBaseConfig();

    const watchers: WatcherConfig[] = SYMBOLS.map((symbol) => ({
      symbol,
      interval: '12h' as const,
      marketType: 'FUTURES' as const,
      setupTypes: [strategyName],
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
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter((t) => t.side === 'LONG');
    const shortTrades = result.trades.filter((t) => t.side === 'SHORT');
    const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);

    return {
      name: strategyName,
      totalPnl: result.metrics.totalPnl,
      totalPnlPercent: result.metrics.totalPnlPercent,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      profitFactor: result.metrics.profitFactor ?? 0,
      sharpeRatio: result.metrics.sharpeRatio ?? 0,
      longPnl,
      shortPnl,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
    };
  } catch (error) {
    console.error(`  ✗ Error testing ${strategyName}:`, error);
    return null;
  }
};

async function main() {
  console.log('═'.repeat(80));
  console.log('> TESTE DE TODAS AS 106 ESTRATÉGIAS');
  console.log('═'.repeat(80));
  console.log('');
  console.log('> CONFIGURAÇÃO:');
  console.log('   • Símbolos:', SYMBOLS.join(', '));
  console.log('   • Timeframe: 12h');
  console.log('   • Período: 2023-01-01 a 2026-01-31 (3 anos)');
  console.log('   • Entry Level: 100% (breakout)');
  console.log('   • BTC Correlation Filter: ON');
  console.log('   • Volume Filter: ON');
  console.log('   • Momentum Timing Filter: ON');
  console.log('');

  const strategies = loadAllStrategies();
  console.log(`> Total de estratégias: ${strategies.length}`);
  console.log('');

  const results: StrategyResult[] = [];
  let tested = 0;

  for (const strategy of strategies) {
    tested++;
    process.stdout.write(`\r> Testando ${tested}/${strategies.length}: ${strategy.padEnd(40)}`);

    const result = await testStrategy(strategy);
    if (result) {
      results.push(result);
    }
  }

  console.log('\n');

  const sortedByPnl = [...results].sort((a, b) => b.totalPnl - a.totalPnl);
  const profitable = sortedByPnl.filter((r) => r.totalPnl > 0);
  const unprofitable = sortedByPnl.filter((r) => r.totalPnl <= 0);

  console.log('═'.repeat(80));
  console.log(`> RESUMO: ${profitable.length} lucrativas | ${unprofitable.length} não lucrativas`);
  console.log('═'.repeat(80));
  console.log('');

  console.log('> TOP 20 ESTRATÉGIAS (por P&L):');
  console.log('─'.repeat(120));
  console.log(
    '| # | Estratégia                          | P&L       | P&L%    | Trades | WR     | PF    | DD     | Sharpe | LONG     | SHORT    |'
  );
  console.log('─'.repeat(120));

  sortedByPnl.slice(0, 20).forEach((r, i) => {
    const rank = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `${i + 1}`.padStart(2);
    console.log(
      `| ${rank} | ${r.name.slice(0, 35).padEnd(35)} | $${formatCurrency(r.totalPnl).padStart(8)} | ${r.totalPnlPercent.toFixed(1).padStart(6)}% | ${r.totalTrades.toString().padStart(6)} | ${r.winRate.toFixed(1).padStart(5)}% | ${r.profitFactor.toFixed(2).padStart(5)} | ${r.maxDrawdown.toFixed(1).padStart(5)}% | ${r.sharpeRatio.toFixed(2).padStart(6)} | $${formatCurrency(r.longPnl).padStart(7)} | $${formatCurrency(r.shortPnl).padStart(7)} |`
    );
  });

  console.log('─'.repeat(120));
  console.log('');

  console.log('✗ BOTTOM 10 ESTRATÉGIAS (piores P&L):');
  console.log('─'.repeat(100));

  sortedByPnl.slice(-10).reverse().forEach((r, i) => {
    console.log(
      `| ${(i + 1).toString().padStart(2)} | ${r.name.slice(0, 35).padEnd(35)} | $${formatCurrency(r.totalPnl).padStart(8)} | ${r.totalTrades.toString().padStart(4)} trades | WR ${r.winRate.toFixed(1)}% |`
    );
  });

  console.log('─'.repeat(100));
  console.log('');

  console.log('═'.repeat(80));
  console.log('> ESTRATÉGIAS RECOMENDADAS PARA PRODUÇÃO:');
  console.log('═'.repeat(80));
  console.log('');

  const recommended = sortedByPnl.filter(
    (r) => r.totalPnl > 100 && r.winRate > 50 && r.profitFactor > 1.5 && r.maxDrawdown < 40
  );

  if (recommended.length > 0) {
    console.log(`✓ ${recommended.length} estratégias passaram nos critérios:`);
    console.log('   (P&L > $100, WR > 50%, PF > 1.5, DD < 40%)');
    console.log('');
    recommended.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}`);
      console.log(`      P&L: $${formatCurrency(r.totalPnl)} | WR: ${r.winRate.toFixed(1)}% | PF: ${r.profitFactor.toFixed(2)} | DD: ${r.maxDrawdown.toFixed(1)}%`);
    });
  } else {
    console.log('!  Nenhuma estratégia passou em todos os critérios.');
    console.log('   Considere relaxar os critérios ou usar as top 5 por P&L.');
  }

  console.log('');

  const totalAggPnl = results.reduce((sum, r) => sum + r.totalPnl, 0);
  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
  const avgPF = results.filter((r) => r.profitFactor < Infinity).reduce((sum, r) => sum + r.profitFactor, 0) / results.length;

  console.log('═'.repeat(80));
  console.log('> ESTATÍSTICAS AGREGADAS:');
  console.log('═'.repeat(80));
  console.log(`   Total P&L (soma): $${formatCurrency(totalAggPnl)}`);
  console.log(`   Win Rate médio: ${avgWinRate.toFixed(1)}%`);
  console.log(`   Profit Factor médio: ${avgPF.toFixed(2)}`);
  console.log(`   Estratégias lucrativas: ${profitable.length}/${results.length} (${((profitable.length / results.length) * 100).toFixed(1)}%)`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
