#!/usr/bin/env tsx

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const STRATEGIES_DIR = './strategies/builtin';
const RESULTS_DIR = `./results/bulk-optimization-${new Date().toISOString().split('T')[0]}`;
const TEST_START_DATE = '2024-01-01';
const TEST_END_DATE = '2024-12-01';

interface OptimizationResult {
  strategy: string;
  currentPnL: number;
  optimizedPnL: number;
  currentTrades: number;
  optimizedTrades: number;
  improved: boolean;
  currentParams: Record<string, number>;
  optimizedParams: Record<string, number>;
  status: 'success' | 'failed' | 'no-improvement';
}

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[\d+m/g, '');
}

function extractMetric(output: string, metric: string): string {
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('│') && line.includes(metric)) {
      const cleanLine = stripAnsi(line);
      const parts = cleanLine.split('│').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2 && parts[0] === metric) {
        return parts[1];
      }
    }
  }
  return '0';
}

function getCurrentPerformance(strategyId: string): { pnl: number; trades: number } {
  try {
    const output = execSync(
      `pnpm exec tsx src/cli/backtest-runner.ts validate -s ${strategyId} --symbol BTCUSDT -i 1d --start ${TEST_START_DATE} --end ${TEST_END_DATE} --optimized`,
      { 
        encoding: 'utf-8', 
        stdio: 'pipe',
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      }
    );
    
    const pnl = extractMetric(output, 'Total PnL %');
    const trades = extractMetric(output, 'Total Trades');
    return { 
      pnl: parseFloat(pnl.replace(/[+%]/g, '')) || 0,
      trades: parseInt(trades, 10) || 0
    };
  } catch (error) {
    return { pnl: 0, trades: 0 };
  }
}

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║         MARKETMIND - BATCH STRATEGY OPTIMIZATION               ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`Results directory: ${RESULTS_DIR}`));
  console.log(chalk.gray(`Test period: ${TEST_START_DATE} to ${TEST_END_DATE} (11 months)\n`));

  const strategyFiles = fs.readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json'));
  const activeStrategies: string[] = [];
  
  for (const file of strategyFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(STRATEGIES_DIR, file), 'utf-8'));
    if (content.status === 'active') {
      activeStrategies.push(content.id);
    }
  }

  console.log(chalk.cyan(`Found ${activeStrategies.length} active strategies to optimize\n`));

  const results: OptimizationResult[] = [];
  let improvedCount = 0;
  let failedCount = 0;
  let noImprovementCount = 0;

  for (let i = 0; i < activeStrategies.length; i++) {
    const strategy = activeStrategies[i]!;
    console.log(chalk.gray(`\n[${i + 1}/${activeStrategies.length}] Optimizing: ${strategy}`));

    try {
      console.log(chalk.gray('  → Getting current performance...'));
      const currentPerf = getCurrentPerformance(strategy);
      console.log(chalk.gray(`  → Current PnL: ${currentPerf.pnl.toFixed(2)}% (${currentPerf.trades} trades)`));

      const strategyPath = path.join(STRATEGIES_DIR, `${strategy}.json`);
      const strategyData = JSON.parse(fs.readFileSync(strategyPath, 'utf-8'));
      const currentParams = strategyData.optimizedParams || {};

      const paramList: string[] = [];
      if (strategyData.parameters) {
        const paramCount = Object.keys(strategyData.parameters).length;
        
        let valuesPerParam = 5;
        if (paramCount >= 7) valuesPerParam = 3;
        if (paramCount >= 9) valuesPerParam = 2;
        
        for (const [paramName, paramDef] of Object.entries(strategyData.parameters) as [string, any][]) {
          const min = paramDef.min;
          const max = paramDef.max;
          const step = paramDef.step || 1;
          
          const values: number[] = [];
          for (let j = 0; j < valuesPerParam; j++) {
            const value = min + (j * (max - min) / (valuesPerParam - 1));
            values.push(Math.round(value / step) * step);
          }
          
          paramList.push(`${paramName}=${values.join(',')}`);
        }
      }

      if (paramList.length === 0) {
        console.log(chalk.yellow(`  ⚠ No parameters to optimize, skipping...`));
        continue;
      }

      const totalCombinations = paramList.reduce((total, param) => {
        const values = param.split('=')[1]!.split(',').length;
        return total * values;
      }, 1);

      console.log(chalk.gray(`  → Running optimization with ${paramList.length} parameters (${totalCombinations} combinations)...`));
      
      const paramArgs = paramList.map(p => `--param ${p}`).join(' ');
      const cmd = `pnpm exec tsx src/cli/backtest-runner.ts optimize \
        --strategy ${strategy} \
        --symbol BTCUSDT \
        --interval 1d \
        --start ${TEST_START_DATE} \
        --end ${TEST_END_DATE} \
        --capital 1000 \
        ${paramArgs} \
        --parallel 4 \
        --top 1 \
        --sort-by totalPnlPercent`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer to avoid ENOBUFS
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      });

      fs.writeFileSync(path.join(RESULTS_DIR, `${strategy}.txt`), output);

      const optimizedPnL = parseFloat(extractMetric(output, 'Total PnL %').replace(/[+%]/g, '')) || 0;
      const optimizedTrades = parseInt(extractMetric(output, 'Total Trades'), 10) || 0;

      console.log(chalk.gray(`  → Optimized PnL: ${optimizedPnL.toFixed(2)}% (${optimizedTrades} trades)`));

      const improved = optimizedPnL > currentPerf.pnl && optimizedTrades > 0;

      if (improved) {
        console.log(chalk.green(`  ✓ Improved by ${(optimizedPnL - currentPerf.pnl).toFixed(2)}% - updating parameters`));
        
        const resultFiles = fs.readdirSync('./results/optimizations')
          .filter(f => f.startsWith(strategy) && f.endsWith('.json'))
          .sort()
          .reverse();
        
        if (resultFiles.length > 0) {
          const resultPath = path.join('./results/optimizations', resultFiles[0]!);
          const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
          
          if (resultData.results && resultData.results.length > 0) {
            const bestResult = resultData.results[0];
            
            strategyData.optimizedParams = {
              ...strategyData.optimizedParams,
              ...bestResult.parameters,
            };
            
            fs.writeFileSync(strategyPath, JSON.stringify(strategyData, null, 2));
            
            results.push({
              strategy,
              currentPnL: currentPerf.pnl,
              optimizedPnL,
              currentTrades: currentPerf.trades,
              optimizedTrades,
              improved: true,
              currentParams,
              optimizedParams: bestResult.parameters,
              status: 'success',
            });
            
            improvedCount++;
          }
        }
      } else {
        console.log(chalk.yellow(`  → No improvement (${(optimizedPnL - currentPerf.pnl).toFixed(2)}%)`));
        results.push({
          strategy,
          currentPnL: currentPerf.pnl,
          optimizedPnL,
          currentTrades: currentPerf.trades,
          optimizedTrades,
          improved: false,
          currentParams,
          optimizedParams: {},
          status: 'no-improvement',
        });
        noImprovementCount++;
      }

    } catch (error: any) {
      console.log(chalk.red(`  ✗ Optimization failed: ${error.message}`));
      results.push({
        strategy,
        currentPnL: 0,
        optimizedPnL: 0,
        currentTrades: 0,
        optimizedTrades: 0,
        improved: false,
        currentParams: {},
        optimizedParams: {},
        status: 'failed',
      });
      failedCount++;
    }
  }

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'optimization-results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    OPTIMIZATION SUMMARY                        ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white(`Total Strategies:          ${results.length}`));
  console.log(chalk.green(`✓ Improved:                ${improvedCount}`));
  console.log(chalk.yellow(`→ No Improvement:          ${noImprovementCount}`));
  console.log(chalk.red(`✗ Failed:                  ${failedCount}\n`));

  const improved = results.filter(r => r.improved).sort((a, b) => 
    (b.optimizedPnL - b.currentPnL) - (a.optimizedPnL - a.currentPnL)
  );

  if (improved.length > 0) {
    console.log(chalk.cyan.bold('Top 10 Improvements:\n'));
    improved.slice(0, 10).forEach((r, i) => {
      const improvement = r.optimizedPnL - r.currentPnL;
      console.log(chalk.white(`${i + 1}. ${r.strategy}`));
      console.log(chalk.gray(`   Current: ${r.currentPnL.toFixed(2)}% → Optimized: ${r.optimizedPnL.toFixed(2)}% (+${improvement.toFixed(2)}%)`));
    });
  }

  console.log(chalk.gray(`\n✓ Results saved to: ${RESULTS_DIR}\n`));
}

main().catch(console.error);
