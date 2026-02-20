import { parseArgs } from 'util';
import { and, eq, gte, lte, asc } from 'drizzle-orm';
import type { Interval, Kline } from '@marketmind/types';
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

const DEFAULT_VALIDATION_CONFIG = {
  symbol: 'BTCUSDT',
  mainInterval: '2h' as Interval,
  granularInterval: '5m' as Interval,
  startDate: '2025-10-01',
  endDate: '2025-10-31',
  marketType: 'FUTURES' as const,
  initialCapital: 1000,
  capitalPerTrade: 1.0,
  leverage: 5,
};

const VALIDATION_TRAILING_CONFIGS: Array<{
  name: string;
  long: DirectionalTrailingConfig;
  short: DirectionalTrailingConfig;
}> = [
  {
    name: 'Default (100%/88.6%, 30%)',
    long: { activationPercent: 100, distancePercent: 30, atrMultiplier: 2.0 },
    short: { activationPercent: 88.6, distancePercent: 30, atrMultiplier: 2.0 },
  },
  {
    name: 'Conservative (80%/80%, 40%)',
    long: { activationPercent: 80, distancePercent: 40, atrMultiplier: 2.5 },
    short: { activationPercent: 80, distancePercent: 40, atrMultiplier: 2.5 },
  },
  {
    name: 'Aggressive (120%/100%, 20%)',
    long: { activationPercent: 120, distancePercent: 20, atrMultiplier: 1.5 },
    short: { activationPercent: 100, distancePercent: 20, atrMultiplier: 1.5 },
  },
];

const parsePrice = (value: string | number): number =>
  typeof value === 'string' ? parseFloat(value) : value;

