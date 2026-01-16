import {
    colorize,
    MaintenanceLogBuffer,
    RotationLogBuffer,
    StartupLogBuffer,
    stripAnsi,
    Table,
    TABLE_CHARS,
    WatcherLogBuffer,
    type BatchResult,
    type ColorName,
    type CorruptionFixEntry,
    type FilterCheckEntry,
    type GapFillEntry,
    type LogEntry,
    type MaintenanceResult,
    type PositionSyncResult,
    type ReconnectionValidationResult,
    type RejectionEntry,
    type RestoredWatcherInfo,
    type RotationResult,
    type SetupLogEntry,
    type TradeExecutionEntry,
    type WatcherResult,
} from '@marketmind/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceCache } from './price-cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../../logs/auto-trading.log');

const LOG_WIDTH = 150;
const HEADER_LINE_MAIN = '═'.repeat(LOG_WIDTH - 53);
const HEADER_LINE_SECONDARY = '─'.repeat(LOG_WIDTH - 53);

const createMainHeader = (
  icon: string,
  title: string,
  time: Date,
  durationMs: number,
  color: ColorName = 'cyan'
): string[] => [
  '',
  colorize(HEADER_LINE_MAIN, color),
  colorize(`  ${icon} ${title}`, 'bright') + colorize(` │ ${time.toLocaleTimeString()} │ Duration: ${durationMs}ms`, 'dim'),
  colorize(HEADER_LINE_MAIN, color),
];

const createSecondaryHeader = (
  icon: string,
  title: string,
  time: Date,
  suffix: string,
  color: ColorName = 'dim'
): string[] => [
  '',
  colorize(HEADER_LINE_SECONDARY, color),
  `  ${colorize(`${icon} ${title}`, color)} │ ${time.toLocaleTimeString()} │ ${suffix}`,
  colorize(HEADER_LINE_SECONDARY, color),
];

const createSectionHeader = (icon: string, title: string, color: ColorName): string[] => [
  '',
  colorize(`  ${icon} ${title}`, color),
];

const createLogTable = (
  head: string[],
  colWidths: number[],
  headColor: ColorName
): Table.Table => new Table({
  head,
  colWidths,
  style: { head: [headColor], border: ['gray'] },
  chars: TABLE_CHARS,
});

const createSummaryLine = (icon: string, parts: string[]): string =>
  `  ${icon} ${parts.join(' │ ')}`;

export {
    MaintenanceLogBuffer,
    RotationLogBuffer, StartupLogBuffer, WatcherLogBuffer, type BatchResult, type CorruptionFixEntry, type FilterCheckEntry, type GapFillEntry, type LogEntry, type MaintenanceResult, type RejectionEntry, type RestoredWatcherInfo, type RotationResult, type SetupLogEntry, type TradeExecutionEntry, type WatcherResult
};

const ensureLogDir = (): void => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

const writeToFile = (content: string): void => {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, stripAnsi(content));
  } catch {
    // Silent fail for file logging
  }
};

const getStatusDisplay = (status: string): string => {
  switch (status) {
    case 'success': return colorize('✅ OK', 'green');
    case 'skipped': return colorize('⏭️ SKIP', 'yellow');
    case 'pending': return colorize('⏳ WAIT', 'cyan');
    case 'error': return colorize('❌ ERR', 'red');
    default: return status;
  }
};

