#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { validateCommand } from './commands/validate';
import { optimizeCommand } from './commands/optimize';
import { compareCommand } from './commands/compare';
import { exportCommand } from './commands/export';

const program = new Command();

program
  .name('backtest')
  .description('CLI tool for running and optimizing trading strategy backtests')
  .version('1.0.0');

// Validate command
program
  .command('validate')
  .description('Validate a trading strategy with detailed backtest')
  .requiredOption('-s, --strategy <type>', 'Strategy to test (e.g., setup91, setup92, bullTrap)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--stop-loss <percent>', 'Stop loss percentage', '2')
  .option('--take-profit <percent>', 'Take profit percentage', '6')
  .option('--min-confidence <level>', 'Minimum confidence level (0-100)', '70')
  .option('--max-position <percent>', 'Maximum position size as % of capital', '10')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP instead of fixed percentages', false)
  .option('--only-with-trend', 'Only trade setups aligned with EMA200 trend', true)
  .option('-v, --verbose', 'Show detailed trade-by-trade logs', false)
  .action(validateCommand);

// Optimize command
program
  .command('optimize')
  .description('Optimize strategy parameters via grid search')
  .requiredOption('-s, --strategy <type>', 'Strategy to optimize (e.g., setup91, setup92)')
  .requiredOption('--symbol <symbol>', 'Trading symbol (e.g., BTCUSDT, ETHUSDT, SOLUSDT)')
  .requiredOption('-i, --interval <interval>', 'Timeframe (e.g., 1h, 4h, 1d)')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .requiredOption('--param <param>', 'Parameter to optimize (format: name=val1,val2,val3)', (value, previous) => {
    return previous ? [...previous, value] : [value];
  }, [] as string[])
  .option('-c, --capital <amount>', 'Initial capital in USD', '1000')
  .option('--min-confidence <level>', 'Minimum confidence level (0-100)')
  .option('--max-position <percent>', 'Maximum position size as % of capital', '10')
  .option('--commission <percent>', 'Trading commission percentage', '0.1')
  .option('--use-algorithmic-levels', 'Use strategy\'s calculated SL/TP', false)
  .option('--only-with-trend', 'Only trade setups aligned with EMA200 trend', true)
  .option('--sort-by <metric>', 'Metric to sort by', 'totalPnlPercent')
  .option('--top <n>', 'Number of top results to display', '10')
  .option('--parallel <n>', 'Number of parallel workers', '4')
  .option('--min-win-rate <percent>', 'Filter results by minimum win rate')
  .option('--min-profit-factor <value>', 'Filter results by minimum profit factor')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(optimizeCommand);

// Compare command
program
  .command('compare')
  .description('Compare multiple backtest results')
  .argument('<files...>', 'Result files to compare (JSON format)')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action((files, options) => {
    compareCommand(files, options);
  });

// Export command
program
  .command('export')
  .description('Export backtest results to CSV')
  .argument('<file>', 'Result file to export (JSON format)')
  .option('-o, --output <path>', 'Output CSV file path')
  .option('-v, --verbose', 'Show detailed logs and CSV preview', false)
  .action((file, options) => {
    exportCommand(file, options);
  });

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('\n✗ Error:'), error.message);
    process.exit(1);
  }
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