const fetchKlinesFromDb = async (
  symbol: string,
  interval: Interval,
  startDate: Date,
  endDate: Date,
  marketType: 'SPOT' | 'FUTURES'
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

const generateMockTrades = (
  mainKlines: Kline[],
  config: typeof DEFAULT_VALIDATION_CONFIG
): BacktestTradeSetup[] => {
  const trades: BacktestTradeSetup[] = [];

  if (mainKlines.length < 10) return trades;

  const tradeIntervalBars = 20;
  const atrPeriod = 14;

  for (let i = atrPeriod; i < mainKlines.length - 10; i += tradeIntervalBars) {
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

    const stopLoss = isLong
      ? entryClose - atr * 2
      : entryClose + atr * 2;

    const takeProfit = isLong
      ? entryClose + atr * 4
      : entryClose - atr * 4;

    const positionValue = config.initialCapital * config.capitalPerTrade;
    const quantity = positionValue / entryClose;

    const maxExitIdx = Math.min(i + 50, mainKlines.length - 1);
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

const runValidation = async () => {
  const { values } = parseArgs({
    options: {
      symbol: { type: 'string', default: DEFAULT_VALIDATION_CONFIG.symbol },
      start: { type: 'string', default: DEFAULT_VALIDATION_CONFIG.startDate },
      end: { type: 'string', default: DEFAULT_VALIDATION_CONFIG.endDate },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(`
Trailing Stop Backtest Validation

Usage:
  pnpm tsx apps/backend/src/cli/validate-trailing-backtest.ts [options]

Options:
  --symbol <symbol>   Symbol to test (default: BTCUSDT)
  --start <date>      Start date YYYY-MM-DD (default: 2025-01-01)
  --end <date>        End date YYYY-MM-DD (default: 2025-01-31)
  --verbose           Enable verbose logging
  -h, --help          Show this help

Example:
  pnpm tsx apps/backend/src/cli/validate-trailing-backtest.ts --symbol BTCUSDT --verbose
    `);
    process.exit(0);
  }

  const config = {
    ...DEFAULT_VALIDATION_CONFIG,
    symbol: values.symbol ?? DEFAULT_VALIDATION_CONFIG.symbol,
    startDate: values.start ?? DEFAULT_VALIDATION_CONFIG.startDate,
    endDate: values.end ?? DEFAULT_VALIDATION_CONFIG.endDate,
  };

  const logLevel: LogLevel = values.verbose ? 'verbose' : 'summary';
  const logger = createSafeLogger({ logLevel, maxConsoleLines: 500 });

  logger.startRun({
    totalCombinations: VALIDATION_TRAILING_CONFIGS.length,
    symbol: config.symbol,
    period: `${config.startDate} to ${config.endDate}`,
  });

  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  endDate.setHours(23, 59, 59, 999);

  logger.info('Step 1: Checking and downloading missing klines...');

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

  if (existingMain.length < 20) {
    logger.info(`Downloading ${config.mainInterval} klines for ${config.startDate} to ${config.endDate}...`);
    const downloaded = await backfillHistoricalKlines(
      config.symbol,
      config.mainInterval,
      startDate,
      endDate,
      config.marketType
    );
    logger.info(`Downloaded ${downloaded} ${config.mainInterval} klines`);
  }

  if (existingGranular.length < 100) {
    logger.info(`Downloading ${config.granularInterval} klines for ${config.startDate} to ${config.endDate}...`);
    const downloaded = await backfillHistoricalKlines(
      config.symbol,
      config.granularInterval,
      startDate,
      endDate,
      config.marketType
    );
    logger.info(`Downloaded ${downloaded} ${config.granularInterval} klines`);
  }

  logger.info('Step 2: Loading klines from database...');

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

  if (mainKlines.length < 20) {
    logger.error(`Insufficient ${config.mainInterval} klines: ${mainKlines.length} (need >= 20)`);
    process.exit(1);
  }

  if (granularKlines.length < 100) {
    logger.error(`Insufficient ${config.granularInterval} klines: ${granularKlines.length} (need >= 100)`);
    process.exit(1);
  }

  logger.info('Step 3: Creating granular price index...');
  const granularIndex = createGranularPriceIndex(granularKlines);
  logger.info(`Index created: ${granularIndex.size} entries, ${new Date(granularIndex.firstTimestamp).toISOString()} to ${new Date(granularIndex.lastTimestamp).toISOString()}`);

  logger.info('Step 4: Generating mock trades...');
  const mockTrades = generateMockTrades(mainKlines, config);
  logger.info(`Generated ${mockTrades.length} mock trades`);

  if (mockTrades.length === 0) {
    logger.error('No mock trades generated. Check date range and data availability.');
    process.exit(1);
  }

  logger.info('Step 5: Running trailing stop simulations...');

  const results: Array<{
    configName: string;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    trailingActivations: number;
    exitReasons: Record<string, number>;
  }> = [];

  for (const trailingConfig of VALIDATION_TRAILING_CONFIGS) {
    logger.verbose(`Testing config: ${trailingConfig.name}`);

    const simulator = createTrailingStopSimulator(
      {
        trailingStopEnabled: true,
        long: trailingConfig.long,
        short: trailingConfig.short,
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
    const exitReasons: Record<string, number> = {};

    for (const trade of mockTrades) {
      const result = simulator.simulateTrade(trade);

      if (result.netPnl > 0) wins++;
      else losses++;

      totalPnl += result.netPnl;

      if (result.trailingState.isActivated) trailingActivations++;

      exitReasons[result.exitReason] = (exitReasons[result.exitReason] ?? 0) + 1;

      if (values.verbose) {
        logger.verbose(
          `  ${trade.id}: ${trade.side} | Entry: ${trade.entryPrice.toFixed(2)} | Exit: ${result.exitPrice.toFixed(2)} | PnL: ${result.netPnl.toFixed(2)} | Reason: ${result.exitReason} | Trailing: ${result.trailingState.isActivated}`
        );
      }
    }

    results.push({
      configName: trailingConfig.name,
      totalTrades: mockTrades.length,
      wins,
      losses,
      winRate: (wins / mockTrades.length) * 100,
      totalPnl,
      avgPnl: totalPnl / mockTrades.length,
      trailingActivations,
      exitReasons,
    });
  }

  logger.info('\n========== VALIDATION RESULTS ==========\n');

  for (const result of results) {
    logger.info(`Config: ${result.configName}`);
    logger.info(`  Trades: ${result.totalTrades} | Wins: ${result.wins} | Losses: ${result.losses}`);
    logger.info(`  Win Rate: ${result.winRate.toFixed(1)}%`);
    logger.info(`  Total PnL: $${result.totalPnl.toFixed(2)} | Avg PnL: $${result.avgPnl.toFixed(2)}`);
    logger.info(`  Trailing Activations: ${result.trailingActivations} (${((result.trailingActivations / result.totalTrades) * 100).toFixed(1)}%)`);
    logger.info(`  Exit Reasons: ${JSON.stringify(result.exitReasons)}`);
    logger.info('');
  }

  logger.info('========== VALIDATION CHECKLIST ==========');
  logger.info(`[${mainKlines.length >= 20 ? 'OK' : 'FAIL'}] Main klines loaded: ${mainKlines.length}`);
  logger.info(`[${granularKlines.length >= 100 ? 'OK' : 'FAIL'}] Granular klines loaded: ${granularKlines.length}`);
  logger.info(`[${granularIndex.size > 0 ? 'OK' : 'FAIL'}] Granular index created: ${granularIndex.size} entries`);
  logger.info(`[${mockTrades.length > 0 ? 'OK' : 'FAIL'}] Mock trades generated: ${mockTrades.length}`);

  const anyTrailingActivated = results.some(r => r.trailingActivations > 0);
  logger.info(`[${anyTrailingActivated ? 'OK' : 'WARN'}] Trailing stop activated in at least one config`);

  const exitReasonsOk = results.every(r => Object.keys(r.exitReasons).length > 0);
  logger.info(`[${exitReasonsOk ? 'OK' : 'FAIL'}] Exit reasons recorded`);

  const hasTrailingExits = results.some(r => (r.exitReasons['TRAILING_STOP'] ?? 0) > 0);
  logger.info(`[${hasTrailingExits ? 'OK' : 'WARN'}] At least one trailing stop exit occurred`);

  logger.info('\n========== VALIDATION COMPLETE ==========');

  const allChecksPass =
    mainKlines.length >= 20 &&
    granularKlines.length >= 100 &&
    granularIndex.size > 0 &&
    mockTrades.length > 0 &&
    exitReasonsOk;

  if (allChecksPass) {
    logger.info('All critical checks passed. System ready for optimization.');
  } else {
    logger.error('Some checks failed. Review issues above before running optimization.');
    process.exit(1);
  }

  logger.close();
  process.exit(0);
};

runValidation().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