export const formatBatchResults = (batch: BatchResult): string => {
  const lines: string[] = [];
  const durationMs = batch.endTime.getTime() - batch.startTime.getTime();

  lines.push(...createMainHeader('🔄', `CYCLE #${batch.batchId}`, batch.startTime, durationMs));

  const summaryParts = [
    `${batch.totalWatchers} watchers`,
    colorize(`✅ ${batch.successCount}`, 'green'),
    colorize(`⏳ ${batch.pendingCount}`, 'cyan'),
    colorize(`⏭️ ${batch.skippedCount}`, 'yellow'),
    colorize(`❌ ${batch.errorCount}`, 'red'),
  ];
  const detailParts = [
    colorize(`📍 ${batch.totalSetupsDetected} setups`, 'magenta'),
    colorize(`🚫 ${batch.totalRejections} rejected`, 'yellow'),
    colorize(`🔒 ${batch.totalFilterBlocks} blocked`, 'red'),
    colorize(`💹 ${batch.totalTradesExecuted} trades`, 'blue'),
  ];
  lines.push(createSummaryLine('📊', summaryParts));
  lines.push(createSummaryLine('📈', detailParts));

  if (batch.watcherResults.length > 0) {
    const watcherTable = createLogTable(
      ['Symbol', 'Interval', 'Market', 'Status', 'Klines', 'Setups', 'Trades', 'Time', 'Details'],
      [14, 12, 12, 12, 10, 10, 10, 12, 58],
      'cyan'
    );

    for (const result of batch.watcherResults) {
      const klines = result.klinesCount?.toString() ?? '-';
      const details = result.reason ?? (result.setupsDetected.length > 0
        ? result.setupsDetected.map(s => `${s.type.slice(0, 15)}(${s.direction[0]})`).join(', ')
        : '-');

      watcherTable.push([
        colorize(result.symbol, 'bright'),
        result.interval,
        result.marketType,
        getStatusDisplay(result.status),
        klines,
        result.setupsDetected.length.toString(),
        result.tradesExecuted.toString(),
        `${result.durationMs}ms`,
        details.slice(0, 56),
      ]);
    }

    lines.push(watcherTable.toString());
  }

  const setupResults = batch.watcherResults.filter(r => r.setupsDetected.length > 0);
  if (setupResults.length > 0) {
    lines.push(...createSectionHeader('📍', 'DETECTED SETUPS', 'magenta'));

    const setupTable = createLogTable(
      ['Symbol', 'Strategy', 'Dir', 'Conf', 'Entry', 'Stop Loss', 'Take Profit', 'R:R'],
      [14, 34, 8, 8, 20, 20, 20, 26],
      'magenta'
    );

    for (const result of setupResults) {
      for (const setup of result.setupsDetected) {
        const dirColor = setup.direction === 'LONG' ? 'green' : 'red';
        setupTable.push([
          colorize(result.symbol, 'bright'),
          setup.type.slice(0, 32),
          colorize(setup.direction, dirColor),
          `${setup.confidence}%`,
          setup.entryPrice,
          setup.stopLoss,
          setup.takeProfit,
          setup.riskReward,
        ]);
      }
    }

    lines.push(setupTable.toString());
  }

  const errorResults = batch.watcherResults.filter(r => r.status === 'error');
  if (errorResults.length > 0) {
    lines.push(...createSectionHeader('❌', 'ERRORS', 'red'));

    const errorTable = createLogTable(['Symbol', 'Interval', 'Error'], [14, 10, 126], 'red');

    for (const result of errorResults) {
      const errorLogs = result.logs.filter(l => l.level === 'error');
      const errorMsg = result.reason ?? errorLogs.map(l => l.message).join('; ') ?? 'Unknown error';
      errorTable.push([
        result.symbol,
        result.interval,
        colorize(errorMsg.slice(0, 124), 'red'),
      ]);
    }

    lines.push(errorTable.toString());
  }

  const rejectionResults = batch.watcherResults.filter(r => r.rejections.length > 0);
  if (rejectionResults.length > 0) {
    lines.push(...createSectionHeader('🚫', 'SETUP REJECTIONS', 'yellow'));

    const rejectionTable = createLogTable(
      ['Symbol', 'Setup', 'Dir', 'Reason', 'Details'],
      [14, 28, 8, 34, 66],
      'yellow'
    );

    for (const result of rejectionResults) {
      for (const rejection of result.rejections) {
        const dirColor = rejection.direction === 'LONG' ? 'green' : 'red';
        const detailStr = rejection.details
          ? Object.entries(rejection.details).map(([k, v]) => `${k}:${v}`).join(' ').slice(0, 64)
          : '-';
        rejectionTable.push([
          colorize(result.symbol, 'bright'),
          rejection.setupType.slice(0, 26),
          colorize(rejection.direction, dirColor),
          colorize(rejection.reason.slice(0, 32), 'yellow'),
          detailStr,
        ]);
      }
    }

    lines.push(rejectionTable.toString());
  }

  const filterBlockResults = batch.watcherResults.filter(r => r.filterChecks.some(f => !f.passed));
  if (filterBlockResults.length > 0) {
    lines.push(...createSectionHeader('🔒', 'FILTER BLOCKS', 'red'));

    const filterTable = createLogTable(
      ['Symbol', 'Filter', 'Reason', 'Details'],
      [14, 24, 50, 62],
      'red'
    );

    for (const result of filterBlockResults) {
      for (const filter of result.filterChecks.filter(f => !f.passed)) {
        const detailStr = filter.details
          ? Object.entries(filter.details).map(([k, v]) => `${k}:${v}`).join(' ').slice(0, 60)
          : '-';
        filterTable.push([
          colorize(result.symbol, 'bright'),
          colorize(filter.filterName, 'red'),
          filter.reason.slice(0, 48),
          detailStr,
        ]);
      }
    }

    lines.push(filterTable.toString());
  }

  const tradeResults = batch.watcherResults.filter(r => r.tradeExecutions.length > 0);
  if (tradeResults.length > 0) {
    lines.push(...createSectionHeader('💹', 'TRADE EXECUTIONS', 'blue'));

    const tradeTable = createLogTable(
      ['Symbol', 'Setup', 'Dir', 'Entry', 'Qty', 'SL', 'TP', 'Type', 'Status'],
      [14, 26, 8, 16, 16, 16, 16, 12, 26],
      'blue'
    );

    for (const result of tradeResults) {
      for (const trade of result.tradeExecutions) {
        const dirColor = trade.direction === 'LONG' ? 'green' : 'red';
        const statusColor = trade.status === 'executed' ? 'green' : trade.status === 'pending' ? 'yellow' : 'red';
        tradeTable.push([
          colorize(result.symbol, 'bright'),
          trade.setupType.slice(0, 24),
          colorize(trade.direction, dirColor),
          trade.entryPrice,
          trade.quantity,
          trade.stopLoss ?? '-',
          trade.takeProfit ?? '-',
          trade.orderType,
          colorize(trade.status, statusColor),
        ]);
      }
    }

    lines.push(tradeTable.toString());
  }

  lines.push('');
  return lines.join('\n');
};

