import { TRADING_DEFAULTS } from '@marketmind/types';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateSymbol(symbol: string): string {
  if (!symbol || symbol.length < 5) {
    throw new ValidationError('Symbol must be at least 5 characters (e.g., BTCUSDT)');
  }

  if (!/^[A-Z]+USDT$/.test(symbol)) {
    throw new ValidationError('Symbol must end with USDT (e.g., BTCUSDT, ETHUSDT)');
  }

  return symbol;
}

export function validateInterval(interval: string): string {
  const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w'];

  if (!validIntervals.includes(interval)) {
    throw new ValidationError(
      `Invalid interval "${interval}". Valid intervals: ${validIntervals.join(', ')}`
    );
  }

  return interval;
}

export function validateDateRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(startDate)) {
    throw new ValidationError(`Invalid start date format "${startDate}". Use YYYY-MM-DD`);
  }

  if (!dateRegex.test(endDate)) {
    throw new ValidationError(`Invalid end date format "${endDate}". Use YYYY-MM-DD`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime())) {
    throw new ValidationError(`Invalid start date "${startDate}"`);
  }

  if (isNaN(end.getTime())) {
    throw new ValidationError(`Invalid end date "${endDate}"`);
  }

  if (start >= end) {
    throw new ValidationError('Start date must be before end date');
  }

  if (end > now) {
    throw new ValidationError('End date cannot be in the future');
  }

  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 7) {
    throw new ValidationError('Date range must be at least 7 days for meaningful results');
  }

  if (daysDiff > 365) {
    console.log(chalk.yellow('! Warning: Long date range (>1 year) may take significant time to process'));
  }

  return { startDate, endDate };
}

function getDynamicStrategies(): string[] {
  const strategiesDir = path.resolve(__dirname, '../../../strategies/builtin');

  try {
    const files = fs.readdirSync(strategiesDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export function validateStrategy(strategy: string): void {
  const legacyStrategies = [
    'pattern123',
    'bearTrap',
    'meanReversion',
  ];

  const dynamicStrategies = getDynamicStrategies();

  const validStrategies = [...legacyStrategies, ...dynamicStrategies];

  if (!validStrategies.includes(strategy)) {
    throw new ValidationError(
      `Invalid strategy "${strategy}". Valid strategies:\n` +
      `  Legacy:\n${legacyStrategies.map(s => `    - ${s}`).join('\n')}\n` +
      `  Dynamic:\n${dynamicStrategies.map(s => `    - ${s}`).join('\n')}`
    );
  }
}

export function validateNumeric(
  value: string,
  name: string,
  min?: number,
  max?: number
): number {
  const num = parseFloat(value);

  if (isNaN(num)) {
    throw new ValidationError(`${name} must be a valid number`);
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`${name} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`${name} must be at most ${max}`);
  }

  return num;
}

export function validateCapital(capital: string): number {
  const amount = validateNumeric(capital, 'Capital', 100, 1000000);

  if (amount < 100) {
    console.log(chalk.yellow('! Warning: Capital below $100 may produce unrealistic results'));
  }

  return amount;
}

export function validatePercentage(
  value: string,
  name: string,
  min: number = 0,
  max: number = 100
): number {
  return validateNumeric(value, name, min, max);
}

export function validateRiskReward(
  stopLoss: number | undefined,
  takeProfit: number | undefined,
  minRiskReward: number = TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO
): void {
  if (stopLoss === undefined || takeProfit === undefined) {
    return;
  }

  const riskReward = takeProfit / stopLoss;

  if (riskReward < minRiskReward) {
    throw new ValidationError(
      `Risk/Reward ratio (${riskReward.toFixed(2)}) is below recommended minimum (${minRiskReward}). ` +
      `Take profit (${takeProfit}%) should be at least ${minRiskReward}x stop loss (${stopLoss}%)`
    );
  }
}

export function validateParameterGrid(params: string[]): void {
  if (!params || params.length === 0) {
    throw new ValidationError('At least one parameter must be specified for optimization');
  }

  for (const param of params) {
    if (!param.includes('=')) {
      throw new ValidationError(
        `Invalid parameter format "${param}". Use: --param name=val1,val2,val3`
      );
    }

    const [name, values] = param.split('=');

    if (!name || !values) {
      throw new ValidationError(
        `Invalid parameter format "${param}". Use: --param name=val1,val2,val3`
      );
    }

    const valueArray = values.split(',').map(v => v.trim());

    if (valueArray.length < 2) {
      throw new ValidationError(
        `Parameter "${name}" must have at least 2 values for optimization`
      );
    }

    for (const value of valueArray) {
      if (isNaN(parseFloat(value))) {
        throw new ValidationError(
          `Parameter "${name}" contains invalid value "${value}". All values must be numeric.`
        );
      }
    }
  }
}

export async function validateFilePath(filepath: string): Promise<void> {
  const fs = await import('fs/promises');

  try {
    await fs.access(filepath);
  } catch {
    throw new ValidationError(`File not found: ${filepath}`);
  }

  const stats = await fs.stat(filepath);

  if (!stats.isFile()) {
    throw new ValidationError(`Path is not a file: ${filepath}`);
  }

  if (!filepath.endsWith('.json')) {
    console.log(chalk.yellow(`! Warning: File "${filepath}" does not have .json extension`));
  }
}

export function validateParallelWorkers(workers: string): number {
  const count = validateNumeric(workers, 'Parallel workers', 1, 16);

  if (count > 8) {
    console.log(chalk.yellow('! Warning: High worker count (>8) may not improve performance'));
  }

  return count;
}

export function validateGridSearchSize(params: string[]): void {
  let totalCombinations = 1;

  for (const param of params) {
    const [, values] = param.split('=');
    if (!values) continue;
    const valueArray = values.split(',');
    totalCombinations *= valueArray.length;
  }

  if (totalCombinations > 1000) {
    console.log(
      chalk.yellow(`! Warning: Grid search will test ${totalCombinations} combinations.`)
    );
    console.log(chalk.yellow('   This may take a very long time. Consider reducing parameter ranges.'));
  } else if (totalCombinations > 500) {
    console.log(
      chalk.yellow(`! Note: Grid search will test ${totalCombinations} combinations.`)
    );
  }
}
