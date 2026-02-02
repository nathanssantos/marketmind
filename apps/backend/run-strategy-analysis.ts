#!/usr/bin/env tsx

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db';
import { activeWatchers, klines } from './src/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { BacktestEngine } from './src/services/backtesting/BacktestEngine';
import { smartBackfillKlines } from './src/services/binance-historical';
import type { Interval, BacktestConfig, BacktestResult } from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRATEGIES_DIR = './strategies/builtin';
const DATE_STR = new Date().toISOString().split('T')[0];
const RESULTS_DIR = `./results/strategy-analysis-${DATE_STR}`;
const DOCS_DIR = path.resolve(__dirname, '../../docs');
const TIMEFRAMES: Interval[] = ['4h', '6h', '8h', '12h', '1d'];
const INITIAL_CAPITAL = 1000;
const LEVERAGE = 1;

const TWO_YEARS_AGO = new Date();
TWO_YEARS_AGO.setFullYear(TWO_YEARS_AGO.getFullYear() - 2);
const START_DATE = TWO_YEARS_AGO.toISOString().split('T')[0]!;
const END_DATE = new Date().toISOString().split('T')[0]!;

interface StrategyResult {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
  totalPnlPercent: number;
  avgPnlPercent: number;
  symbolResults: SymbolResult[];
}

interface SymbolResult {
  symbol: string;
  interval: string;
  trades: number;
  winRate: number;
  pnlPercent: number;
  profitFactor: number;
}

async function getActiveFuturesSymbols(): Promise<string[]> {
  const watchers = await db
    .select({ symbol: activeWatchers.symbol })
    .from(activeWatchers)
    .where(eq(activeWatchers.marketType, 'FUTURES'));

  const uniqueSymbols = [...new Set(watchers.map(w => w.symbol))];
  console.log(chalk.cyan(`Found ${uniqueSymbols.length} unique FUT symbols with active watchers`));
  return uniqueSymbols;
}

async function getAllStrategies(): Promise<{ id: string; name: string }[]> {
  const strategyFiles = fs.readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json'));
  const strategies: { id: string; name: string }[] = [];

  for (const file of strategyFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(STRATEGIES_DIR, file), 'utf-8'));
      strategies.push({ id: content.id, name: content.name });
    } catch (error) {
      console.error(chalk.red(`Error reading strategy file ${file}:`, error));
    }
  }

  console.log(chalk.cyan(`Found ${strategies.length} strategies to test`));
  return strategies;
}

async function backfillSymbol(symbol: string, interval: Interval): Promise<void> {
  console.log(chalk.gray(`  Backfilling ${symbol} ${interval}...`));
  const twoYearsInBars = Math.ceil((Date.now() - TWO_YEARS_AGO.getTime()) / getIntervalMs(interval));
  await smartBackfillKlines(symbol, interval, twoYearsInBars + 300, 'FUTURES');
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '6h': 21600000,
    '8h': 28800000,
    '12h': 43200000,
    '1d': 86400000,
  };
  return map[interval] || 14400000;
}

async function runBacktest(
  symbol: string,
  interval: Interval,
  strategyId: string
): Promise<BacktestResult | null> {
  const config: BacktestConfig = {
    symbol,
    interval,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL,
    setupTypes: [strategyId],
    marketType: 'FUTURES',
    leverage: 1,
    useStochasticFilter: false,
    useMomentumTimingFilter: true,
    useAdxFilter: false,
    useTrendFilter: false,
    useMtfFilter: true,
    useBtcCorrelationFilter: true,
    useMarketRegimeFilter: true,
    useVolumeFilter: false,
    useFundingFilter: true,
    useConfluenceScoring: true,
    confluenceMinScore: 60,
    positionSizePercent: 10,
    tpCalculationMode: 'fibonacci',
    fibonacciTargetLevel: 'auto',
    useAlgorithmicLevels: true,
    onlyWithTrend: false,
    minRiskRewardRatio: 1.2,
  };

  try {
    const engine = new BacktestEngine();
    return await engine.run(config);
  } catch (error) {
    console.error(chalk.red(`    Error running backtest for ${symbol} ${interval} ${strategyId}:`, error));
    return null;
  }
}

