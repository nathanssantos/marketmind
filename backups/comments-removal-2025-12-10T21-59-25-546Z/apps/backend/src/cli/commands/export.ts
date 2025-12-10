import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { ResultManager, type SavedBacktestResult, type OptimizationSummary } from '../../services/backtesting/ResultManager';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { validateFilePath, ValidationError } from '../utils/validators';

interface ExportOptions {
  output?: string;
  verbose: boolean;
}

export async function exportCommand(inputFile: string, options: ExportOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    // Validate inputs
    if (!inputFile) {
      throw new ValidationError('No input file specified. Usage: export <input-file> --output <output-file>');
    }

    await validateFilePath(inputFile);

    logger.header(`EXPORT TO CSV`, {
      'Input': inputFile,
    });

    const spinner = ora({
      text: chalk.cyan('Loading result...'),
      color: 'cyan',
    }).start();

    // Load result
    const resultManager = new ResultManager();
    const result = await resultManager.load(inputFile);

    spinner.succeed(chalk.green('Result loaded'));

    // Determine output filename
    let outputPath: string;
    if (options.output) {
      outputPath = options.output;
    } else {
      // Auto-generate output filename
      const inputBasename = path.basename(inputFile, '.json');
      outputPath = path.join(
        path.dirname(inputFile),
        '../comparisons',
        `${inputBasename}.csv`
      );
    }

    // Export based on type
    const exportSpinner = ora({
      text: chalk.cyan('Exporting to CSV...'),
      color: 'cyan',
    }).start();

    if ('type' in result && result.type === 'validation') {
      await resultManager.exportToCSV(result as SavedBacktestResult, outputPath);
    } else {
      await resultManager.exportOptimizationToCSV(result as OptimizationSummary, outputPath);
    }

    exportSpinner.succeed(chalk.green(`Exported to: ${outputPath}`));
    console.log('');

    // Display preview
    if (options.verbose) {
      console.log(chalk.cyan.bold('CSV PREVIEW:'));
      console.log(chalk.gray('(First few lines)'));
      console.log('');

      const fs = await import('fs/promises');
      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.split('\n').slice(0, 10);
      for (const line of lines) {
        console.log(chalk.gray(line));
      }

      if (content.split('\n').length > 10) {
        console.log(chalk.gray('...'));
      }
      console.log('');
    }

    logger.success('Export completed successfully');

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Export failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}
