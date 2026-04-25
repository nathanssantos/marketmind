import { parseArgs } from 'util';
import { and, eq, gte, lte, asc } from 'drizzle-orm';
import type { Interval, Kline, MarketType } from '@marketmind/types';
import { db } from '../db';
import { klines as klinesTable } from '../db/schema';
import { backfillHistoricalKlines } from '../services/binance-historical';
import { mapDbKlineToApi } from '../utils/kline-mapper';
import {
  createSafeLogger,
  createGranularPriceIndex,
  createTrailingStopSimulator,
  type BacktestTradeSetup,
  type DirectionalTrailingConfig,
  type LogLevel,
} from '../services/backtesting/trailing-stop-backtest';

const DEFAULT_CONFIG = {
  symbol: 'BTCUSDT',
  mainInterval: '2h' as Interval,
  granularInterval: '5m' as Interval,
  startDate: '2023-01-01',
  endDate: '2026-01-31',
  marketType: 'FUTURES' as const,
  initialCapital: 1000,
  capitalPerTrade: 1.0,
  leverage: 5,
};

const PARAM_RANGES = {
  full: {
    activationPercent: { min: 50, max: 150, step: 10 },
    distancePercent: { min: 10, max: 60, step: 10 },
    atrMultiplier: { min: 1.0, max: 3.5, step: 0.5 },
  },
  medium: {
    activationPercent: { min: 70, max: 120, step: 10 },
    distancePercent: { min: 20, max: 50, step: 10 },
    atrMultiplier: { min: 1.5, max: 3.0, step: 0.5 },
  },
};

interface OptimizationResult {
  longConfig: DirectionalTrailingConfig;
  shortConfig: DirectionalTrailingConfig;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trailingActivations: number;
  trailingExitRate: number;
  score: number;
}

const generateRange = (min: number, max: number, step: number): number[] => {
  const values: number[] = [];
  for (let v = min; v <= max + 0.0001; v += step) {
    values.push(Math.round(v * 100) / 100);
  }
  return values;
};

const generateDirectionalConfigs = (mode: 'full' | 'medium'): DirectionalTrailingConfig[] => {
  const configs: DirectionalTrailingConfig[] = [];
  const ranges = PARAM_RANGES[mode];
  const activations = generateRange(ranges.activationPercent.min, ranges.activationPercent.max, ranges.activationPercent.step);
  const distances = generateRange(ranges.distancePercent.min, ranges.distancePercent.max, ranges.distancePercent.step);
  const atrMults = generateRange(ranges.atrMultiplier.min, ranges.atrMultiplier.max, ranges.atrMultiplier.step);

  for (const activation of activations) {
    for (const distance of distances) {
      for (const atrMult of atrMults) {
        configs.push({
          activationPercent: activation,
          distancePercent: distance,
          atrMultiplier: atrMult,
        });
      }
    }
  }

  return configs;
};

const parsePrice = (value: string | number): number =>
  typeof value === 'string' ? parseFloat(value) : value;

const fetchKlinesFromDb = async (
  symbol: string,
  interval: Interval,
  startDate: Date,
  endDate: Date,
  marketType: MarketType
): Promise<Kline[]> => {
  const rows = await db.query.klines.findMany({
    where: and(
      eq(klinesTable.symbol, symbol),
      eq(klinesTable.interval, interval),
      eq(klinesTable.marketType, marketType),
      gte(klinesTable.openTime, startDate),
      lte(klinesTable.openTime, endDate)
    ),
    orderBy: [asc(klinesTable.openTime)],
  });

  return rows.map(mapDbKlineToApi);
};

