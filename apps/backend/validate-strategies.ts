#!/usr/bin/env tsx
/**
 * Quick Strategy Validation Script
 * Tests all active strategies and displays results in a formatted table
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';

const STRATEGIES_DIR = './strategies/builtin';
const RESULTS_DIR = `./results/bulk-validation-${new Date().toISOString().split('T')[0]}`;

interface ValidationResult {
  strategy: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  status: 'success' | 'failed';
}

async function main() {
  // Create results directory
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║         MARKETMIND - BULK STRATEGY VALIDATION                  ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`Results directory: ${RESULTS_DIR}\n`));

  // Get list of active strategies
  const strategyFiles = fs.readdirSync(STRATEGIES_DIR)
    .filter(f => f.endsWith('.json'));

  const activeStrategies: string[] = [];
  
  for (const file of strategyFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(STRATEGIES_DIR, file), 'utf-8'));
    if (content.status === 'active') {
      activeStrategies.push(content.id);
    }
  }

  console.log(chalk.cyan(`Found ${activeStrategies.length} active strategies\n`));

  const results: ValidationResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Validate each strategy
  for (let i = 0; i < activeStrategies.length; i++) {
    const strategy = activeStrategies[i];
    console.log(chalk.gray(`[${i + 1}/${activeStrategies.length}] Testing: ${strategy}`));

    try {
      const output = execSync(
        `pnpm exec tsx src/cli/backtest-runner.ts validate -s ${strategy} --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-12-01 --optimized`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      // Save full output
      fs.writeFileSync(path.join(RESULTS_DIR, `${strategy}.txt`), output);

      // Extract metrics
      const trades = extractMetric(output, 'Total Trades');
      const winRate = extractMetric(output, 'Win Rate');
      const pnl = extractMetric(output, 'Total PnL %');
      const pf = extractMetric(output, 'Profit Factor');
      const maxDD = extractMetric(output, 'Max Drawdown %');
      const sharpe = extractMetric(output, 'Sharpe Ratio');

      results.push({
        strategy,
        totalTrades: parseFloat(trades) || 0,
        winRate: parseFloat(winRate.replace(/[+%]/g, '')) || 0,
        totalPnlPercent: parseFloat(pnl.replace(/[+%]/g, '')) || 0,
        profitFactor: parseFloat(pf) || 0,
        maxDrawdownPercent: parseFloat(maxDD.replace(/[-+%]/g, '')) || 0,
        sharpeRatio: parseFloat(sharpe) || 0,
        status: 'success',
      });

      successCount++;
      console.log(chalk.green(`  ✓ ${trades} trades | ${winRate} WR | ${pnl} PnL | ${pf} PF\n`));

    } catch (error) {
      failedCount++;
      results.push({
        strategy,
        totalTrades: 0,
        winRate: 0,
        totalPnlPercent: 0,
        profitFactor: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        status: 'failed',
      });
      console.log(chalk.red(`  ✗ FAILED\n`));
    }
  }

  // Save JSON results
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'all-results.json'),
    JSON.stringify(results, null, 2)
  );

  // Display summary table
  displaySummaryTable(results, successCount, failedCount);

  // Generate markdown report
  generateMarkdownReport(results, successCount, failedCount);
}

function extractMetric(output: string, metric: string): string {
  const regex = new RegExp(`│\\s*${metric}\\s*│\\s*([^│]+)\\s*│`);
  const match = output.match(regex);
  return match ? match[1].trim() : '0';
}

function displaySummaryTable(results: ValidationResult[], successCount: number, failedCount: number) {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    VALIDATION SUMMARY                          ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  // Top performers table
  const topPerformers = results
    .filter(r => r.status === 'success' && r.totalTrades > 0)
    .sort((a, b) => b.totalPnlPercent - a.totalPnlPercent)
    .slice(0, 15);

  const table = new Table({
    head: [
      chalk.cyan('Rank'),
      chalk.cyan('Strategy'),
      chalk.cyan('Trades'),
      chalk.cyan('Win Rate'),
      chalk.cyan('PnL %'),
      chalk.cyan('PF'),
      chalk.cyan('Max DD %'),
      chalk.cyan('Sharpe'),
    ],
    colWidths: [6, 35, 8, 10, 10, 8, 10, 8],
  });

  topPerformers.forEach((result, index) => {
    table.push([
      chalk.white((index + 1).toString()),
      chalk.white(result.strategy),
      chalk.white(result.totalTrades.toString()),
      formatWinRate(result.winRate),
      formatPnL(result.totalPnlPercent),
      formatPF(result.profitFactor),
      formatDD(result.maxDrawdownPercent),
      chalk.white(result.sharpeRatio.toFixed(2)),
    ]);
  });

  console.log(table.toString());

  // Summary stats
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                       STATISTICS                               ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.filter(r => r.status === 'success').length;
  const avgPnL = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.filter(r => r.status === 'success').length;
  const strategiesWithTrades = results.filter(r => r.totalTrades > 10).length;

  console.log(chalk.white(`Total Strategies:          ${results.length}`));
  console.log(chalk.green(`✓ Success:                 ${successCount}`));
  console.log(chalk.red(`✗ Failed:                  ${failedCount}`));
  console.log(chalk.white(`Strategies with >10 trades: ${strategiesWithTrades}`));
  console.log(chalk.white(`Average Win Rate:          ${avgWinRate.toFixed(2)}%`));
  console.log(chalk.white(`Average PnL:               ${avgPnL.toFixed(2)}%\n`));
}

function generateMarkdownReport(results: ValidationResult[], successCount: number, failedCount: number) {
  const reportPath = path.join(RESULTS_DIR, 'SUMMARY.md');
  
  const topPerformers = results
    .filter(r => r.status === 'success' && r.totalTrades > 0)
    .sort((a, b) => b.totalPnlPercent - a.totalPnlPercent)
    .slice(0, 15);

  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.filter(r => r.status === 'success').length;
  const avgPnL = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.filter(r => r.status === 'success').length;
  const strategiesWithTrades = results.filter(r => r.totalTrades > 10).length;

  const report = `# Strategy Validation Summary

**Generated:** ${new Date().toISOString()}  
**Total Strategies:** ${results.length}  
**Success:** ${successCount}  
**Failed:** ${failedCount}

## Top 15 Performers (by PnL %)

| Rank | Strategy | Trades | Win Rate | PnL % | Profit Factor | Max DD % | Sharpe |
|------|----------|--------|----------|-------|---------------|----------|--------|
${topPerformers.map((r, i) => 
  `| ${i + 1} | ${r.strategy} | ${r.totalTrades} | ${r.winRate.toFixed(2)}% | ${r.totalPnlPercent.toFixed(2)}% | ${r.profitFactor.toFixed(2)} | ${r.maxDrawdownPercent.toFixed(2)}% | ${r.sharpeRatio.toFixed(2)} |`
).join('\n')}

## Statistics

- **Average Win Rate:** ${avgWinRate.toFixed(2)}%
- **Average PnL:** ${avgPnL.toFixed(2)}%
- **Strategies with >10 trades:** ${strategiesWithTrades}

## Failed Strategies

${results.filter(r => r.status === 'failed').map(r => `- ${r.strategy}`).join('\n')}

---

**Results Location:** \`${RESULTS_DIR}\`
`;

  fs.writeFileSync(reportPath, report);
  
  console.log(chalk.green(`\n✓ Summary report saved: ${reportPath}`));
  console.log(chalk.gray(`  View with: cat ${reportPath}\n`));
}

function formatWinRate(wr: number): string {
  if (wr >= 50) return chalk.green(`${wr.toFixed(2)}%`);
  if (wr >= 40) return chalk.yellow(`${wr.toFixed(2)}%`);
  return chalk.red(`${wr.toFixed(2)}%`);
}

function formatPnL(pnl: number): string {
  if (pnl > 0) return chalk.green(`+${pnl.toFixed(2)}%`);
  if (pnl < 0) return chalk.red(`${pnl.toFixed(2)}%`);
  return chalk.gray(`${pnl.toFixed(2)}%`);
}

function formatPF(pf: number): string {
  if (pf >= 2) return chalk.green(pf.toFixed(2));
  if (pf >= 1.5) return chalk.yellow(pf.toFixed(2));
  return chalk.red(pf.toFixed(2));
}

function formatDD(dd: number): string {
  if (dd <= 10) return chalk.green(`${dd.toFixed(2)}%`);
  if (dd <= 20) return chalk.yellow(`${dd.toFixed(2)}%`);
  return chalk.red(`${dd.toFixed(2)}%`);
}

main().catch(console.error);
