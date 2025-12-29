import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OPTIMIZATION_DIR = 'results/optimizations';
const STRATEGIES_DIR = 'strategies/builtin';

const strategies = [
  'bollinger-breakout-crypto',
  'elder-ray-crypto',
  'triple-confirmation-reversal',
  'percent-b-connors',
  'williams-momentum',
  'larry-williams-9-1',
  'larry-williams-9-2',
  'larry-williams-9-3',
  'larry-williams-9-4',
  'keltner-breakout-optimized',
  'tema-momentum',
  'ppo-momentum',
  'parabolic-sar-crypto',
  'supertrend-follow',
  'momentum-rotation',
  'momentum-breakout-2025'
];

for (const strategyId of strategies) {
  const optimizationFiles = readdirSync(OPTIMIZATION_DIR)
    .filter(f => f.startsWith(strategyId) && f.includes('2025-12-20') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (optimizationFiles.length === 0) {
    console.log(`No optimization found for ${strategyId}`);
    continue;
  }

  const dailyFile = optimizationFiles.find(f => f.includes('_1d_'));
  const file = dailyFile || optimizationFiles[0];

  const optPath = join(OPTIMIZATION_DIR, file);
  const opt = JSON.parse(readFileSync(optPath, 'utf-8'));

  if (!opt.statistics?.best?.params) {
    console.log(`No best params for ${strategyId}`);
    continue;
  }

  const bestParams = opt.statistics.best.params;
  const metrics = opt.statistics.best.metrics;

  if (metrics.totalPnlPercent <= 0) {
    console.log(`⏭ Skipping ${strategyId} - negative PnL: ${metrics.totalPnlPercent.toFixed(2)}%`);
    continue;
  }

  const strategyPath = join(STRATEGIES_DIR, `${strategyId}.json`);
  try {
    const strategy = JSON.parse(readFileSync(strategyPath, 'utf-8'));

    strategy.optimizedParams = {
      ...strategy.optimizedParams,
      maxPositionSize: bestParams.maxPositionSize,
      maxConcurrentPositions: bestParams.maxConcurrentPositions,
      maxTotalExposure: bestParams.maxTotalExposure,
      trailingATRMultiplier: bestParams.trailingATRMultiplier,
      breakEvenAfterR: bestParams.breakEvenAfterR,
    };

    writeFileSync(strategyPath, JSON.stringify(strategy, null, 2) + '\n');
    console.log(`✓ Updated ${strategyId}: PnL=${metrics.totalPnlPercent.toFixed(2)}%, WR=${metrics.winRate.toFixed(1)}%, PF=${metrics.profitFactor.toFixed(2)}`);
  } catch (e) {
    console.log(`File not found: ${strategyPath}`);
  }
}

console.log('\nDone! Optimized params applied to strategy files.');