export const formatDetailedLogs = (results: WatcherResult[]): string => {
  const lines: string[] = [];

  for (const result of results) {
    if (result.logs.length === 0) continue;

    lines.push('');
    lines.push(colorize(`  [${result.symbol}/${result.interval}/${result.marketType}]`, 'cyan'));

    for (const log of result.logs) {
      const time = log.timestamp.toISOString().slice(11, 23);
      const levelColor = log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'dim';
      const dataStr = log.data ? colorize(` ${JSON.stringify(log.data)}`, 'dim') : '';
      lines.push(`    ${colorize(time, 'gray')} ${log.emoji} ${colorize(log.message, levelColor)}${dataStr}`);
    }
  }

  return lines.join('\n');
};

export interface ConfigCacheStats {
  size: number;
  hits: number;
  misses: number;
  preloads: number;
  hitRate: number;
}

export const outputBatchResults = (batch: BatchResult, verbose = false, configCacheStats?: ConfigCacheStats): void => {
  const summary = formatBatchResults(batch);
  console.log(summary);
  writeToFile(`${summary}\n`);

  const priceCacheStats = priceCache.getStats();
  if (priceCacheStats.metrics.hits + priceCacheStats.metrics.misses > 0 || (configCacheStats && (configCacheStats.hits + configCacheStats.misses > 0))) {
    const lines: string[] = [];

    if (priceCacheStats.metrics.hits + priceCacheStats.metrics.misses > 0) {
      lines.push(
        `  💾 PriceCache: ${priceCacheStats.size} entries │ ` +
        `${priceCacheStats.metrics.hits} hits │ ${priceCacheStats.metrics.misses} misses │ ` +
        `${(priceCacheStats.metrics.hitRate * 100).toFixed(1)}% rate │ ` +
        `${priceCacheStats.metrics.apiFetches} API │ ${priceCacheStats.metrics.websocketUpdates} WS`
      );
    }

    if (configCacheStats && (configCacheStats.hits + configCacheStats.misses > 0)) {
      lines.push(
        `  📦 ConfigCache: ${configCacheStats.size} entries │ ` +
        `${configCacheStats.hits} hits │ ${configCacheStats.misses} misses │ ` +
        `${(configCacheStats.hitRate * 100).toFixed(1)}% rate │ ` +
        `${configCacheStats.preloads} preloaded`
      );
    }

    const cacheInfo = colorize(lines.join('\n'), 'dim');
    console.log(cacheInfo);
    writeToFile(`${stripAnsi(cacheInfo)}\n`);
  }

  if (verbose) {
    const detailed = formatDetailedLogs(batch.watcherResults);
    if (detailed) {
      console.log(detailed);
      writeToFile(`${detailed}\n`);
    }
  }
};

