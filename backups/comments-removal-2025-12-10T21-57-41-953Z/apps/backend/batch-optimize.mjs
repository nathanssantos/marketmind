#!/usr/bin/env node
/**
 * Batch Optimization Script
 * 
 * Runs optimization for all dynamic strategies to find optimal parameters
 * that improve Profit Factor and overall performance.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const STRATEGIES_DIR = './strategies/builtin';
const RESULTS_DIR = './results/optimizations';

// Optimization targets
const OPTIMIZATION_CONFIG = {
    symbol: 'BTCUSDT',
    interval: '1h',
    start: '2023-01-01', // Full year for better optimization
    end: '2024-12-31',
    capital: '1000',
    parallel: '4',
    top: '3',
    minWinRate: '30',
    minProfitFactor: '1.3',
    sortBy: 'profitFactor', // Focus on improving PF
};

// Strategies to optimize with their parameter grids
const STRATEGIES_TO_OPTIMIZE = [
    {
        name: 'order-block-fvg',
        params: [
            'lookbackPeriod=30,40,50,60',
            'orderBlockVolumeMultiplier=1.2,1.5,1.8',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'liquidity-sweep',
        params: [
            'lookbackPeriod=30,40,50,60',
            'sweepThreshold=0.3,0.5,0.7',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'divergence-rsi-macd',
        params: [
            'rsiPeriod=10,12,14,16',
            'divergenceLookback=10,15,20',
            'targetMultiplier=2.0,2.5,3.0,3.5',
        ],
    },
    {
        name: 'larry-williams-9-1',
        params: [
            'lookbackDays=3,5,7',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-2',
        params: [
            'lookbackDays=3,5,7',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-3',
        params: [
            'lookbackDays=3,5,7',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-4',
        params: [
            'lookbackDays=3,5,7',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
    {
        name: 'connors-rsi2-original',
        params: [
            'rsiPeriod=2,3,4',
            'rsiOversoldLevel=5,10,15',
            'targetPercent=0.5,1.0,1.5,2.0', // Increase targets for better R:R
            'stopLossPercent=1.5,2.0,2.5', // Tighter stops
        ],
    },
    {
        name: 'mean-reversion-bb-rsi',
        params: [
            'bbPeriod=15,20,25',
            'bbStdDev=1.5,2.0,2.5',
            'rsiPeriod=10,14,18',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
    {
        name: 'rsi2-mean-reversion',
        params: [
            'rsiPeriod=2,3,4',
            'rsiOversoldLevel=5,10,15',
            'targetMultiplier=2.0,2.5,3.0',
        ],
    },
];

function ensureResultsDir() {
    if (!fs.existsSync(RESULTS_DIR)) {
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }
}

function runOptimization(strategy) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 Optimizing: ${strategy.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const paramArgs = strategy.params.map(p => `--param ${p}`).join(' ');

    const cmd = `npm run backtest:optimize -- \
    --strategy ${strategy.name} \
    --symbol ${OPTIMIZATION_CONFIG.symbol} \
    --interval ${OPTIMIZATION_CONFIG.interval} \
    --start ${OPTIMIZATION_CONFIG.start} \
    --end ${OPTIMIZATION_CONFIG.end} \
    --capital ${OPTIMIZATION_CONFIG.capital} \
    ${paramArgs} \
    --parallel ${OPTIMIZATION_CONFIG.parallel} \
    --top ${OPTIMIZATION_CONFIG.top} \
    --min-win-rate ${OPTIMIZATION_CONFIG.minWinRate} \
    --min-profit-factor ${OPTIMIZATION_CONFIG.minProfitFactor} \
    --sort-by ${OPTIMIZATION_CONFIG.sortBy}`;

    try {
        const output = execSync(cmd, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
            stdio: 'inherit' // Show output in real-time
        });

        console.log(`\n✅ Optimization complete for ${strategy.name}\n`);
        return true;
    } catch (error) {
        console.error(`\n❌ Optimization failed for ${strategy.name}`);
        console.error(error.message);
        return false;
    }
}

async function main() {
    console.log('\n📊 BATCH OPTIMIZATION - MarketMind Strategies');
    console.log(`Period: ${OPTIMIZATION_CONFIG.start} to ${OPTIMIZATION_CONFIG.end}`);
    console.log(`Symbol: ${OPTIMIZATION_CONFIG.symbol}`);
    console.log(`Interval: ${OPTIMIZATION_CONFIG.interval}`);
    console.log(`Strategies to optimize: ${STRATEGIES_TO_OPTIMIZE.length}\n`);

    ensureResultsDir();

    const results = {
        successful: [],
        failed: [],
    };

    for (const strategy of STRATEGIES_TO_OPTIMIZE) {
        const success = runOptimization(strategy);

        if (success) {
            results.successful.push(strategy.name);
        } else {
            results.failed.push(strategy.name);
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📈 OPTIMIZATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Successful: ${results.successful.length}/${STRATEGIES_TO_OPTIMIZE.length}`);

    if (results.successful.length > 0) {
        console.log('\nOptimized strategies:');
        results.successful.forEach(name => console.log(`  • ${name}`));
    }

    if (results.failed.length > 0) {
        console.log(`\n❌ Failed: ${results.failed.length}`);
        results.failed.forEach(name => console.log(`  • ${name}`));
    }

    console.log(`\n📁 Results saved to: ${RESULTS_DIR}/`);
    console.log('\n💡 Next steps:');
    console.log('  1. Review optimization results in results/optimizations/');
    console.log('  2. Update strategy JSON files with optimal parameters');
    console.log('  3. Run validation backtests with new parameters');
    console.log('  4. Compare performance improvements\n');
}

main().catch(console.error);