const generateTrades = (
  mainKlines: Kline[],
  config: typeof DEFAULT_CONFIG
): BacktestTradeSetup[] => {
  const trades: BacktestTradeSetup[] = [];

  if (mainKlines.length < 50) return trades;

  const tradeIntervalBars = 12;
  const atrPeriod = 14;

  for (let i = atrPeriod; i < mainKlines.length - 20; i += tradeIntervalBars) {
    const entryKline = mainKlines[i]!;
    const entryClose = parsePrice(entryKline.close);
    const entryOpen = parsePrice(entryKline.open);

    let atrSum = 0;
    for (let j = i - atrPeriod; j < i; j++) {
      const k = mainKlines[j]!;
      atrSum += parsePrice(k.high) - parsePrice(k.low);
    }
    const atr = atrSum / atrPeriod;

    const isLong = entryClose > entryOpen;
    const side = isLong ? 'LONG' : 'SHORT';

    const stopLoss = isLong ? entryClose - atr * 2 : entryClose + atr * 2;
    const takeProfit = isLong ? entryClose + atr * 4 : entryClose - atr * 4;

    const positionValue = config.initialCapital * config.capitalPerTrade;
    const quantity = positionValue / entryClose;

    const maxExitIdx = Math.min(i + 100, mainKlines.length - 1);
    const maxExitTime = mainKlines[maxExitIdx]!.closeTime;

    trades.push({
      id: `trade-${i}`,
      symbol: config.symbol,
      side,
      entryPrice: entryClose,
      entryTime: entryKline.closeTime,
      stopLoss,
      takeProfit,
      quantity,
      atr,
      maxExitTime,
    });
  }

  return trades;
};

