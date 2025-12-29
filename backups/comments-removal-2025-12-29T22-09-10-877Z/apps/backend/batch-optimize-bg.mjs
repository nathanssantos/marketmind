#!/usr/bin/env node
/**
 * Batch Optimization Script (Background Version)
 * 
 * Runs optimization for all dynamic strategies in background mode.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const STRATEGIES_DIR = './strategies/builtin';
const RESULTS_DIR = './results/optimizations';

const OPTIMIZATION_CONFIG = {
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
            'divergenceLookback=15,20,25',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-1',
        params: [
            'smaVolumePeriod=15,20,25',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-2',
        params: [
            'emaPeriod=7,9,11',
            'smaVolumePeriod=15,20,25',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-3',
        params: [
            'emaPeriod=7,9,11',
            'smaVolumePeriod=15,20,25',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'larry-williams-9-4',
        params: [
            'emaPeriod=7,9,11',
            'smaVolumePeriod=15,20,25',
            'failureThreshold=0.002,0.003,0.004',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'connors-rsi2',
        params: [
            'rsiPeriod=2,3,4',
            'rsiOversoldLevel=5,10,15',
            'targetMultiplier=1.5,2.0,2.5,3.0',
        ],
    },
    {
        name: 'mean-reversion-bb-rsi',
        params: [
            'bbPeriod=15,20,25',
            'rsiPeriod=10,12,14',
            'targetMultiplier=1.5,2.0,2.5,3.0',
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

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function runOptimization(strategy) {
    log(`${'='.repeat(80)}`);
    log(`🔧 Optimizing: ${strategy.name}`);
    log(`${'='.repeat(80)}`);

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
        });

        log(`✅ Optimization complete for ${strategy.name}`);
        return true;
    } catch (error) {
        log(`❌ Optimization failed for ${strategy.name}: ${error.message}`);
        return false;
    }
}

function main() {
    log('📊 BATCH OPTIMIZATION - MarketMind Strategies (Background Mode)');
    log(`Period: ${OPTIMIZATION_CONFIG.start} to ${OPTIMIZATION_CONFIG.end}`);
    log(`Symbol: ${OPTIMIZATION_CONFIG.symbol}`);
    log(`Interval: ${OPTIMIZATION_CONFIG.interval}`);
    log(`Strategies to optimize: ${STRATEGIES_TO_OPTIMIZE.length}`);

    ensureResultsDir();

    const results = {
        total: STRATEGIES_TO_OPTIMIZE.length,
        successful: 0,
        failed: 0,
        strategies: [],
    };

    for (const strategy of STRATEGIES_TO_OPTIMIZE) {
        const success = runOptimization(strategy);

        if (success) {
            results.successful++;
        } else {
            results.failed++;
        }

        results.strategies.push({
            name: strategy.name,
            success,
        });
    }

    log(`\n${'='.repeat(80)}`);
    log('📈 BATCH OPTIMIZATION SUMMARY');
    log('='.repeat(80));
    log(`Total Strategies: ${results.total}`);
    log(`✅ Successful: ${results.successful}`);
    log(`❌ Failed: ${results.failed}`);

    if (results.failed === 0) {
        log('\n🎉 All optimizations completed successfully!');
        log('📁 Results saved in: ./results/optimizations/');
        log('📄 Next step: Run `node apply-optimized-params.mjs` to apply parameters');
    } else {
        log('\n⚠️  Some optimizations failed. Check logs above for details.');
    }

    process.exit(results.failed > 0 ? 1 : 0);
}

main();
