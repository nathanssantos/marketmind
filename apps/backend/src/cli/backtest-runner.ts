#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { benchmarkCommand } from './commands/benchmark';
import { compareCommand } from './commands/compare';
import { exportCommand } from './commands/export';
import { generateTrainingDataCommand } from './commands/generate-training-data';
import { montecarloCommand } from './commands/montecarlo';
import { optimizeCommand } from './commands/optimize';
import { sensitivityCommand } from './commands/sensitivity';
import { validateCommand } from './commands/validate';
import { walkforwardCommand } from './commands/walkforward';

const program = new Command();

program
  .name('backtest')
  .description('CLI tool for running and optimizing trading strategy backtests')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate a trading strategy with detailed backtest')
  .requiredOption('-s, --strategy <type>', 'Strategy to test (e.g., setup91, setup92, bullTrap)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--stop-loss <percent>', 'Stop loss % (optional override, default: strategy calculates via ATR)')
  .option('--take-profit <percent>', 'Take profit % (optional override, default: strategy calculates via ATR)')
  .option('--min-confidence <level>', 'Min confidence 0-100 (optional override, default: from strategy optimizedParams)')
  .option('--max-position <percent>', 'Max position % of capital (optional override, default: from strategy optimizedParams)')
  .option('--max-concurrent <n>', 'Max concurrent positions (default: 5)')
  .option('--max-exposure <percent>', 'Max total exposure % (default: 50)')
  .option('--position-method <method>', 'Position sizing: fixed-fractional, risk-based, kelly, volatility-based', 'fixed-fractional')
  .option('--risk-per-trade <percent>', 'Risk per trade as % of equity (for risk-based method)', '2')
  .option('--kelly-fraction <fraction>', 'Kelly fraction multiplier (0-1, for kelly method)', '0.25')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP instead of fixed percentages', false)
  .option('--with-trend', 'Enable EMA200 trend filter (only trade with trend)', false)
  .option('--trailing-stop', 'Use trailing stop instead of fixed take profit (let winners run)', false)
  .option('--optimized', 'Use strategy\'s optimized parameters (position size, trend filter, etc.)', false)
  .option('-v, --verbose', 'Show detailed trade-by-trade logs', false)
  .action(validateCommand);

program
  .command('optimize')
  .description('Optimize strategy parameters via grid search')
  .requiredOption('-s, --strategy <type>', 'Strategy to optimize (e.g., setup91, setup92)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--param <param>', 'Parameter to optimize (format: name=val1,val2,val3)', (value, previous) => {
    return previous ? [...previous, value] : [value];
  }, [] as string[])
  .option('--preset <name>', 'Optimization preset: conservative, balanced, aggressive, trendfollowing')
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--stop-loss <percent>', 'Stop loss % (optional override, default: strategy calculates via ATR)')
  .option('--take-profit <percent>', 'Take profit % (optional override, default: strategy calculates via ATR)')
  .option('--min-confidence <level>', 'Min confidence 0-100 (optional override, default: from strategy optimizedParams)')
  .option('--max-position <percent>', 'Max position % of capital (optional override, default: from strategy optimizedParams)')
  .option('--max-concurrent <n>', 'Max concurrent positions (default: 5)')
  .option('--max-exposure <percent>', 'Max total exposure % (default: 50)')
  .option('--trailing-stop', 'Use trailing stop instead of fixed take profit', false)
  .option('--position-method <method>', 'Position sizing: fixed-fractional, risk-based, kelly, volatility-based', 'fixed-fractional')
  .option('--risk-per-trade <percent>', 'Risk per trade as % of equity (for risk-based method)', '2')
  .option('--kelly-fraction <fraction>', 'Kelly fraction multiplier (0-1, for kelly method)', '0.25')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP', false)
  .option('--with-trend', 'Enable EMA200 trend filter (only trade with trend)', false)
  .option('--sort-by <metric>', 'Metric to sort by', 'totalPnlPercent')
  .option('--top <n>', 'Number of top results to display', '10')
  .option('--parallel <n>', 'Number of parallel workers', '4')
  .option('--min-win-rate <percent>', 'Filter results by minimum win rate')
  .option('--min-profit-factor <value>', 'Filter results by minimum profit factor')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(optimizeCommand);

