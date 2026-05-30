import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import { MonteCarloSimulator } from '../services/backtesting/MonteCarloSimulator';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const INITIAL_CAPITAL = 1000;

async function validateRobustness() {
  console.log('═'.repeat(70));
  console.log('> ROBUSTNESS VALIDATION - WALK-FORWARD & MONTE CARLO');
  console.log('═'.repeat(70));
  console.log('');
  console.log('> OPTIMIZED CONFIGURATION:');
  console.log('   • Entry Level Fibo: 100% (breakout)');
  console.log('   • BTC Correlation Filter: ON');
  console.log('   • Volume Filter: ON');
  console.log('   • Momentum Timing Filter: ON');
  console.log('   • Trailing LONG: Activation 90%, Distance 40%');
  console.log('   • Trailing SHORT: Activation 80%, Distance 30%');
  console.log('   • Timeframe: 12h');
  console.log('');

  console.log('═'.repeat(70));
  console.log('> PART 1: FULL BACKTEST (3 years)');
  console.log('═'.repeat(70));
  console.log('');

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
    useMomentumTimingFilter: true,
    useTrendFilter: false,
    useAdxFilter: false,
    silent: true,
  });

  console.log('> Running backtest...\n');
  const result = await engine.run();

  console.log('━'.repeat(70));
  console.log('BACKTEST RESULTS');
  console.log('━'.repeat(70));
  console.log(`Total Trades:     ${result.metrics.totalTrades}`);
  console.log(`Total P&L:        $${result.metrics.totalPnl.toFixed(2)} (${result.metrics.totalPnlPercent.toFixed(1)}%)`);
  console.log(`Win Rate:         ${result.metrics.winRate.toFixed(1)}%`);
  console.log(`Max Drawdown:     ${result.metrics.maxDrawdownPercent.toFixed(1)}%`);
  console.log(`Profit Factor:    ${(result.metrics.profitFactor ?? 0).toFixed(2)}`);
  console.log('');

  if (result.trades.length < 10) {
    console.log('!  Too few trades for Monte Carlo (minimum 10). Skipping simulation.');
    process.exit(0);
  }

  console.log('═'.repeat(70));
  console.log('> PART 2: MONTE CARLO SIMULATION (1000 iterations)');
  console.log('═'.repeat(70));
  console.log('');

  console.log('> Running Monte Carlo simulation...\n');

  const mcResult = MonteCarloSimulator.simulate(result.trades, INITIAL_CAPITAL, {
    numSimulations: 1000,
    confidenceLevel: 0.95,
  });

  console.log('━'.repeat(70));
  console.log('MONTE CARLO STATISTICS');
  console.log('━'.repeat(70));
  console.log('');
  console.log('> Final Equity:');
  console.log(`   Mean:   $${mcResult.statistics.meanFinalEquity.toFixed(2)}`);
  console.log(`   Median: $${mcResult.statistics.medianFinalEquity.toFixed(2)}`);
  console.log(`   StdDev: $${mcResult.statistics.stdDevFinalEquity.toFixed(2)}`);
  console.log('');
  console.log('> Max Drawdown:');
  console.log(`   Mean:   ${(mcResult.statistics.meanMaxDrawdown * 100).toFixed(1)}%`);
  console.log(`   Median: ${(mcResult.statistics.medianMaxDrawdown * 100).toFixed(1)}%`);
  console.log('');
  console.log('> Total Return:');
  console.log(`   Mean:   ${(mcResult.statistics.meanTotalReturn * 100).toFixed(1)}%`);
  console.log(`   Median: ${(mcResult.statistics.medianTotalReturn * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('CONFIDENCE INTERVALS (95%)');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`Final Equity:  $${mcResult.confidenceIntervals.finalEquity.lower.toFixed(2)} - $${mcResult.confidenceIntervals.finalEquity.upper.toFixed(2)}`);
  console.log(`Max Drawdown:  ${(mcResult.confidenceIntervals.maxDrawdown.lower * 100).toFixed(1)}% - ${(mcResult.confidenceIntervals.maxDrawdown.upper * 100).toFixed(1)}%`);
  console.log(`Return:        ${(mcResult.confidenceIntervals.totalReturn.lower * 100).toFixed(1)}% - ${(mcResult.confidenceIntervals.totalReturn.upper * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('PROBABILITIES');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`Profitable:             ${(mcResult.probabilities.profitableProbability * 100).toFixed(1)}%`);
  console.log(`Return > 10%:           ${(mcResult.probabilities.returnExceeds10Percent * 100).toFixed(1)}%`);
  console.log(`Return > 20%:           ${(mcResult.probabilities.returnExceeds20Percent * 100).toFixed(1)}%`);
  console.log(`Return > 50%:           ${(mcResult.probabilities.returnExceeds50Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 10%:         ${(mcResult.probabilities.drawdownExceeds10Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 20%:         ${(mcResult.probabilities.drawdownExceeds20Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 30%:         ${(mcResult.probabilities.drawdownExceeds30Percent * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('EXTREME SCENARIOS');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`✗ Worst Case:  Equity $${mcResult.worstCase.finalEquity.toFixed(2)} | DD ${(mcResult.worstCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.worstCase.totalReturn * 100).toFixed(1)}%`);
  console.log(`~ Median:      Equity $${mcResult.medianCase.finalEquity.toFixed(2)} | DD ${(mcResult.medianCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.medianCase.totalReturn * 100).toFixed(1)}%`);
  console.log(`✓ Best Case:   Equity $${mcResult.bestCase.finalEquity.toFixed(2)} | DD ${(mcResult.bestCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.bestCase.totalReturn * 100).toFixed(1)}%`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('✓ ROBUSTNESS VALIDATION');
  console.log('═'.repeat(70));
  console.log('');

  const isRobust =
    mcResult.probabilities.profitableProbability >= 0.9 &&
    mcResult.confidenceIntervals.maxDrawdown.upper <= 0.5 &&
    mcResult.statistics.medianTotalReturn > 0.5;

  const checks = [
    {
      name: 'Profitable Prob. >= 90%',
      pass: mcResult.probabilities.profitableProbability >= 0.9,
      value: `${(mcResult.probabilities.profitableProbability * 100).toFixed(1)}%`,
    },
    {
      name: 'CI95 Drawdown <= 50%',
      pass: mcResult.confidenceIntervals.maxDrawdown.upper <= 0.5,
      value: `${(mcResult.confidenceIntervals.maxDrawdown.upper * 100).toFixed(1)}%`,
    },
    {
      name: 'Median Return > 50%',
      pass: mcResult.statistics.medianTotalReturn > 0.5,
      value: `${(mcResult.statistics.medianTotalReturn * 100).toFixed(1)}%`,
    },
    {
      name: 'Worst Case Profitable',
      pass: mcResult.worstCase.finalEquity > INITIAL_CAPITAL,
      value: `$${mcResult.worstCase.finalEquity.toFixed(2)}`,
    },
  ];

  for (const check of checks) {
    console.log(`${check.pass ? '✓' : '✗'} ${check.name}: ${check.value}`);
  }

  console.log('');
  if (isRobust) {
    console.log('✓ ROBUST CONFIGURATION - Approved for production!');
  } else {
    console.log('!  CONFIGURATION NEEDS ADJUSTMENTS - Review parameters');
  }

  process.exit(0);
}

validateRobustness().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