async function analyzeStrategy(
  strategy: { id: string; name: string },
  symbols: string[],
  strategyIndex: number,
  totalStrategies: number
): Promise<StrategyResult> {
  console.log(chalk.cyan(`\n[${strategyIndex + 1}/${totalStrategies}] Analyzing: ${strategy.name} (${strategy.id})`));

  const symbolResults: SymbolResult[] = [];
  let totalTrades = 0;
  let totalWins = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let allPnlPercents: number[] = [];

  for (const symbol of symbols) {
    for (const interval of TIMEFRAMES) {
      process.stdout.write(chalk.gray(`  Testing ${symbol} ${interval}... `));

      const result = await runBacktest(symbol, interval, strategy.id);

      if (result && result.trades.length > 0) {
        const { metrics } = result;
        symbolResults.push({
          symbol,
          interval,
          trades: metrics.totalTrades,
          winRate: metrics.winRate,
          pnlPercent: metrics.totalPnlPercent,
          profitFactor: metrics.profitFactor,
        });

        totalTrades += metrics.totalTrades;
        totalWins += metrics.winningTrades;
        totalGrossProfit += metrics.avgWin * metrics.winningTrades;
        totalGrossLoss += Math.abs(metrics.avgLoss) * metrics.losingTrades;
        allPnlPercents.push(metrics.totalPnlPercent);

        console.log(chalk.green(`${metrics.totalTrades} trades, ${metrics.winRate.toFixed(1)}% WR, ${metrics.totalPnlPercent.toFixed(2)}% PnL`));
      } else {
        console.log(chalk.yellow('No trades'));
      }
    }
  }

  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0;
  const totalPnlPercent = allPnlPercents.reduce((sum, p) => sum + p, 0);
  const avgPnlPercent = allPnlPercents.length > 0 ? totalPnlPercent / allPnlPercents.length : 0;

  let sharpeRatio = 0;
  if (allPnlPercents.length > 1) {
    const mean = avgPnlPercent;
    const variance = allPnlPercents.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (allPnlPercents.length - 1);
    const stdDev = Math.sqrt(variance);
    sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
  }

  const maxDrawdownPercent = symbolResults.length > 0
    ? Math.max(...symbolResults.map(r => Math.abs(Math.min(0, r.pnlPercent))))
    : 0;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    totalTrades,
    winRate,
    profitFactor,
    sharpeRatio,
    maxDrawdownPercent,
    totalPnlPercent,
    avgPnlPercent,
    symbolResults,
  };
}

function printRankingTable(results: StrategyResult[]): void {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                                    STRATEGY RANKING                                                  ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white('Rank │ Strategy                         │ Trades │ Win Rate │  PF   │ Sharpe │ Max DD │ Total PnL%'));
  console.log(chalk.gray('─────┼──────────────────────────────────┼────────┼──────────┼───────┼────────┼────────┼───────────'));

  results.slice(0, 30).forEach((r, i) => {
    const rank = String(i + 1).padStart(3);
    const name = r.strategyName.substring(0, 32).padEnd(32);
    const trades = String(r.totalTrades).padStart(6);
    const winRate = `${r.winRate.toFixed(1)}%`.padStart(8);
    const pf = r.profitFactor === Infinity ? '  Inf' : r.profitFactor.toFixed(2).padStart(5);
    const sharpe = r.sharpeRatio.toFixed(2).padStart(6);
    const maxDD = `${r.maxDrawdownPercent.toFixed(1)}%`.padStart(6);
    const totalPnl = `${r.totalPnlPercent >= 0 ? '+' : ''}${r.totalPnlPercent.toFixed(2)}%`.padStart(10);

    const color = r.totalPnlPercent > 0 ? chalk.green : r.totalPnlPercent < 0 ? chalk.red : chalk.white;
    console.log(color(`${rank}  │ ${name} │ ${trades} │ ${winRate} │ ${pf} │ ${sharpe} │ ${maxDD} │ ${totalPnl}`));
  });
}