program
  .command('compare')
  .description('Compare multiple backtest results')
  .argument('<files...>', 'Result files to compare (JSON format)')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action((files, options) => {
    compareCommand(files, options);
  });

program
  .command('export')
  .description('Export backtest results to CSV')
  .argument('<file>', 'Result file to export (JSON format)')
  .option('-o, --output <path>', 'Output CSV file path')
  .option('-v, --verbose', 'Show detailed logs and CSV preview', false)
  .action((file, options) => {
    exportCommand(file, options);
  });

program
  .command('walkforward')
  .description('Run walk-forward analysis to validate strategy robustness')
  .requiredOption('-s, --strategy <type>', 'Strategy to test (e.g., setup91, setup92)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .requiredOption('--param <param>', 'Parameter to optimize (format: name=val1,val2,val3)', (value, previous) => {
    return previous ? [...previous, value] : [value];
  }, [] as string[])
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--min-confidence <level>', 'Minimum confidence level (0-100, default: strategy optimizedParams)')
  .option('--max-position <percent>', 'Maximum position size as % of capital (default: strategy optimizedParams)')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP', false)
  .option('--with-trend', 'Enable EMA200 trend filter (only trade with trend)', false)
  .option('--training-months <n>', 'Training window size in months', '6')
  .option('--testing-months <n>', 'Testing window size in months', '2')
  .option('--step-months <n>', 'Step size for moving windows in months', '2')
  .option('-v, --verbose', 'Show detailed logs including all windows', false)
  .action(walkforwardCommand);

program
  .command('montecarlo')
  .description('Run Monte Carlo simulation for statistical analysis')
  .requiredOption('-s, --strategy <type>', 'Strategy to test (e.g., setup91, setup92)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--stop-loss <percent>', 'Stop loss percentage (default: strategy calculated via ATR)')
  .option('--take-profit <percent>', 'Take profit percentage (default: strategy calculated via ATR)')
  .option('--min-confidence <level>', 'Minimum confidence level (0-100, default: strategy optimizedParams)')
  .option('--max-position <percent>', 'Maximum position size as % of capital (default: strategy optimizedParams)')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP', false)
  .option('--with-trend', 'Enable EMA200 trend filter (only trade with trend)', false)
  .option('--simulations <n>', 'Number of Monte Carlo simulations (100-100000)', '1000')
  .option('--confidence-level <level>', 'Confidence level (0.80-0.99)', '0.95')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(montecarloCommand);

program
  .command('sensitivity')
  .description('Analyze parameter sensitivity to detect over-optimization')
  .requiredOption('-s, --strategy <type>', 'Strategy to test (e.g., setup91, setup92)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .requiredOption('--param <param>', 'Parameter to analyze (format: name=val1,val2,val3)', (value, previous) => {
    return previous ? [...previous, value] : [value];
  }, [] as string[])
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--min-confidence <level>', 'Minimum confidence level (0-100, default: strategy optimizedParams)')
  .option('--max-position <percent>', 'Maximum position size as % of capital (default: strategy optimizedParams)')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP', false)
  .option('--with-trend', 'Enable EMA200 trend filter (only trade with trend)', false)
  .option('--metric <metric>', 'Metric to analyze (sharpeRatio, totalReturn, profitFactor, winRate)', 'sharpeRatio')
  .option('-v, --verbose', 'Show detailed parameter-by-parameter results', false)
  .action(sensitivityCommand);

program
  .command('benchmark')
  .description('Run benchmark validation suite against industry-known strategies')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('-s, --strategy <type>', 'Run specific strategy benchmark only')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(benchmarkCommand);

program
  .command('generate-training')
  .description('Generate ML training data from backtest results')
  .requiredOption('--symbols <symbols>', 'Comma-separated symbols (e.g., BTCUSDT,ETHUSDT,SOLUSDT)')
  .requiredOption('--intervals <intervals>', 'Comma-separated intervals (e.g., 1h,4h,1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--strategies <strategies>', 'Comma-separated strategies (default: top 10 optimized)')
  .option('-o, --output <path>', 'Output file path', '../../packages/ml/data/training_data.csv')
  .option('--min-trades <n>', 'Minimum trades per strategy/symbol/interval combo', '5')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(generateTrainingDataCommand);

program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('\n✗ Error:'), error.message);
    process.exit(1);
  }
}

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