export const createBatchResult = (
  batchId: number,
  startTime: Date,
  results: WatcherResult[]
): BatchResult => {
  const endTime = new Date();
  const filterBlocks = results.reduce((sum, r) => sum + r.filterChecks.filter(f => !f.passed).length, 0);
  return {
    batchId,
    startTime,
    endTime,
    totalWatchers: results.length,
    successCount: results.filter(r => r.status === 'success').length,
    skippedCount: results.filter(r => r.status === 'skipped').length,
    pendingCount: results.filter(r => r.status === 'pending').length,
    errorCount: results.filter(r => r.status === 'error').length,
    totalSetupsDetected: results.reduce((sum, r) => sum + r.setupsDetected.length, 0),
    totalRejections: results.reduce((sum, r) => sum + r.rejections.length, 0),
    totalFilterBlocks: filterBlocks,
    totalTradesExecuted: results.reduce((sum, r) => sum + r.tradesExecuted, 0),
    watcherResults: results,
  };
};

export const formatStartupResults = (
  watchers: RestoredWatcherInfo[],
  persistedCount: number,
  durationMs: number
): string => {
  const lines: string[] = [];

  lines.push(...createMainHeader('🚀', 'AUTO-TRADING STARTUP', new Date(), durationMs));

  const successCount = watchers.filter(w => w.status === 'success').length;
  const failedCount = watchers.filter(w => w.status === 'failed').length;
  const manualCount = watchers.filter(w => w.isManual).length;
  const dynamicCount = watchers.filter(w => !w.isManual).length;

  const summaryParts = [
    `${persistedCount} persisted`,
    colorize(`✅ ${successCount} restored`, 'green'),
    colorize(`❌ ${failedCount} failed`, failedCount > 0 ? 'red' : 'dim'),
  ];
  const typeParts = [
    colorize(`📌 ${manualCount} manual`, 'cyan'),
    colorize(`🔄 ${dynamicCount} dynamic`, 'magenta'),
  ];
  lines.push(createSummaryLine('📋', summaryParts));
  lines.push(createSummaryLine('📊', typeParts));

  if (watchers.length > 0) {
    const watcherTable = createLogTable(
      ['Symbol', 'Interval', 'Market', 'Type', 'Status', 'Klines', 'Next Candle'],
      [14, 10, 10, 10, 10, 10, 22],
      'cyan'
    );

    for (const w of watchers) {
      const typeStr = w.isManual ? 'Manual' : 'Dynamic';
      const typeColor = w.isManual ? 'cyan' : 'magenta';
      const statusStr = w.status === 'success' ? '✅' : '❌';
      const statusColor = w.status === 'success' ? 'green' : 'red';
      const klinesStr = w.totalKlinesInDb ? `${(w.totalKlinesInDb / 1000).toFixed(1)}k` : '-';
      const nextCandle = w.nextCandleClose
        ? w.nextCandleClose.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '-';

      watcherTable.push([
        colorize(w.symbol, 'bright'),
        w.interval,
        w.marketType,
        colorize(typeStr, typeColor),
        colorize(statusStr, statusColor),
        klinesStr,
        nextCandle,
      ]);
    }

    lines.push(...createSectionHeader('📡', 'RESTORED WATCHERS', 'cyan'));
    lines.push(watcherTable.toString());
  }

  const failedWatchers = watchers.filter(w => w.status === 'failed');
  if (failedWatchers.length > 0) {
    lines.push(...createSectionHeader('❌', 'FAILED RESTORATIONS', 'red'));

    const errorTable = createLogTable(
      ['Symbol', 'Interval', 'Market', 'Error'],
      [14, 10, 10, 60],
      'red'
    );

    for (const w of failedWatchers) {
      errorTable.push([
        colorize(w.symbol, 'bright'),
        w.interval,
        w.marketType,
        colorize(w.error?.slice(0, 58) ?? 'Unknown error', 'red'),
      ]);
    }

    lines.push(errorTable.toString());
  }

  lines.push('');
  return lines.join('\n');
};