const calculateMetrics = (
  pnlHistory: number[],
  initialCapital: number
): { maxDrawdown: number; sharpeRatio: number } => {
  if (pnlHistory.length === 0) return { maxDrawdown: 0, sharpeRatio: 0 };

  let equity = initialCapital;
  let peak = equity;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (const pnl of pnlHistory) {
    const prevEquity = equity;
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (prevEquity > 0) returns.push(pnl / prevEquity);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return { maxDrawdown, sharpeRatio };
};

const runOptimization = async () => {
  const { values } = parseArgs({
    options: {
      symbol: { type: 'string', default: DEFAULT_CONFIG.symbol },
      start: { type: 'string', default: DEFAULT_CONFIG.startDate },
      end: { type: 'string', default: DEFAULT_CONFIG.endDate },
      'quick-test': { type: 'boolean', default: false },
      'mode': { type: 'string', default: 'medium' },
      'top-n': { type: 'string', default: '20' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(`
Trailing Stop Optimization

Usage:
  pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts [options]

Options:
  --symbol <symbol>   Symbol to test (default: BTCUSDT)
  --start <date>      Start date YYYY-MM-DD (default: 2023-01-01)
  --end <date>        End date YYYY-MM-DD (default: 2026-01-31)
  --mode <mode>       Parameter search mode: quick, medium, full (default: medium)
  --quick-test        Alias for --mode=quick
  --top-n <n>         Show top N results (default: 20)
  --verbose           Enable verbose logging
  -h, --help          Show this help

Example:
  pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts --quick-test
    `);
    process.exit(0);
  }

  const config = {
    ...DEFAULT_CONFIG,
    symbol: values.symbol ?? DEFAULT_CONFIG.symbol,
    startDate: values.start ?? DEFAULT_CONFIG.startDate,
    endDate: values.end ?? DEFAULT_CONFIG.endDate,
  };

  const topN = parseInt(values['top-n'] ?? '20', 10);
  const quickTest = values['quick-test'] ?? false;
  const mode = quickTest ? 'quick' : (values['mode'] as 'quick' | 'medium' | 'full') ?? 'medium';

  const logLevel: LogLevel = values.verbose ? 'verbose' : 'summary';
  const logger = createSafeLogger({ logLevel, maxConsoleLines: 1000 });

  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  endDate.setHours(23, 59, 59, 999);

  logger.info('========== TRAILING STOP OPTIMIZATION ==========');
  logger.info(`Symbol: ${config.symbol} | Period: ${config.startDate} to ${config.endDate}`);
  logger.info(`Capital: $${config.initialCapital} | Position: ${config.capitalPerTrade * 100}% | Leverage: ${config.leverage}x`);

  logger.info('\nStep 1: Checking and downloading klines...');

  const existingMain = await db.query.klines.findMany({
    where: and(
      eq(klinesTable.symbol, config.symbol),
      eq(klinesTable.interval, config.mainInterval),
      eq(klinesTable.marketType, config.marketType),
      gte(klinesTable.openTime, startDate),
      lte(klinesTable.openTime, endDate)
    ),
  });

  const existingGranular = await db.query.klines.findMany({
    where: and(
      eq(klinesTable.symbol, config.symbol),
      eq(klinesTable.interval, config.granularInterval),
      eq(klinesTable.marketType, config.marketType),
      gte(klinesTable.openTime, startDate),
      lte(klinesTable.openTime, endDate)
    ),
  });

  logger.info(`Existing: ${config.mainInterval}=${existingMain.length}, ${config.granularInterval}=${existingGranular.length}`);

  if (existingMain.length < 100) {
    logger.info(`Downloading ${config.mainInterval} klines...`);
    const downloaded = await backfillHistoricalKlines(
      config.symbol,
      config.mainInterval,
      startDate,
      endDate,
      config.marketType
    );
    logger.info(`Downloaded ${downloaded} ${config.mainInterval} klines`);
  }

  const expectedGranularKlines = Math.floor((endDate.getTime() - startDate.getTime()) / (5 * 60 * 1000));
  const granularThreshold = Math.min(expectedGranularKlines * 0.8, 100000);

  if (existingGranular.length < granularThreshold) {
    logger.info(`Downloading ${config.granularInterval} klines (this may take a while)...`);
    const downloaded = await backfillHistoricalKlines(
      config.symbol,
      config.granularInterval,
      startDate,
      endDate,
      config.marketType
    );
    logger.info(`Downloaded ${downloaded} ${config.granularInterval} klines`);
  }

  logger.info('\nStep 2: Loading klines from database...');

  const mainKlines = await fetchKlinesFromDb(
    config.symbol,
    config.mainInterval,
    startDate,
    endDate,
    config.marketType
  );

  const granularKlines = await fetchKlinesFromDb(
    config.symbol,
    config.granularInterval,
    startDate,
    endDate,
    config.marketType
  );

  logger.info(`Loaded: ${mainKlines.length} ${config.mainInterval} klines, ${granularKlines.length} ${config.granularInterval} klines`);

  if (mainKlines.length < 100) {
    logger.error(`Insufficient ${config.mainInterval} klines: ${mainKlines.length}`);
    process.exit(1);
  }

  if (granularKlines.length < 1000) {
    logger.error(`Insufficient ${config.granularInterval} klines: ${granularKlines.length}`);
    process.exit(1);
  }

  logger.info('\nStep 3: Creating granular price index...');
  const granularIndex = createGranularPriceIndex(granularKlines);
  logger.info(`Index: ${granularIndex.size} entries`);

  logger.info('\nStep 4: Generating trades...');
  const trades = generateTrades(mainKlines, config);
  const longTrades = trades.filter(t => t.side === 'LONG');
  const shortTrades = trades.filter(t => t.side === 'SHORT');
  logger.info(`Generated ${trades.length} trades (${longTrades.length} LONG, ${shortTrades.length} SHORT)`);

  if (trades.length === 0) {
    logger.error('No trades generated');
    process.exit(1);
  }

  logger.info('\nStep 5: Generating parameter combinations...');

  let longConfigs: DirectionalTrailingConfig[];
  let shortConfigs: DirectionalTrailingConfig[];

  if (mode === 'quick') {
    longConfigs = [
      { activationPercent: 80, distancePercent: 30, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 30, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 25, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 35, atrMultiplier: 2.0 },
      { activationPercent: 120, distancePercent: 30, atrMultiplier: 2.0 },
    ];
    shortConfigs = [
      { activationPercent: 80, distancePercent: 30, atrMultiplier: 2.0 },
      { activationPercent: 88.6, distancePercent: 30, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 30, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 25, atrMultiplier: 2.0 },
      { activationPercent: 100, distancePercent: 40, atrMultiplier: 2.0 },
    ];
  } else {
    const paramMode = mode === 'full' ? 'full' : 'medium';
    longConfigs = generateDirectionalConfigs(paramMode);
    shortConfigs = generateDirectionalConfigs(paramMode);
  }

  const totalCombinations = longConfigs.length * shortConfigs.length;
  logger.info(`Testing ${longConfigs.length} LONG × ${shortConfigs.length} SHORT = ${totalCombinations} combinations`);

  logger.info('\nStep 6: Running optimization...');

  const results: OptimizationResult[] = [];
  let processed = 0;
  const startTime = Date.now();

  for (const longConfig of longConfigs) {
    for (const shortConfig of shortConfigs) {
      const simulator = createTrailingStopSimulator(
        {
          trailingStopEnabled: true,
          long: longConfig,
          short: shortConfig,
          useAdaptiveTrailing: true,
          marketType: config.marketType,
          useBnbDiscount: false,
          vipLevel: 0,
        },
        granularIndex
      );

      let wins = 0;
      let losses = 0;
      let totalPnl = 0;
      let trailingActivations = 0;
      let trailingExits = 0;
      const pnlHistory: number[] = [];

      for (const trade of trades) {
        const result = simulator.simulateTrade(trade);
        pnlHistory.push(result.netPnl);
        totalPnl += result.netPnl;

        if (result.netPnl > 0) wins++;
        else losses++;

        if (result.trailingState.isActivated) trailingActivations++;
        if (result.exitReason === 'TRAILING_STOP') trailingExits++;
      }

      const { maxDrawdown, sharpeRatio } = calculateMetrics(pnlHistory, config.initialCapital);

      const score = totalPnl * 0.4 + sharpeRatio * 1000 * 0.4 - maxDrawdown * 10000 * 0.2;

      results.push({
        longConfig,
        shortConfig,
        totalTrades: trades.length,
        wins,
        losses,
        winRate: (wins / trades.length) * 100,
        totalPnl,
        avgPnl: totalPnl / trades.length,
        maxDrawdown,
        sharpeRatio,
        trailingActivations,
        trailingExitRate: (trailingExits / trades.length) * 100,
        score,
      });

      processed++;
      if (processed % 100 === 0 || processed === totalCombinations) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (totalCombinations - processed) / rate;
        logger.info(`Progress: ${processed}/${totalCombinations} (${(processed / totalCombinations * 100).toFixed(1)}%) | ETA: ${remaining.toFixed(0)}s`);
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  logger.info('\n========== TOP RESULTS ==========\n');

  for (let i = 0; i < Math.min(topN, results.length); i++) {
    const r = results[i]!;
    logger.info(`#${i + 1} Score: ${r.score.toFixed(2)}`);
    logger.info(`  LONG:  Act=${r.longConfig.activationPercent}% Dist=${r.longConfig.distancePercent}% ATR=${r.longConfig.atrMultiplier}`);
    logger.info(`  SHORT: Act=${r.shortConfig.activationPercent}% Dist=${r.shortConfig.distancePercent}% ATR=${r.shortConfig.atrMultiplier}`);
    logger.info(`  PnL: $${r.totalPnl.toFixed(2)} | Win Rate: ${r.winRate.toFixed(1)}% | Sharpe: ${r.sharpeRatio.toFixed(3)} | Max DD: ${(r.maxDrawdown * 100).toFixed(1)}%`);
    logger.info(`  Trailing: ${r.trailingActivations}/${r.totalTrades} activated (${r.trailingExitRate.toFixed(1)}% exits)`);
    logger.info('');
  }

  logger.info('========== BEST CONFIGURATION ==========\n');
  const best = results[0]!;
  logger.info('Copy this to your auto-trading config:\n');
  logger.info(JSON.stringify({
    trailingStopEnabled: true,
    useAdaptiveTrailing: true,
    long: best.longConfig,
    short: best.shortConfig,
  }, null, 2));

  logger.info('\n========== OPTIMIZATION COMPLETE ==========');
  logger.info(`Tested ${totalCombinations} combinations in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  logger.close();
  process.exit(0);
};

runOptimization().catch((err) => {
  console.error('Optimization failed:', err);
  process.exit(1);
});
