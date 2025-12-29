import chalk from 'chalk';
import { execSync } from 'child_process';

const TEST_START_DATE = '2024-01-01';
const TEST_END_DATE = '2024-12-01';

function formatPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const years = Math.floor(months / 12);
  
  if (years >= 2) {
    const remainingMonths = months % 12;
    return remainingMonths > 0 
      ? `${years} anos e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`
      : `${years} anos`;
  } else if (months >= 1) {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else {
    return `${diffDays} dias`;
  }
}

console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan.bold('║         MARKETMIND - STRATEGY VALIDATION TEST                  ║'));
console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
console.log(chalk.gray(`Test period: ${TEST_START_DATE} to ${TEST_END_DATE} (${formatPeriod(TEST_START_DATE, TEST_END_DATE)})\n`));

const strategies = ['pivot-points-crypto', 'dema-crossover-crypto', 'ema9-21-rsi-confirmation'];

for (const strategy of strategies) {
  console.log(chalk.gray(`Testing: ${strategy}`));
  try {
    execSync(
      `pnpm exec tsx src/cli/backtest-runner.ts validate -s ${strategy} --symbol BTCUSDT -i 1d --start ${TEST_START_DATE} --end ${TEST_END_DATE} --optimized`,
      { stdio: 'ignore', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
    );
    console.log(chalk.green(`  ✓ ${strategy} passed\n`));
  } catch (error) {
    console.log(chalk.red(`  ✗ ${strategy} failed\n`));
  }
}

console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan.bold('║                       STATISTICS                               ║'));
console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));
console.log(chalk.gray(`Test period: ${TEST_START_DATE} to ${TEST_END_DATE} (${formatPeriod(TEST_START_DATE, TEST_END_DATE)})\n`));
