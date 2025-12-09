#!/usr/bin/env node
/**
 * Apply Optimized Parameters
 * 
 * Reads optimization results and updates strategy JSON files with the best parameters found.
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results/optimizations';
const STRATEGIES_DIR = './strategies/builtin';

function findLatestOptimizationResult(strategyName) {
    const files = fs.readdirSync(RESULTS_DIR)
        .filter(f => f.startsWith(strategyName) && f.endsWith('.json'))
        .map(f => ({
            name: f,
            path: path.join(RESULTS_DIR, f),
            time: fs.statSync(path.join(RESULTS_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    return files.length > 0 ? files[0].path : null;
}

function loadOptimizationResult(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

function loadStrategyFile(strategyName) {
    const filePath = path.join(STRATEGIES_DIR, `${strategyName}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

function saveStrategyFile(strategyName, strategy) {
    const filePath = path.join(STRATEGIES_DIR, `${strategyName}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(strategy, null, 2)}\n`, 'utf-8');
}

function applyOptimizedParameters(strategyName) {
    console.log(`\n🔄 Processing: ${strategyName}`);

    // Find latest optimization result
    const resultPath = findLatestOptimizationResult(strategyName);
    if (!resultPath) {
        console.log(`  ⚠️  No optimization results found`);
        return false;
    }

    // Load optimization result
    const optResult = loadOptimizationResult(resultPath);
    if (!optResult.topConfigurations || optResult.topConfigurations.length === 0) {
        console.log(`  ⚠️  No valid configurations found in results`);
        return false;
    }

    // Get best configuration (first in topConfigurations)
    const bestConfig = optResult.topConfigurations[0];
    console.log(`  📊 Best config: PF=${bestConfig.profitFactor}, WR=${bestConfig.winRate}, PnL=${bestConfig.totalPnlPercent}%`);

    // Load current strategy file
    const strategy = loadStrategyFile(strategyName);

    // Backup original optimizedParams
    if (!strategy._optimizationHistory) {
        strategy._optimizationHistory = [];
    }

    strategy._optimizationHistory.push({
        date: new Date().toISOString(),
        previousParams: { ...strategy.optimizedParams },
        backupParams: { ...strategy.parameters },
    });

    // Update parameters with optimized values
    Object.keys(bestConfig.parameters || {}).forEach(key => {
        if (strategy.parameters && strategy.parameters[key]) {
            // Update the default value in parameters definition
            strategy.parameters[key].default = bestConfig.parameters[key];
        }
    });

    // Update optimizedParams section
    strategy.optimizedParams = {
        ...strategy.optimizedParams,
        ...bestConfig.parameters,
        minConfidence: bestConfig.minConfidence || strategy.optimizedParams.minConfidence,
        maxPositionSize: bestConfig.maxPositionSize || strategy.optimizedParams.maxPositionSize,
        commission: bestConfig.commission || strategy.optimizedParams.commission,
    };

    // Add backtestSummary with optimization results
    strategy.backtestSummary = {
        period: `${optResult.config?.startDate} to ${optResult.config?.endDate}`,
        symbol: optResult.config?.symbol || 'BTCUSDT',
        interval: optResult.config?.interval || '1h',
        totalTrades: bestConfig.totalTrades,
        winRate: bestConfig.winRate,
        profitFactor: bestConfig.profitFactor,
        totalPnlPercent: bestConfig.totalPnlPercent,
        maxDrawdownPercent: bestConfig.maxDrawdownPercent,
        sharpeRatio: bestConfig.sharpeRatio,
        optimizedAt: new Date().toISOString(),
        configurationsTesteD: optResult.summary?.totalCombinations || 0,
    };

    // Save updated strategy
    saveStrategyFile(strategyName, strategy);
    console.log(`  ✅ Updated with optimized parameters`);

    return true;
}

function main() {
    console.log('\n📝 APPLY OPTIMIZED PARAMETERS\n');

    if (!fs.existsSync(RESULTS_DIR)) {
        console.error(`❌ Results directory not found: ${RESULTS_DIR}`);
        console.error('Please run batch-optimize.mjs first');
        process.exit(1);
    }

    // Get all optimization result files
    const resultFiles = fs.readdirSync(RESULTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/_BTCUSDT.*\.json$/, ''))
        .filter((v, i, a) => a.indexOf(v) === i); // unique

    console.log(`Found optimization results for ${resultFiles.length} strategies\n`);

    const results = {
        successful: [],
        failed: [],
        skipped: [],
    };

    for (const strategyName of resultFiles) {
        try {
            const success = applyOptimizedParameters(strategyName);
            if (success) {
                results.successful.push(strategyName);
            } else {
                results.skipped.push(strategyName);
            }
        } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
            results.failed.push(strategyName);
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Updated: ${results.successful.length}`);

    if (results.successful.length > 0) {
        results.successful.forEach(name => console.log(`  • ${name}`));
    }

    if (results.skipped.length > 0) {
        console.log(`\n⚠️  Skipped: ${results.skipped.length}`);
        results.skipped.forEach(name => console.log(`  • ${name}`));
    }

    if (results.failed.length > 0) {
        console.log(`\n❌ Failed: ${results.failed.length}`);
        results.failed.forEach(name => console.log(`  • ${name}`));
    }

    console.log('\n💡 Next steps:');
    console.log('  1. Review updated strategy files in strategies/builtin/');
    console.log('  2. Run validation backtests to confirm improvements');
    console.log('  3. Compare before/after performance\n');
}

main();