function generateMarkdownReport(
  results: StrategyResult[],
  profitable: StrategyResult[],
  symbols: string[],
  startDate: string,
  endDate: string
): string {
  let md = `# Strategy Analysis Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## Test Configuration\n\n`;
  md += `| Parameter | Value |\n`;
  md += `|-----------|-------|\n`;
  md += `| Period | ${startDate} to ${endDate} |\n`;
  md += `| Timeframes | ${TIMEFRAMES.join(', ')} |\n`;
  md += `| Initial Capital | $${INITIAL_CAPITAL} |\n`;
  md += `| Leverage | 1x |\n`;
  md += `| Market Type | FUTURES |\n`;
  md += `| Symbols Tested | ${symbols.length} |\n`;
  md += `| Strategies Tested | ${results.length} |\n\n`;

  md += `## Active Filters & Settings\n\n`;
  md += `These settings match the **auto-trading configuration** exactly:\n\n`;
  md += `| Filter/Setting | Status |\n`;
  md += `|----------------|--------|\n`;
  md += `| TP Calculation Mode | \`fibonacci\` |\n`;
  md += `| Fibonacci Target Level | \`auto\` |\n`;
  md += `| Use Algorithmic Levels | ✅ Enabled |\n`;
  md += `| Min Risk/Reward Ratio | 1.2 |\n`;
  md += `| Exposure Multiplier | 1.5x |\n`;
  md += `| Confluence Scoring | ✅ Enabled (min: 60) |\n`;
  md += `| MTF Filter | ✅ Enabled |\n`;
  md += `| BTC Correlation Filter | ✅ Enabled |\n`;
  md += `| Market Regime Filter | ✅ Enabled |\n`;
  md += `| Funding Filter | ✅ Enabled |\n`;
  md += `| Momentum Timing Filter | ✅ Enabled |\n`;
  md += `| Stochastic Filter | ❌ Disabled |\n`;
  md += `| ADX Filter | ❌ Disabled |\n`;
  md += `| Trend Filter | ❌ Disabled |\n`;
  md += `| Volume Filter | ❌ Disabled |\n`;
  md += `| Only With Trend | ❌ Disabled |\n\n`;

  md += `## Symbols Tested\n\n`;
  md += symbols.map(s => `- ${s}`).join('\n') + '\n\n';

  md += `## Strategy Rankings (Top 30 by Total PnL%)\n\n`;
  md += `| Rank | Strategy | Trades | Win Rate | PF | Sharpe | Max DD | Total PnL% |\n`;
  md += `|------|----------|--------|----------|-----|--------|--------|------------|\n`;

  results.slice(0, 30).forEach((r, i) => {
    const pf = r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2);
    const pnlEmoji = r.totalPnlPercent > 0 ? '🟢' : r.totalPnlPercent < 0 ? '🔴' : '⚪';
    md += `| ${i + 1} | ${r.strategyName} | ${r.totalTrades} | ${r.winRate.toFixed(1)}% | ${pf} | ${r.sharpeRatio.toFixed(2)} | ${r.maxDrawdownPercent.toFixed(1)}% | ${pnlEmoji} ${r.totalPnlPercent >= 0 ? '+' : ''}${r.totalPnlPercent.toFixed(2)}% |\n`;
  });

  md += `\n## Summary Statistics\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Strategies Tested | ${results.length} |\n`;
  md += `| Profitable Strategies (PF > 1.5, WR > 50%, Trades >= 10) | ${profitable.length} |\n`;

  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
  const avgPnl = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.length;
  const avgPF = results.filter(r => r.profitFactor !== Infinity).reduce((sum, r) => sum + r.profitFactor, 0) / results.filter(r => r.profitFactor !== Infinity).length;

  md += `| Average Win Rate | ${avgWinRate.toFixed(1)}% |\n`;
  md += `| Average PnL% | ${avgPnl.toFixed(2)}% |\n`;
  md += `| Average Profit Factor | ${avgPF.toFixed(2)} |\n`;

  if (profitable.length > 0) {
    md += `\n## Top Profitable Strategies\n\n`;
    md += `These strategies meet the criteria: **PF > 1.5**, **Win Rate > 50%**, **Trades >= 10**\n\n`;
    md += `| # | Strategy ID | Strategy Name | Trades | Win Rate | PF | PnL% |\n`;
    md += `|---|-------------|---------------|--------|----------|-----|------|\n`;

    profitable.slice(0, 15).forEach((s, i) => {
      md += `| ${i + 1} | \`${s.strategyId}\` | ${s.strategyName} | ${s.totalTrades} | ${s.winRate.toFixed(1)}% | ${s.profitFactor.toFixed(2)} | +${s.totalPnlPercent.toFixed(2)}% |\n`;
    });

    md += `\n### Recommended Strategy IDs for Combined Backtest\n\n`;
    md += `\`\`\`\n${profitable.slice(0, 10).map(s => s.strategyId).join(', ')}\n\`\`\`\n`;
  }

  md += `\n## All Results by Strategy\n\n`;
  md += `<details>\n<summary>Click to expand full results (${results.length} strategies)</summary>\n\n`;
  md += `| Strategy | Trades | Win Rate | PF | Sharpe | Max DD | PnL% |\n`;
  md += `|----------|--------|----------|-----|--------|--------|------|\n`;

  results.forEach(r => {
    const pf = r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2);
    md += `| ${r.strategyName} | ${r.totalTrades} | ${r.winRate.toFixed(1)}% | ${pf} | ${r.sharpeRatio.toFixed(2)} | ${r.maxDrawdownPercent.toFixed(1)}% | ${r.totalPnlPercent >= 0 ? '+' : ''}${r.totalPnlPercent.toFixed(2)}% |\n`;
  });

  md += `\n</details>\n`;

  return md;
}

