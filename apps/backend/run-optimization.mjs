#!/usr/bin/env node
/**
 * Interactive Batch Optimization with Real-time Progress
 * 
 * Runs optimization for all strategies with live progress bar and status updates.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';

const STRATEGIES = [
    { name: 'order-block-fvg', params: ['lookbackPeriod=30,40,50,60', 'orderBlockVolumeMultiplier=1.2,1.5,1.8', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'liquidity-sweep', params: ['lookbackPeriod=30,40,50,60', 'sweepThreshold=0.3,0.5,0.7', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'divergence-rsi-macd', params: ['rsiPeriod=10,12,14,16', 'divergenceLookback=15,20,25', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'larry-williams-9-1', params: ['smaVolumePeriod=15,20,25', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'larry-williams-9-2', params: ['emaPeriod=7,9,11', 'smaVolumePeriod=15,20,25', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'larry-williams-9-3', params: ['emaPeriod=7,9,11', 'smaVolumePeriod=15,20,25', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'larry-williams-9-4', params: ['emaPeriod=7,9,11', 'smaVolumePeriod=15,20,25', 'failureThreshold=0.002,0.003,0.004', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'connors-rsi2', params: ['rsiPeriod=2,3,4', 'rsiOversoldLevel=5,10,15', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'mean-reversion-bb-rsi', params: ['bbPeriod=15,20,25', 'rsiPeriod=10,12,14', 'targetMultiplier=1.5,2.0,2.5,3.0'] },
    { name: 'rsi2-mean-reversion', params: ['rsiPeriod=2,3,4', 'rsiOversoldLevel=5,10,15', 'targetMultiplier=2.0,2.5,3.0'] },
];

const CONFIG = {
    symbol: 'BTCUSDT',
    interval: '1h',
    start: '2023-01-01',
    end: '2024-12-31',
    capital: '1000',
    parallel: '4',
    top: '3',
    minWinRate: '30',
    minProfitFactor: '1.3',
    sortBy: 'profitFactor',
};

let currentStrategy = 0;
let completedStrategies = 0;
let failedStrategies = 0;
const results = { successful: [], failed: [] };

function clearScreen() {
    process.stdout.write('\x1b[2J\x1b[0f');
}

function drawProgressBar(percent) {
    const width = 50;
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return chalk.cyan('[') +
        chalk.green('█'.repeat(filled)) +
        chalk.gray('░'.repeat(empty)) +
        chalk.cyan(']');
}

function updateDisplay() {
    clearScreen();

    const totalProgress = Math.round((completedStrategies / STRATEGIES.length) * 100);

    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('           BATCH OPTIMIZATION - REAL-TIME PROGRESS                           ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════════════╝'));

    console.log('');
    console.log(chalk.bold('  Overall Progress:'), `${completedStrategies}/${STRATEGIES.length} strategies (${totalProgress}%)`);
    console.log('  ', drawProgressBar(totalProgress), chalk.gray(`${totalProgress}%`));
    console.log('');

    console.log(chalk.bold('  Status:'),
        chalk.green(`✅ ${completedStrategies} completed`), '|',
        chalk.red(`❌ ${failedStrategies} failed`), '|',
        chalk.yellow(`⏳ ${STRATEGIES.length - completedStrategies - failedStrategies} pending`)
    );
    console.log('');

    if (currentStrategy < STRATEGIES.length) {
        const strategy = STRATEGIES[currentStrategy];
        console.log(chalk.bold.yellow('  🔧 Current Strategy:'), chalk.white(strategy.name));
        console.log(chalk.gray(`     Parameters: ${strategy.params.length} combinations`));
        console.log('');
    }

    if (results.successful.length > 0) {
        console.log(chalk.bold.green('  ✅ Completed:'));
        results.successful.forEach(s => {
            console.log(chalk.green(`     ✓ ${s}`));
        });
        console.log('');
    }

    if (results.failed.length > 0) {
        console.log(chalk.bold.red('  ❌ Failed:'));
        results.failed.forEach(s => {
            console.log(chalk.red(`     ✗ ${s}`));
        });
        console.log('');
    }

    console.log(chalk.gray('  ─'.repeat(79)));
    console.log(chalk.gray('  Press Ctrl+C to cancel optimization'));
    console.log('');
}

function runOptimization(strategy) {
    return new Promise((resolve, reject) => {
        const paramArgs = strategy.params.map(p => ['--param', p]).flat();

        const args = [
            'run', 'backtest:optimize', '--',
            '--strategy', strategy.name,
            '--symbol', CONFIG.symbol,
            '--interval', CONFIG.interval,
            '--start', CONFIG.start,
            '--end', CONFIG.end,
            '--capital', CONFIG.capital,
            ...paramArgs,
            '--parallel', CONFIG.parallel,
            '--top', CONFIG.top,
            '--min-win-rate', CONFIG.minWinRate,
            '--min-profit-factor', CONFIG.minProfitFactor,
            '--sort-by', CONFIG.sortBy,
        ];

        const child = spawn('npm', args, {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, output });
            } else {
                reject(new Error(`Optimization failed with code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    console.log(chalk.bold.cyan('\n🚀 Starting Batch Optimization...\n'));
    console.log(chalk.gray(`   Period: ${CONFIG.start} to ${CONFIG.end}`));
    console.log(chalk.gray(`   Symbol: ${CONFIG.symbol}`));
    console.log(chalk.gray(`   Strategies: ${STRATEGIES.length}`));
    console.log(chalk.gray(`   Parallel workers: ${CONFIG.parallel}\n`));

    await new Promise(resolve => setTimeout(resolve, 2000));

    for (let i = 0; i < STRATEGIES.length; i++) {
        currentStrategy = i;
        const strategy = STRATEGIES[i];

        updateDisplay();

        try {
            await runOptimization(strategy);
            completedStrategies++;
            results.successful.push(strategy.name);
        } catch (error) {
            failedStrategies++;
            results.failed.push(strategy.name);
        }

        updateDisplay();
    }

    // Final summary
    clearScreen();
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('                   BATCH OPTIMIZATION COMPLETE                               ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.bold('  Final Results:\n'));
    console.log(chalk.green(`  ✅ Successful: ${completedStrategies}/${STRATEGIES.length}`));
    console.log(chalk.red(`  ❌ Failed: ${failedStrategies}/${STRATEGIES.length}\n`));

    if (results.successful.length > 0) {
        console.log(chalk.bold.green('  ✅ Completed Strategies:'));
        results.successful.forEach(s => console.log(chalk.green(`     ✓ ${s}`)));
        console.log('');
    }

    if (results.failed.length > 0) {
        console.log(chalk.bold.red('  ❌ Failed Strategies:'));
        results.failed.forEach(s => console.log(chalk.red(`     ✗ ${s}`)));
        console.log('');
    }

    console.log(chalk.bold.cyan('  📁 Results saved in:'), chalk.white('./results/optimizations/'));

    if (failedStrategies === 0) {
        console.log(chalk.bold.green('\n  🎉 All optimizations completed successfully!'));
        console.log(chalk.bold.white('  📄 Next step:'), chalk.cyan('node apply-optimized-params.mjs\n'));
    } else {
        console.log(chalk.bold.yellow('\n  ⚠️  Some optimizations failed. Check logs for details.\n'));
    }

    process.exit(failedStrategies > 0 ? 1 : 0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    clearScreen();
    console.log(chalk.yellow('\n\n  ⚠️  Optimization cancelled by user\n'));
    console.log(chalk.gray(`  Completed: ${completedStrategies}/${STRATEGIES.length} strategies\n`));
    process.exit(130);
});

main().catch((error) => {
    console.error(chalk.red('\n  ❌ Fatal error:'), error.message);
    process.exit(1);
});
