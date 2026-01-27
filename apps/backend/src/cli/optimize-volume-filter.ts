import 'dotenv/config';

process.env.LOG_LEVEL = 'error';
process.env.PINO_LOG_LEVEL = 'error';

import type { VolumeFilterConfig } from '@marketmind/types';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  createBaseConfig,
  parseCliArgs,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
  type DirectionalMetrics,
} from './shared-backtest-config';
import * as fs from 'fs';

interface DirectionalConfig {
  breakoutMultiplier: number;
  pullbackMultiplier: number;
  useObvCheck: boolean;
  obvLookback: number;
}

interface PhaseResult {
  config: DirectionalConfig;
  pnl: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

interface CombinedResult {
  longConfig: DirectionalConfig;
  shortConfig: DirectionalConfig;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  longMetrics: DirectionalMetrics;
  shortMetrics: DirectionalMetrics;
}

const PARAM_GRID = {
  breakoutMultiplier: [0, 0.5, 1.0, 1.5, 2.0, 2.5],
  pullbackMultiplier: [0, 0.5, 1.0, 1.5],
  useObvCheck: [true, false],
  obvLookback: [3, 5, 7],
};

const generateCombinations = (): DirectionalConfig[] => {
  const combinations: DirectionalConfig[] = [];

  for (const breakoutMultiplier of PARAM_GRID.breakoutMultiplier) {
    for (const pullbackMultiplier of PARAM_GRID.pullbackMultiplier) {
      for (const useObvCheck of PARAM_GRID.useObvCheck) {
        if (useObvCheck) {
          for (const obvLookback of PARAM_GRID.obvLookback) {
            combinations.push({ breakoutMultiplier, pullbackMultiplier, useObvCheck, obvLookback });
          }
        } else {
          combinations.push({ breakoutMultiplier, pullbackMultiplier, useObvCheck, obvLookback: 5 });
        }
      }
    }
  }

  return combinations;
};

const formatConfig = (config: DirectionalConfig): string => {
  const obv = config.useObvCheck ? `ON lb=${config.obvLookback}` : 'OFF';
  return `brk=${config.breakoutMultiplier} pb=${config.pullbackMultiplier} OBV=${obv}`;
};

const formatConfigShort = (config: DirectionalConfig): string => {
  const obv = config.useObvCheck ? `${config.obvLookback}` : '-';
  return `${config.breakoutMultiplier.toFixed(1).padStart(4)}  ${config.pullbackMultiplier.toFixed(1).padStart(4)}  ${config.useObvCheck ? 'ON ' : 'OFF'}  ${obv.padStart(3)}`;
};

const printProgress = (current: number, total: number, startTime: number) => {
  const percent = (current / total) * 100;
  const elapsed = (Date.now() - startTime) / 1000;
  const eta = current > 0 ? ((elapsed / current) * (total - current)) : 0;
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r⏳ [${bar}] ${current}/${total} (${percent.toFixed(0)}%) ETA: ${eta.toFixed(0)}s    `);
};

async function runPhase1(
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  baseConfig: ReturnType<typeof createBaseConfig>,
  watchers: WatcherConfig[]
): Promise<PhaseResult[]> {
  console.log('\n' + '═'.repeat(80));
  console.log('📈 PHASE 1: LONG OPTIMIZATION');
  console.log('═'.repeat(80) + '\n');

  const combinations = generateCombinations();
  console.log(`Testing ${combinations.length} combinations...\n`);

  const results: PhaseResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < combinations.length; i++) {
    const config = combinations[i]!;
    printProgress(i + 1, combinations.length, startTime);

    const volumeFilterConfig: VolumeFilterConfig = {
      longConfig: {
        breakoutMultiplier: config.breakoutMultiplier,
        pullbackMultiplier: config.pullbackMultiplier,
        useObvCheck: config.useObvCheck,
        obvLookback: config.obvLookback,
      },
    };

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      watchers,
      startDate,
      endDate,
      useVolumeFilter: true,
      volumeFilterConfig,
    });

    const result = await engine.run();
    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const metrics = calculateDirectionalMetrics(longTrades);

    results.push({
      config,
      pnl: metrics.pnl,
      trades: metrics.trades,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
    });
  }

  console.log('\n');
  return results.sort((a, b) => b.pnl - a.pnl);
}

async function runPhase2(
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  baseConfig: ReturnType<typeof createBaseConfig>,
  watchers: WatcherConfig[]
): Promise<PhaseResult[]> {
  console.log('\n' + '═'.repeat(80));
  console.log('📉 PHASE 2: SHORT OPTIMIZATION');
  console.log('═'.repeat(80) + '\n');

  const combinations = generateCombinations();
  console.log(`Testing ${combinations.length} combinations...\n`);

  const results: PhaseResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < combinations.length; i++) {
    const config = combinations[i]!;
    printProgress(i + 1, combinations.length, startTime);

    const volumeFilterConfig: VolumeFilterConfig = {
      shortConfig: {
        breakoutMultiplier: config.breakoutMultiplier,
        pullbackMultiplier: config.pullbackMultiplier,
        useObvCheck: config.useObvCheck,
        obvLookback: config.obvLookback,
      },
    };

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      watchers,
      startDate,
      endDate,
      useVolumeFilter: true,
      volumeFilterConfig,
    });

    const result = await engine.run();
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const metrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      config,
      pnl: metrics.pnl,
      trades: metrics.trades,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
    });
  }

  console.log('\n');
  return results.sort((a, b) => b.pnl - a.pnl);
}

async function runPhase3(
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  baseConfig: ReturnType<typeof createBaseConfig>,
  watchers: WatcherConfig[],
  topLong: PhaseResult[],
  topShort: PhaseResult[]
): Promise<CombinedResult[]> {
  console.log('\n' + '═'.repeat(80));
  console.log('🏆 PHASE 3: FINAL COMBINATION (Top 10 LONG × Top 10 SHORT)');
  console.log('═'.repeat(80) + '\n');

  const totalCombinations = topLong.length * topShort.length;
  console.log(`Testing ${totalCombinations} combinations...\n`);

  const results: CombinedResult[] = [];
  const startTime = Date.now();
  let counter = 0;

  for (const longResult of topLong) {
    for (const shortResult of topShort) {
      counter++;
      printProgress(counter, totalCombinations, startTime);

      const volumeFilterConfig: VolumeFilterConfig = {
        longConfig: {
          breakoutMultiplier: longResult.config.breakoutMultiplier,
          pullbackMultiplier: longResult.config.pullbackMultiplier,
          useObvCheck: longResult.config.useObvCheck,
          obvLookback: longResult.config.obvLookback,
        },
        shortConfig: {
          breakoutMultiplier: shortResult.config.breakoutMultiplier,
          pullbackMultiplier: shortResult.config.pullbackMultiplier,
          useObvCheck: shortResult.config.useObvCheck,
          obvLookback: shortResult.config.obvLookback,
        },
      };

      const engine = new MultiWatcherBacktestEngine({
        ...baseConfig,
        watchers,
        startDate,
        endDate,
        useVolumeFilter: true,
        volumeFilterConfig,
      });

      const result = await engine.run();
      const longTrades = result.trades.filter(t => t.side === 'LONG');
      const shortTrades = result.trades.filter(t => t.side === 'SHORT');
      const longMetrics = calculateDirectionalMetrics(longTrades);
      const shortMetrics = calculateDirectionalMetrics(shortTrades);

      results.push({
        longConfig: longResult.config,
        shortConfig: shortResult.config,
        totalPnl: result.metrics.totalPnl,
        totalPnlPercent: result.metrics.totalPnlPercent,
        totalTrades: result.metrics.totalTrades,
        winRate: result.metrics.winRate,
        profitFactor: result.metrics.profitFactor,
        maxDrawdown: result.metrics.maxDrawdownPercent,
        longMetrics,
        shortMetrics,
      });
    }
  }

  console.log('\n');
  return results.sort((a, b) => b.totalPnl - a.totalPnl);
}

function printPhaseResults(results: PhaseResult[], title: string, limit: number = 10) {
  console.log(`\n${title} (by P&L):`);
  console.log('Rank  Breakout  Pullback  OBV  Lookback      P&L    Trades   WinRate      PF');
  console.log('─'.repeat(82));

  const topResults = results.slice(0, limit);
  for (let i = 0; i < topResults.length; i++) {
    const r = topResults[i]!;
    const rank = String(i + 1).padStart(2);
    const pnl = `$${formatCurrency(r.pnl)}`.padStart(10);
    const trades = String(r.trades).padStart(6);
    const wr = formatPercent(r.winRate).padStart(8);
    const pf = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const marker = i === 0 ? '🏆' : '  ';

    console.log(`${marker}${rank}  ${formatConfigShort(r.config)}  ${pnl}  ${trades}  ${wr}  ${pf}`);
  }
  console.log('─'.repeat(82));
}

function printCombinedResults(results: CombinedResult[], limit: number = 10) {
  console.log('\nTOP 10 DIRECTIONAL CONFIGURATIONS (by TOTAL P&L):');
  console.log('Rank  LONG Config                    SHORT Config                   Total P&L    MaxDD');
  console.log('─'.repeat(100));

  const topResults = results.slice(0, limit);
  for (let i = 0; i < topResults.length; i++) {
    const r = topResults[i]!;
    const rank = String(i + 1).padStart(2);
    const longConf = formatConfig(r.longConfig).padEnd(28);
    const shortConf = formatConfig(r.shortConfig).padEnd(28);
    const pnl = `$${formatCurrency(r.totalPnl)}`.padStart(10);
    const dd = formatPercent(r.maxDrawdown).padStart(7);
    const marker = i === 0 ? '🏆' : '  ';

    console.log(`${marker}${rank}  ${longConf}  ${shortConf}  ${pnl}  ${dd}`);
  }
  console.log('─'.repeat(100));
}

async function runOptimization() {
  console.log('🔬 Volume Filter Optimization - Directional Grid Search');
  console.log('========================================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const baseConfig = createBaseConfig();

  const watchers: WatcherConfig[] = [
    {
      symbol,
      interval,
      marketType: 'FUTURES',
      setupTypes: [...ENABLED_SETUPS],
    },
  ];

  console.log(`📊 Symbol: ${symbol}@${interval} (FUTURES)`);
  console.log(`📅 Period: ${startDate} to ${endDate}`);
  console.log(`🔢 Grid: breakout=[${PARAM_GRID.breakoutMultiplier.join(',')}] pullback=[${PARAM_GRID.pullbackMultiplier.join(',')}]`);
  console.log(`        OBV=[true,false] lookback=[${PARAM_GRID.obvLookback.join(',')}]`);

  const phase1Results = await runPhase1(symbol, interval, startDate, endDate, baseConfig, watchers);
  printPhaseResults(phase1Results, 'TOP 10 LONG CONFIGURATIONS');

  const phase2Results = await runPhase2(symbol, interval, startDate, endDate, baseConfig, watchers);
  printPhaseResults(phase2Results, 'TOP 10 SHORT CONFIGURATIONS');

  const topLong = phase1Results.slice(0, 10);
  const topShort = phase2Results.slice(0, 10);

  const phase3Results = await runPhase3(symbol, interval, startDate, endDate, baseConfig, watchers, topLong, topShort);
  printCombinedResults(phase3Results);

  const best = phase3Results[0]!;
  console.log('\n' + '═'.repeat(80));
  console.log('🏆 BEST CONFIGURATION FOUND');
  console.log('═'.repeat(80) + '\n');

  console.log(`LONG:  breakout=${best.longConfig.breakoutMultiplier}, pullback=${best.longConfig.pullbackMultiplier}, OBV=${best.longConfig.useObvCheck ? 'ON' : 'OFF'}${best.longConfig.useObvCheck ? `, lookback=${best.longConfig.obvLookback}` : ''}`);
  console.log(`SHORT: breakout=${best.shortConfig.breakoutMultiplier}, pullback=${best.shortConfig.pullbackMultiplier}, OBV=${best.shortConfig.useObvCheck ? 'ON' : 'OFF'}${best.shortConfig.useObvCheck ? `, lookback=${best.shortConfig.obvLookback}` : ''}`);
  console.log('');
  console.log(`Total P&L: $${formatCurrency(best.totalPnl)} (${formatPercent(best.totalPnlPercent)})`);
  console.log(`Win Rate: ${formatPercent(best.winRate)}`);
  console.log(`Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`Max Drawdown: ${formatPercent(best.maxDrawdown)}`);
  console.log(`Total Trades: ${best.totalTrades} (LONG: ${best.longMetrics.trades}, SHORT: ${best.shortMetrics.trades})`);

  const outputFile = `./volume-optimization-${symbol}-${interval}-${new Date().toISOString().split('T')[0]}.json`;
  const outputData = {
    symbol,
    interval,
    startDate,
    endDate,
    paramGrid: PARAM_GRID,
    phase1Results: phase1Results.slice(0, 20),
    phase2Results: phase2Results.slice(0, 20),
    phase3Results: phase3Results.slice(0, 20),
    bestConfig: {
      long: best.longConfig,
      short: best.shortConfig,
      metrics: {
        totalPnl: best.totalPnl,
        totalPnlPercent: best.totalPnlPercent,
        winRate: best.winRate,
        profitFactor: best.profitFactor,
        maxDrawdown: best.maxDrawdown,
        totalTrades: best.totalTrades,
        longTrades: best.longMetrics.trades,
        shortTrades: best.shortMetrics.trades,
      },
    },
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  process.exit(0);
}

runOptimization().catch(console.error);