async function main() {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║         MARKETMIND - STRATEGY ANALYSIS (2 YEARS)               ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`Period: ${START_DATE} to ${END_DATE}`));
  console.log(chalk.gray(`Timeframes: ${TIMEFRAMES.join(', ')}`));
  console.log(chalk.gray(`Capital: $${INITIAL_CAPITAL} | Leverage: ${LEVERAGE}x`));
  console.log(chalk.gray(`Results directory: ${RESULTS_DIR}\n`));

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const symbols = await getActiveFuturesSymbols();
  if (symbols.length === 0) {
    console.log(chalk.red('No active FUT watchers found. Please start some watchers first.'));
    process.exit(1);
  }

  console.log(chalk.cyan('\nBackfilling data for all symbols and timeframes...'));
  for (const symbol of symbols) {
    for (const interval of TIMEFRAMES) {
      await backfillSymbol(symbol, interval);
    }
  }

  const strategies = await getAllStrategies();
  const results: StrategyResult[] = [];

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i]!;
    const result = await analyzeStrategy(strategy, symbols, i, strategies.length);
    results.push(result);

    fs.writeFileSync(
      path.join(RESULTS_DIR, `${strategy.id}.json`),
      JSON.stringify(result, null, 2)
    );
  }

  results.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent);

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'all-results.json'),
    JSON.stringify(results, null, 2)
  );

  const profitable = results.filter(r => r.profitFactor > 1.5 && r.winRate > 50 && r.totalTrades >= 10);
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'top-strategies.json'),
    JSON.stringify(profitable, null, 2)
  );

  printRankingTable(results);

  console.log(chalk.cyan.bold('\n══════════════════════════════════════════════════════════════════'));
  console.log(chalk.white(`Total strategies tested: ${results.length}`));
  console.log(chalk.green(`Profitable strategies (PF > 1.5, WR > 50%, Trades >= 10): ${profitable.length}`));
  console.log(chalk.gray(`\nResults saved to: ${RESULTS_DIR}`));

  const markdownReport = generateMarkdownReport(results, profitable, symbols, START_DATE, END_DATE);
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
  const mdFilePath = path.join(DOCS_DIR, `STRATEGY_ANALYSIS_${DATE_STR}.md`);
  fs.writeFileSync(mdFilePath, markdownReport);
  console.log(chalk.green(`\n✓ Markdown report saved to: ${mdFilePath}`));

  if (profitable.length > 0) {
    console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('TOP STRATEGIES FOR COMBINED BACKTEST:'));
    console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════\n'));
    profitable.slice(0, 10).forEach((s, i) => {
      console.log(chalk.green(`${i + 1}. ${s.strategyName} (${s.strategyId})`));
      console.log(chalk.gray(`   PF: ${s.profitFactor.toFixed(2)} | WR: ${s.winRate.toFixed(1)}% | Trades: ${s.totalTrades} | PnL: ${s.totalPnlPercent.toFixed(2)}%`));
    });

    const topStrategyIds = profitable.slice(0, 10).map(s => s.strategyId);
    console.log(chalk.yellow(`\nRun combined backtest with: ${topStrategyIds.join(', ')}`));
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