export const outputStartupResults = (
  watchers: RestoredWatcherInfo[],
  persistedCount: number,
  durationMs: number
): void => {
  const summary = formatStartupResults(watchers, persistedCount, durationMs);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

const getMaintenanceStatusDisplay = (status: 'success' | 'partial' | 'skipped' | 'error'): { color: ColorName; icon: string } => {
  if (status === 'success') return { color: 'green', icon: '✅' };
  if (status === 'partial') return { color: 'yellow', icon: '⚠️' };
  return { color: 'red', icon: '❌' };
};

const formatGapFillsTable = (gapFills: GapFillEntry[]): string[] => {
  const lines: string[] = [];
  const gapsWithActivity = gapFills.filter(g => g.gapsFound > 0 || g.candlesFilled > 0);
  if (gapsWithActivity.length === 0) return lines;

  lines.push(...createSectionHeader('📉', 'GAP FILLS', 'yellow'));

  const gapTable = createLogTable(
    ['Symbol', 'Interval', 'Market', 'Gaps', 'Candles', 'Status'],
    [14, 10, 10, 8, 10, 12],
    'yellow'
  );

  for (const g of gapsWithActivity) {
    const { color, icon } = getMaintenanceStatusDisplay(g.status);
    gapTable.push([
      colorize(g.symbol, 'bright'),
      g.interval,
      g.marketType,
      g.gapsFound.toString(),
      g.candlesFilled.toString(),
      colorize(icon, color),
    ]);
  }

  lines.push(gapTable.toString());
  return lines;
};

const formatCorruptionFixesTable = (corruptionFixes: CorruptionFixEntry[]): string[] => {
  const lines: string[] = [];
  const corruptionsWithActivity = corruptionFixes.filter(c => c.corruptedFound > 0);
  if (corruptionsWithActivity.length === 0) return lines;

  lines.push(...createSectionHeader('🛠️', 'CORRUPTION FIXES', 'blue'));

  const corruptionTable = createLogTable(
    ['Symbol', 'Interval', 'Market', 'Found', 'Fixed', 'Status'],
    [14, 10, 10, 8, 8, 12],
    'blue'
  );

  for (const c of corruptionsWithActivity) {
    const { color, icon } = getMaintenanceStatusDisplay(c.status);
    corruptionTable.push([
      colorize(c.symbol, 'bright'),
      c.interval,
      c.marketType,
      c.corruptedFound.toString(),
      c.fixed.toString(),
      colorize(icon, color),
    ]);
  }

  lines.push(corruptionTable.toString());
  return lines;
};

const formatMaintenanceErrorsTable = (gapFills: GapFillEntry[]): string[] => {
  const lines: string[] = [];
  const errors = gapFills.filter(g => g.status === 'error');
  if (errors.length === 0) return lines;

  lines.push(...createSectionHeader('❌', 'ERRORS', 'red'));

  const errorTable = createLogTable(
    ['Symbol', 'Interval', 'Market', 'Error'],
    [14, 10, 10, 60],
    'red'
  );

  for (const e of errors) {
    errorTable.push([
      colorize(e.symbol, 'bright'),
      e.interval,
      e.marketType,
      colorize(e.reason?.slice(0, 58) ?? 'Unknown error', 'red'),
    ]);
  }

  lines.push(errorTable.toString());
  return lines;
};

export const formatMaintenanceResults = (result: MaintenanceResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();
  const title = result.type === 'startup' ? 'KLINE MAINTENANCE (STARTUP)' : 'KLINE MAINTENANCE (PERIODIC)';

  lines.push(...createMainHeader('🔧', title, result.startTime, durationMs));

  const summaryParts = [
    `${result.pairsChecked} pairs`,
    colorize(`🔍 ${result.totalGapsFound} gaps`, result.totalGapsFound > 0 ? 'yellow' : 'dim'),
    colorize(`📥 ${result.totalCandlesFilled} filled`, result.totalCandlesFilled > 0 ? 'green' : 'dim'),
    colorize(`🛠️ ${result.totalCorruptedFixed} fixed`, result.totalCorruptedFixed > 0 ? 'blue' : 'dim'),
  ];
  lines.push(createSummaryLine('📊', summaryParts));

  lines.push(...formatGapFillsTable(result.gapFills));
  lines.push(...formatCorruptionFixesTable(result.corruptionFixes));
  lines.push(...formatMaintenanceErrorsTable(result.gapFills));

  lines.push('');
  return lines.join('\n');
};

export const outputMaintenanceResults = (result: MaintenanceResult): void => {
  if (result.totalGapsFound === 0 && result.totalCorruptedFixed === 0 && result.type === 'periodic') return;

  const summary = formatMaintenanceResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

export const formatRotationResults = (result: RotationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push(...createMainHeader('🔄', 'SYMBOL ROTATION', result.startTime, durationMs, 'magenta'));

  const contextParts = [
    colorize(`📊 ${result.marketType || 'FUTURES'}`, 'cyan'),
    colorize(`⏱️ ${result.interval}`, 'dim'),
    colorize(`🎯 Target: ${result.targetCount}`, 'bright'),
    colorize(`📦 Slots: ${result.slotsAvailable}`, result.slotsAvailable > 0 ? 'green' : 'dim'),
  ];
  lines.push(`  ${contextParts.join(' │ ')}`);

  if (result.added.length > 0 || result.removed.length > 0) {
    const changeTable = createLogTable(['Action', 'Symbol', 'Status'], [10, 14, 30], 'magenta');

    for (const symbol of result.added) {
      const validation = result.klineValidations?.find(v => v.symbol === symbol);
      let status = colorize('Ready', 'green');
      if (validation && (validation.gapsFilled > 0 || validation.corruptedFixed > 0)) {
        status = colorize(`Validated (gaps: ${validation.gapsFilled}, fixed: ${validation.corruptedFixed})`, 'cyan');
      }
      changeTable.push([colorize('➕ ADD', 'green'), colorize(symbol, 'bright'), status]);
    }

    for (const symbol of result.removed) {
      changeTable.push([colorize('➖ REM', 'red'), colorize(symbol, 'bright'), colorize('Removed', 'dim')]);
    }

    lines.push(changeTable.toString());
  }

  const summaryParts = [
    colorize(`📊 ${result.kept} kept`, 'cyan'),
    colorize(`➕ ${result.added.length} added`, 'green'),
    colorize(`➖ ${result.removed.length} removed`, 'red'),
  ];

  if (result.skippedWithPositions.length > 0) {
    summaryParts.push(colorize(`🔒 ${result.skippedWithPositions.length} with positions`, 'yellow'));
  }

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`⏳ ${result.skippedInsufficientKlines.length} insufficient data`, 'dim'));
  }

  lines.push(`  ${summaryParts.join(' │ ')}`);

  if (result.skippedInsufficientKlines.length > 0) {
    lines.push(`  ${colorize('⏳ Skipped (no data):', 'dim')} ${result.skippedInsufficientKlines.join(', ')}`);
  }

  if (result.skippedWithPositions.length > 0) {
    lines.push(`  ${colorize('🔒 Protected (open positions):', 'yellow')} ${result.skippedWithPositions.join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
};

export const formatRotationNoChanges = (result: RotationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push(...createSecondaryHeader('🔄', 'SYMBOL ROTATION', result.startTime, `Duration: ${durationMs}ms │ ${result.marketType || 'FUTURES'} │ ${result.interval}`));

  const summaryParts = [
    colorize(`✅ No changes`, 'green'),
    colorize(`📊 ${result.kept} symbols`, 'cyan'),
    colorize(`🎯 Target: ${result.targetCount}`, 'dim'),
  ];

  if (result.skippedWithPositions.length > 0) {
    summaryParts.push(colorize(`🔒 ${result.skippedWithPositions.length} protected`, 'yellow'));
  }

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`⏳ ${result.skippedInsufficientKlines.length} no data`, 'dim'));
  }

  lines.push(`  ${summaryParts.join(' │ ')}`);
  lines.push('');
  return lines.join('\n');
};

export const outputRotationResults = (result: RotationResult): void => {
  if (!result.hasChanges) {
    const summary = formatRotationNoChanges(result);
    console.log(summary);
    writeToFile(`${summary}\n`);
    return;
  }

  const summary = formatRotationResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

const formatReconnectionValidationResults = (result: ReconnectionValidationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push(...createMainHeader('🔌', 'POST-RECONNECTION VALIDATION', result.startTime, durationMs));

  const summaryParts = [
    `${result.pairsChecked} pairs`,
    `🔍 ${result.klinesChecked} klines`,
    `⚠️ ${result.totalMismatches} mismatches`,
    `🛠️ ${result.totalFixed} fixed`,
  ];
  lines.push(createSummaryLine('📊', summaryParts));

  if (result.mismatches.length > 0) {
    lines.push(...createSectionHeader('🔧', 'OHLC CORRECTIONS', 'yellow'));

    const mismatchTable = createLogTable(
      ['Symbol', 'Interval', 'OpenTime', 'Field', 'DB Value', 'API Value', 'Diff %', 'Status'],
      [12, 10, 22, 8, 12, 12, 10, 10],
      'yellow'
    );

    for (const m of result.mismatches) {
      const timeStr = m.openTime.toISOString().replace('T', ' ').slice(0, 19);
      const status = m.fixed ? colorize('✅', 'green') : colorize('❌', 'red');
      const diffStr = m.diffPercent.toFixed(2) + '%';

      mismatchTable.push([
        m.symbol,
        m.interval,
        timeStr,
        m.field.toUpperCase(),
        m.dbValue.toPrecision(6),
        m.apiValue.toPrecision(6),
        diffStr,
        status,
      ]);
    }

    lines.push(mismatchTable.toString());
  }

  lines.push('');
  return lines.join('\n');
};

export const outputReconnectionValidationResults = (result: ReconnectionValidationResult): void => {
  if (result.totalMismatches === 0) return;

  const summary = formatReconnectionValidationResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

const formatPositionSyncResults = (result: PositionSyncResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  const hasIssues = result.totalOrphaned > 0 || result.totalUnknown > 0;
  const headerColor = hasIssues ? 'yellow' : 'dim';

  lines.push(...createSecondaryHeader('🔄', 'POSITION SYNC', result.startTime, `Duration: ${durationMs}ms`, headerColor));

  const summaryParts = [
    `${result.walletsChecked} wallets`,
    result.totalOrphaned > 0 ? colorize(`⚠️ ${result.totalOrphaned} orphaned`, 'yellow') : `✅ 0 orphaned`,
    result.totalUnknown > 0 ? colorize(`🚨 ${result.totalUnknown} unknown`, 'red') : `✅ 0 unknown`,
    result.totalUpdated > 0 ? colorize(`🔄 ${result.totalUpdated} updated`, 'cyan') : `✅ 0 updated`,
  ];
  lines.push(createSummaryLine('📊', summaryParts));

  if (result.orphanedPositions.length > 0) {
    lines.push(...createSectionHeader('⚠️', 'ORPHANED POSITIONS (closed on exchange but open in DB)', 'yellow'));

    const orphanedTable = createLogTable(
      ['Wallet', 'Symbol', 'Side', 'Entry', 'Exit', 'Qty', 'PnL', 'PnL %'],
      [12, 12, 8, 12, 12, 10, 12, 10],
      'yellow'
    );

    for (const p of result.orphanedPositions) {
      const pnlColor = p.pnl >= 0 ? 'green' : 'red';
      orphanedTable.push([
        p.walletId.slice(0, 10),
        p.symbol,
        p.side,
        p.entryPrice.toPrecision(6),
        p.exitPrice.toPrecision(6),
        p.quantity.toPrecision(4),
        colorize(p.pnl.toFixed(2), pnlColor),
        colorize(`${p.pnlPercent.toFixed(2)}%`, pnlColor),
      ]);
    }

    lines.push(orphanedTable.toString());
  }

  if (result.unknownPositions.length > 0) {
    lines.push(...createSectionHeader('🚨', 'UNKNOWN POSITIONS (on exchange but NOT in DB - MANUAL CHECK REQUIRED)', 'red'));

    const unknownTable = createLogTable(
      ['Wallet', 'Symbol', 'Position', 'Entry', 'Unrealized PnL', 'Leverage', 'Margin'],
      [12, 12, 12, 12, 14, 10, 10],
      'red'
    );

    for (const p of result.unknownPositions) {
      const pnlColor = p.unrealizedPnl >= 0 ? 'green' : 'red';
      unknownTable.push([
        p.walletId.slice(0, 10),
        p.symbol,
        p.positionAmt.toPrecision(4),
        p.entryPrice.toPrecision(6),
        colorize(p.unrealizedPnl.toFixed(2), pnlColor),
        `${p.leverage}x`,
        p.marginType,
      ]);
    }

    lines.push(unknownTable.toString());
  }

  if (result.updatedPositions.length > 0) {
    lines.push(...createSectionHeader('🔄', 'POSITION UPDATES (synced from exchange)', 'cyan'));

    const updatedTable = createLogTable(
      ['Wallet', 'Symbol', 'Field', 'Old Value', 'New Value'],
      [12, 12, 14, 14, 14],
      'cyan'
    );

    for (const p of result.updatedPositions) {
      updatedTable.push([
        p.walletId.slice(0, 10),
        p.symbol,
        p.field,
        p.oldValue.toPrecision(6),
        p.newValue.toPrecision(6),
      ]);
    }

    lines.push(updatedTable.toString());
  }

  lines.push('');
  return lines.join('\n');
};

export const outputPositionSyncResults = (result: PositionSyncResult): void => {
  const hasIssues = result.totalOrphaned > 0 || result.totalUnknown > 0 || result.totalUpdated > 0;
  if (!hasIssues) return;

  const summary = formatPositionSyncResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

import type { PendingOrdersCheckResult } from '@marketmind/logger';

const formatPendingOrdersCheckResults = (result: PendingOrdersCheckResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  const hasActivity = result.expiredCount > 0 || result.invalidCount > 0 || result.filledCount > 0 || result.errorCount > 0;
  const headerColor = hasActivity ? 'yellow' : 'dim';

  lines.push(...createSecondaryHeader('📋', 'PENDING ORDERS CHECK', result.startTime, `Duration: ${durationMs}ms`, headerColor));

  const summaryParts = [
    `${result.totalChecked} orders`,
    result.filledCount > 0 ? colorize(`🎯 ${result.filledCount} filled`, 'green') : `✅ 0 filled`,
    result.expiredCount > 0 ? colorize(`⏰ ${result.expiredCount} expired`, 'yellow') : `✅ 0 expired`,
    result.invalidCount > 0 ? colorize(`❌ ${result.invalidCount} invalid`, 'red') : `✅ 0 invalid`,
    result.pendingCount > 0 ? colorize(`⏳ ${result.pendingCount} pending`, 'cyan') : '',
    result.errorCount > 0 ? colorize(`⚠️ ${result.errorCount} errors`, 'red') : '',
  ].filter(Boolean);
  lines.push(createSummaryLine('📊', summaryParts));

  const actionsToShow = result.actions.filter(a => a.action !== 'PENDING');
  if (actionsToShow.length > 0) {
    const orderTable = createLogTable(
      ['Symbol', 'Side', 'Action', 'Limit Price', 'Current Price', 'Details'],
      [12, 8, 10, 14, 14, 35],
      'yellow'
    );

    for (const action of actionsToShow) {
      const sideColor = action.side === 'LONG' ? 'green' : 'red';
      let actionColor: ColorName = 'dim';
      let actionIcon = '';

      switch (action.action) {
        case 'FILLED':
          actionColor = 'green';
          actionIcon = '🎯';
          break;
        case 'EXPIRED':
          actionColor = 'yellow';
          actionIcon = '⏰';
          break;
        case 'INVALID':
          actionColor = 'red';
          actionIcon = '❌';
          break;
        case 'ERROR':
          actionColor = 'red';
          actionIcon = '⚠️';
          break;
      }

      const details = action.error
        ? action.error.slice(0, 33)
        : action.action === 'EXPIRED' && action.expiresAt
          ? `Expired at ${action.expiresAt.toLocaleTimeString()}`
          : action.action === 'FILLED' && action.currentPrice
            ? `Filled at ${action.currentPrice.toPrecision(6)}`
            : '-';

      orderTable.push([
        action.symbol,
        colorize(action.side, sideColor),
        colorize(`${actionIcon} ${action.action}`, actionColor),
        action.limitPrice?.toPrecision(6) ?? '-',
        action.currentPrice?.toPrecision(6) ?? '-',
        details,
      ]);
    }

    lines.push(orderTable.toString());
  }

  lines.push('');
  return lines.join('\n');
};

export const outputPendingOrdersCheckResults = (result: PendingOrdersCheckResult): void => {
  const hasActivity = result.expiredCount > 0 || result.invalidCount > 0 || result.filledCount > 0 || result.errorCount > 0;
  if (!hasActivity) return;

  const summary = formatPendingOrdersCheckResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};
