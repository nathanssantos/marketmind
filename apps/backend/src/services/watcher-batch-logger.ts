import {
    colorize,
    MaintenanceLogBuffer,
    RotationLogBuffer,
    StartupLogBuffer,
    stripAnsi,
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
    type SetupValidationEntry,
    type TradeExecutionEntry,
    type ValidationCheck,
    type WatcherResult,
} from '@marketmind/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceCache } from './price-cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../../logs/auto-trading.log');

const ICONS = {
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '!',
  PENDING: '~',
  SKIP: '~',
  ACTION: '>',
  INFO: '·',
} as const;

const STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  SKIPPED: 'skipped',
  PARTIAL: 'partial',
  FAILED: 'failed',
  EXECUTED: 'executed',
} as const;

const DIRECTION = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

const fmtTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const header = (title: string, time: Date, durationMs: number): string =>
  colorize(`--- ${title.toLowerCase()}`, 'cyan') + colorize(` · ${fmtTime(time)} · ${durationMs}ms ---`, 'dim');

const dimHeader = (title: string, time: Date, durationMs: number): string =>
  colorize(`--- ${title.toLowerCase()}`, 'dim') + colorize(` · ${fmtTime(time)} · ${durationMs}ms ---`, 'dim');

const joinParts = (parts: string[]): string => parts.filter(Boolean).join(colorize(' · ', 'dim'));

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

const dirDisplay = (direction: string): string => {
  const icon = direction === DIRECTION.LONG ? '▲' : '▼';
  const color: ColorName = direction === DIRECTION.LONG ? 'green' : 'red';
  return colorize(`${icon}${direction}`, color);
};

const pnlDisplay = (value: number, suffix = ''): string => {
  if (value > 0) return colorize(`+${value.toFixed(2)}${suffix}`, 'green');
  if (value < 0) return colorize(`${value.toFixed(2)}${suffix}`, 'red');
  return `${value.toFixed(2)}${suffix}`;
};

const formatValidationCheck = (check: ValidationCheck): string => {
  const icon = check.passed ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
  const name = check.name.padEnd(20);
  let detail = '';
  if (check.value !== undefined && check.expected !== undefined) {
    detail = check.passed
      ? colorize(check.value, 'dim')
      : `${colorize(check.value, 'yellow')} (need ${check.expected})`;
  } else if (check.reason) {
    detail = check.passed ? colorize(check.reason, 'dim') : colorize(check.reason, 'yellow');
  }
  return `      ${icon} ${name} ${detail}`;
};

const formatSetupValidation = (v: SetupValidationEntry): string[] => {
  const lines: string[] = [];
  lines.push(`    ${dirDisplay(v.direction)} ${colorize(v.setupType, 'bright')} @ ${v.entryPrice}`);

  for (const check of v.checks) {
    lines.push(formatValidationCheck(check));
  }

  let outcomeIcon: string;
  let outcomeColor: ColorName;
  let outcomeText: string;

  switch (v.outcome) {
    case 'executed':
      outcomeIcon = ICONS.SUCCESS;
      outcomeColor = 'green';
      outcomeText = v.execution ? `EXECUTED qty=${v.execution.quantity}` : 'EXECUTED';
      break;
    case 'blocked':
      outcomeIcon = ICONS.ERROR;
      outcomeColor = 'red';
      outcomeText = `BLOCKED${v.outcomeReason ? `: ${v.outcomeReason}` : ''}`;
      break;
    case 'failed':
      outcomeIcon = ICONS.ERROR;
      outcomeColor = 'red';
      outcomeText = `FAILED${v.outcomeReason ? `: ${v.outcomeReason}` : ''}`;
      break;
    default:
      outcomeIcon = ICONS.PENDING;
      outcomeColor = 'yellow';
      outcomeText = 'PENDING';
  }

  lines.push(`      └ ${colorize(outcomeIcon, outcomeColor)} ${colorize(outcomeText, outcomeColor)}`);
  return lines;
};

const formatWatcherLine = (r: WatcherResult): string => {
  const sym = colorize(`${r.symbol}/${r.interval}`, 'bright');
  const rotatedTag = r.isRecentlyRotated ? colorize(' R', 'magenta') : '';

  if (r.status === STATUS.ERROR) {
    const reason = r.reason ?? r.logs.filter(l => l.level === 'error').map(l => l.message).join('; ') ?? 'unknown';
    return `  ${colorize(ICONS.ERROR, 'red')} ${sym}${rotatedTag} ${colorize(`error: ${reason}`, 'red')}`;
  }

  if (r.status === STATUS.SKIPPED) {
    return `  ${colorize(ICONS.INFO, 'dim')} ${colorize(`${r.symbol}/${r.interval}`, 'dim')} ${colorize(ICONS.SKIP, 'dim')} ${colorize(`skipped${r.reason ? ` (${r.reason})` : ''}`, 'dim')}`;
  }

  if (r.status === STATUS.PENDING) {
    return `  ${colorize(ICONS.INFO, 'dim')} ${colorize(`${r.symbol}/${r.interval}`, 'dim')} ${colorize(`~ pending`, 'dim')}`;
  }

  const klines = r.klinesCount ? `${colorize(ICONS.SUCCESS, 'green')} ${r.klinesCount} klines` : '';
  const setups = r.setupsDetected.length > 0
    ? colorize(r.setupsDetected.map(s => `${s.type}(${s.direction[0]})`).join(', '), 'magenta')
    : colorize('no setups', 'dim');
  const trades = r.tradesExecuted > 0 ? colorize(`${r.tradesExecuted} trade${r.tradesExecuted > 1 ? 's' : ''}`, 'green') : '';
  const time = colorize(`${r.durationMs}ms`, 'dim');

  return `  ${colorize(ICONS.ACTION, 'dim')} ${sym}${rotatedTag} ${joinParts([klines, setups, trades, time].filter(Boolean))}`;
};

export const formatBatchResults = (batch: BatchResult): string => {
  const lines: string[] = [];
  const durationMs = batch.endTime.getTime() - batch.startTime.getTime();

  lines.push('');
  lines.push(header(`cycle #${batch.batchId}`, batch.startTime, durationMs));

  const summaryParts = [
    `${batch.totalWatchers} watchers`,
    colorize(`${ICONS.SUCCESS} ${batch.successCount}`, 'green'),
    batch.skippedCount > 0 ? colorize(`${ICONS.SKIP} ${batch.skippedCount} skipped`, 'dim') : '',
    batch.errorCount > 0 ? colorize(`${ICONS.ERROR} ${batch.errorCount}`, 'red') : '',
  ];
  lines.push(`  ${joinParts(summaryParts)}`);

  const allRejections = batch.watcherResults.flatMap(r => r.rejections);
  const allFilterBlocks = batch.watcherResults.flatMap(r => r.filterChecks.filter(f => !f.passed));
  const totalRejected = batch.totalRejections + batch.totalFilterBlocks;

  let rejectionSummary = '';
  if (allRejections.length > 0 || allFilterBlocks.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const rejection of allRejections) {
      const key = rejection.reason.split(':')[0]?.trim() ?? rejection.reason;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    for (const filter of allFilterBlocks) {
      const key = `${filter.filterName}`;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    rejectionSummary = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([reason, count]) => `${count}x ${reason}`)
      .join(', ');
  }

  const detailParts = [
    batch.totalSetupsDetected > 0 ? colorize(`${batch.totalSetupsDetected} setups`, 'magenta') : '',
    batch.totalTradesExecuted > 0 ? colorize(`${batch.totalTradesExecuted} trade${batch.totalTradesExecuted > 1 ? 's' : ''}`, 'green') : '',
    totalRejected > 0
      ? colorize(`${ICONS.WARNING} ${totalRejected} rejected`, 'yellow') + (rejectionSummary ? colorize(` (${rejectionSummary})`, 'dim') : '')
      : '',
  ];
  const filteredDetailParts = detailParts.filter(Boolean);
  if (filteredDetailParts.length > 0) lines.push(`  ${joinParts(filteredDetailParts)}`);

  if (batch.watcherResults.length > 0) {
    lines.push('');
    for (const result of batch.watcherResults) {
      lines.push(formatWatcherLine(result));
    }
  }

  const setupResults = batch.watcherResults.filter(r => r.setupsDetected.length > 0);
  if (setupResults.length > 0) {
    lines.push('');
    lines.push(colorize('  > setups detected', 'magenta'));
    for (const result of setupResults) {
      for (const setup of result.setupsDetected) {
        const dirColor: ColorName = setup.direction === DIRECTION.LONG ? 'green' : 'red';
        lines.push(
          `    ${colorize(result.symbol, 'bright')} ${setup.type} ${colorize(setup.direction, dirColor)} ` +
          `${joinParts([`entry=${setup.entryPrice}`, `sl=${setup.stopLoss}`, `tp=${setup.takeProfit}`, `rr=${setup.riskReward}`, `${setup.confidence}%`])}`
        );
      }
    }
  }

  const errorResults = batch.watcherResults.filter(r => r.status === STATUS.ERROR);
  if (errorResults.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} errors`, 'red'));
    for (const result of errorResults) {
      const errorLogs = result.logs.filter(l => l.level === 'error');
      const errorMsg = result.reason ?? errorLogs.map(l => l.message).join('; ') ?? 'Unknown error';
      lines.push(`    ${colorize(ICONS.ERROR, 'red')} ${result.symbol}/${result.interval} ${colorize(errorMsg, 'red')}`);
    }
  }

  const watchersWithValidations = batch.watcherResults.filter(r => r.setupValidations && r.setupValidations.length > 0);
  if (watchersWithValidations.length > 0) {
    lines.push('');
    lines.push(colorize('  > setup analysis', 'cyan'));
    for (const result of watchersWithValidations) {
      lines.push(`    ${colorize(result.symbol, 'bright')}/${result.interval} (${result.marketType})`);
      for (const validation of result.setupValidations) {
        lines.push(...formatSetupValidation(validation));
      }
    }
  }

  const tradeResults = batch.watcherResults.filter(r => r.tradeExecutions.length > 0);
  if (tradeResults.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ACTION} trade executions`, 'green'));
    for (const result of tradeResults) {
      for (const trade of result.tradeExecutions) {
        const statusColor: ColorName = trade.status === STATUS.EXECUTED ? 'green' : trade.status === STATUS.PENDING ? 'yellow' : 'red';
        lines.push(
          `    ${colorize(result.symbol, 'bright')} ${trade.setupType} ${dirDisplay(trade.direction)} ` +
          `${joinParts([`entry=${trade.entryPrice}`, `qty=${trade.quantity}`, trade.stopLoss ? `sl=${trade.stopLoss}` : '', trade.takeProfit ? `tp=${trade.takeProfit}` : '', `${trade.orderType}`, colorize(trade.status, statusColor)].filter(Boolean))}`
        );
      }
    }
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
      const levelColor: ColorName = log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'dim';
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
    const cacheLines: string[] = [];

    if (priceCacheStats.metrics.hits + priceCacheStats.metrics.misses > 0) {
      cacheLines.push(
        `  # price-cache: ${priceCacheStats.size} entries · ` +
        `${(priceCacheStats.metrics.hitRate * 100).toFixed(1)}% hit · ` +
        `${priceCacheStats.metrics.apiFetches} API · ${priceCacheStats.metrics.websocketUpdates} WS`
      );
    }

    if (configCacheStats && (configCacheStats.hits + configCacheStats.misses > 0)) {
      cacheLines.push(
        `  # config-cache: ${configCacheStats.size} entries · ` +
        `${(configCacheStats.hitRate * 100).toFixed(1)}% hit · ` +
        `${configCacheStats.preloads} preloaded`
      );
    }

    const cacheInfo = colorize(cacheLines.join('\n'), 'dim');
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
    successCount: results.filter(r => r.status === STATUS.SUCCESS).length,
    skippedCount: results.filter(r => r.status === STATUS.SKIPPED).length,
    pendingCount: results.filter(r => r.status === STATUS.PENDING).length,
    errorCount: results.filter(r => r.status === STATUS.ERROR).length,
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
  durationMs: number,
  preloadedConfigs = 0,
  walletCount = 0
): string => {
  const lines: string[] = [];

  lines.push('');
  lines.push(header('auto-trading startup', new Date(), durationMs));

  const successCount = watchers.filter(w => w.status === STATUS.SUCCESS).length;
  const failedCount = watchers.filter(w => w.status === STATUS.FAILED).length;
  const manualCount = watchers.filter(w => w.isManual).length;
  const dynamicCount = watchers.filter(w => !w.isManual).length;

  lines.push(`  ${joinParts([
    `${persistedCount} persisted`,
    colorize(`${ICONS.SUCCESS} ${successCount} restored`, 'green'),
    failedCount > 0 ? colorize(`${ICONS.ERROR} ${failedCount} failed`, 'red') : colorize(`${ICONS.SUCCESS} 0 failed`, 'dim'),
  ])}`);

  lines.push(`  ${joinParts([
    colorize(`${manualCount} manual`, 'cyan'),
    colorize(`${dynamicCount} dynamic`, 'magenta'),
    preloadedConfigs > 0 ? colorize(`${preloadedConfigs} configs`, 'dim') : '',
    walletCount > 0 ? colorize(`${walletCount} wallets`, 'dim') : '',
  ].filter(Boolean))}`);

  if (watchers.length > 0) {
    lines.push('');
    for (const w of watchers) {
      const typeStr = w.isManual ? 'manual' : 'dynamic';
      const typeColor: ColorName = w.isManual ? 'cyan' : 'magenta';
      const icon = w.status === STATUS.SUCCESS ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
      const klinesStr = w.totalKlinesInDb ? `${(w.totalKlinesInDb / 1000).toFixed(1)}k klines` : '';
      const nextCandle = w.nextCandleClose
        ? `next ${w.nextCandleClose.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';

      lines.push(
        `  ${colorize(ICONS.ACTION, 'dim')} ${colorize(w.symbol, 'bright')}/${w.interval} ${w.marketType} ${colorize(typeStr, typeColor)} ` +
        `${icon} ${joinParts([klinesStr, nextCandle].filter(Boolean))}`
      );
    }
  }

  const failedWatchers = watchers.filter(w => w.status === STATUS.FAILED);
  if (failedWatchers.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} failed restorations`, 'red'));
    for (const w of failedWatchers) {
      lines.push(`    ${colorize(ICONS.ERROR, 'red')} ${w.symbol}/${w.interval} ${w.marketType} ${colorize(w.error ?? 'Unknown error', 'red')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
};

export const outputStartupResults = (
  watchers: RestoredWatcherInfo[],
  persistedCount: number,
  durationMs: number,
  preloadedConfigs = 0,
  walletCount = 0
): void => {
  const summary = formatStartupResults(watchers, persistedCount, durationMs, preloadedConfigs, walletCount);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

export const formatMaintenanceResults = (result: MaintenanceResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();
  const title = result.type === 'startup' ? 'startup maintenance' : 'periodic maintenance';

  lines.push('');
  lines.push(header(title, result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.pairsChecked} pairs`,
    result.totalGapsFound > 0 ? colorize(`${result.totalGapsFound} gaps`, 'yellow') : colorize('0 gaps', 'dim'),
    result.totalCandlesFilled > 0 ? colorize(`${result.totalCandlesFilled} filled`, 'green') : colorize('0 filled', 'dim'),
    result.totalCorruptedFixed > 0 ? colorize(`${result.totalCorruptedFixed} fixed`, 'blue') : colorize('0 fixed', 'dim'),
  ])}`);

  const gapsWithActivity = result.gapFills.filter(g => g.gapsFound > 0 || g.candlesFilled > 0);
  if (gapsWithActivity.length > 0) {
    lines.push('');
    lines.push(colorize('  > gap fills', 'yellow'));
    for (const g of gapsWithActivity) {
      const icon = g.status === STATUS.SUCCESS ? colorize(ICONS.SUCCESS, 'green') : g.status === STATUS.PARTIAL ? colorize(ICONS.WARNING, 'yellow') : colorize(ICONS.ERROR, 'red');
      lines.push(`    ${colorize(ICONS.ACTION, 'dim')} ${colorize(g.symbol, 'bright')}/${g.interval} ${g.gapsFound} gap${g.gapsFound !== 1 ? 's' : ''} · ${g.candlesFilled} candle${g.candlesFilled !== 1 ? 's' : ''} filled ${icon}`);
    }
  }

  const corruptionsWithActivity = result.corruptionFixes.filter(c => c.corruptedFound > 0);
  if (corruptionsWithActivity.length > 0) {
    lines.push('');
    lines.push(colorize('  > corruption fixes', 'blue'));
    for (const c of corruptionsWithActivity) {
      const icon = c.status === STATUS.SUCCESS ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
      lines.push(`    ${colorize(ICONS.ACTION, 'dim')} ${colorize(c.symbol, 'bright')}/${c.interval} ${c.corruptedFound} found · ${c.fixed} fixed ${icon}`);
    }
  }

  const errors = result.gapFills.filter(g => g.status === STATUS.ERROR);
  if (errors.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} errors`, 'red'));
    for (const e of errors) {
      lines.push(`    ${colorize(ICONS.ERROR, 'red')} ${e.symbol}/${e.interval} ${colorize(e.reason ?? 'Unknown error', 'red')}`);
    }
  }

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

  lines.push('');
  lines.push(header('symbol rotation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    colorize(result.marketType || 'futures', 'cyan'),
    colorize(result.interval, 'dim'),
    `target ${result.targetCount}`,
    result.slotsAvailable > 0 ? colorize(`${result.slotsAvailable} slots`, 'green') : colorize('0 slots', 'dim'),
  ])}`);

  if (result.added.length > 0 || result.removed.length > 0) {
    lines.push('');
    for (const symbol of result.added) {
      const validation = result.klineValidations?.find(v => v.symbol === symbol);
      let status = colorize('ready', 'green');
      if (validation && (validation.gapsFilled > 0 || validation.corruptedFixed > 0)) {
        status = colorize(`validated (gaps: ${validation.gapsFilled}, fixed: ${validation.corruptedFixed})`, 'cyan');
      }
      lines.push(`  ${colorize('+ ', 'green')}${colorize(symbol, 'bright')} added · ${status}`);
    }
    for (const symbol of result.removed) {
      lines.push(`  ${colorize('- ', 'red')}${colorize(symbol, 'bright')} removed`);
    }
  }

  const summaryParts = [
    colorize(`${result.kept} kept`, 'cyan'),
    colorize(`${result.added.length} added`, 'green'),
    colorize(`${result.removed.length} removed`, 'red'),
  ];

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientKlines.length} insufficient data`, 'dim'));
  }

  if (result.skippedInsufficientCapital.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientCapital.length} low capital`, 'dim'));
  }

  lines.push(`  ${joinParts(summaryParts)}`);

  if (result.skippedInsufficientKlines.length > 0) {
    lines.push(`  ${colorize(`${ICONS.SKIP} skipped (no data): ${result.skippedInsufficientKlines.join(', ')}`, 'dim')}`);
  }

  if (result.skippedInsufficientCapital.length > 0) {
    lines.push(`  ${colorize(`${ICONS.SKIP} skipped (capital < minNotional): ${result.skippedInsufficientCapital.join(', ')}`, 'dim')}`);
  }

  lines.push('');
  return lines.join('\n');
};

export const formatRotationNoChanges = (result: RotationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push('');
  lines.push(header('symbol rotation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    colorize(result.marketType || 'futures', 'cyan'),
    colorize(result.interval, 'dim'),
    `target ${result.targetCount}`,
  ])}`);

  const summaryParts = [
    colorize(`${ICONS.SUCCESS} no changes`, 'green'),
    colorize(`${result.kept} symbols`, 'cyan'),
  ];

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientKlines.length} no data`, 'dim'));
  }

  if (result.skippedInsufficientCapital.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientCapital.length} low capital`, 'dim'));
  }

  lines.push(`  ${joinParts(summaryParts)}`);
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

  lines.push('');
  lines.push(header('reconnection validation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.pairsChecked} pairs`,
    `${result.klinesChecked} klines`,
    result.totalMismatches > 0 ? colorize(`${ICONS.WARNING} ${result.totalMismatches} mismatches`, 'yellow') : `${ICONS.SUCCESS} 0 mismatches`,
    result.totalFixed > 0 ? colorize(`${ICONS.SUCCESS} ${result.totalFixed} fixed`, 'green') : `${ICONS.SUCCESS} 0 fixed`,
  ])}`);

  if (result.mismatches.length > 0) {
    lines.push('');
    lines.push(colorize('  > OHLC corrections', 'yellow'));
    for (const m of result.mismatches) {
      const timeStr = m.openTime.toISOString().replace('T', ' ').slice(0, 19);
      const status = m.fixed ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
      const diffStr = `${m.diffPercent.toFixed(2)}%`;
      lines.push(
        `    ${colorize(ICONS.WARNING, 'yellow')} ${m.symbol}/${m.interval} ${colorize(timeStr, 'dim')} ` +
        `${m.field.toUpperCase()} ${m.dbValue.toPrecision(6)} -> ${m.apiValue.toPrecision(6)} ${colorize(diffStr, 'yellow')} ${status}`
      );
    }
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

  lines.push('');
  lines.push(hasIssues
    ? header('position sync', result.startTime, durationMs)
    : dimHeader('position sync', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.walletsChecked} wallets`,
    result.totalOrphaned > 0 ? colorize(`${ICONS.WARNING} ${result.totalOrphaned} orphaned`, 'yellow') : `${ICONS.SUCCESS} 0 orphaned`,
    result.totalUnknown > 0 ? colorize(`${ICONS.ERROR} ${result.totalUnknown} unknown`, 'red') : `${ICONS.SUCCESS} 0 unknown`,
    result.totalUpdated > 0 ? colorize(`${ICONS.SUCCESS} ${result.totalUpdated} updated`, 'cyan') : `${ICONS.SUCCESS} 0 updated`,
  ])}`);

  if (result.orphanedPositions.length > 0) {
    lines.push('');
    lines.push(colorize('  > orphaned positions (closed on exchange but open in DB)', 'yellow'));
    for (const p of result.orphanedPositions) {
      lines.push(
        `    ${colorize(ICONS.WARNING, 'yellow')} ${p.symbol} ${dirDisplay(p.side)} ` +
        `entry=${p.entryPrice.toPrecision(6)} exit=${p.exitPrice.toPrecision(6)} qty=${p.quantity.toPrecision(4)} ` +
        `pnl=${pnlDisplay(p.pnl)} (${pnlDisplay(p.pnlPercent, '%')})`
      );
    }
  }

  if (result.unknownPositions.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} unknown positions (on exchange but NOT in DB - MANUAL CHECK REQUIRED)`, 'red'));
    for (const p of result.unknownPositions) {
      lines.push(
        `    ${colorize(ICONS.ERROR, 'red')} ${p.symbol} qty=${p.positionAmt.toPrecision(4)} ` +
        `entry=${p.entryPrice.toPrecision(6)} pnl=${pnlDisplay(p.unrealizedPnl)} ` +
        `${p.leverage}x ${p.marginType}`
      );
    }
  }

  if (result.updatedPositions.length > 0) {
    lines.push('');
    lines.push(colorize('  > position updates (synced from exchange)', 'cyan'));
    for (const p of result.updatedPositions) {
      lines.push(
        `    ${colorize(ICONS.SUCCESS, 'green')} ${p.symbol} ${p.field}: ${p.oldValue.toPrecision(6)} -> ${p.newValue.toPrecision(6)}`
      );
    }
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

  lines.push('');
  lines.push(hasActivity
    ? header('pending orders', result.startTime, durationMs)
    : dimHeader('pending orders', result.startTime, durationMs));

  const summaryParts = [
    `${result.totalChecked} orders`,
    result.filledCount > 0 ? colorize(`${ICONS.SUCCESS} ${result.filledCount} filled`, 'green') : `${ICONS.SUCCESS} 0 filled`,
    result.expiredCount > 0 ? colorize(`${ICONS.WARNING} ${result.expiredCount} expired`, 'yellow') : `${ICONS.SUCCESS} 0 expired`,
    result.invalidCount > 0 ? colorize(`${ICONS.ERROR} ${result.invalidCount} invalid`, 'red') : `${ICONS.SUCCESS} 0 invalid`,
    result.pendingCount > 0 ? colorize(`${ICONS.PENDING} ${result.pendingCount} pending`, 'cyan') : '',
    result.errorCount > 0 ? colorize(`${ICONS.ERROR} ${result.errorCount} errors`, 'red') : '',
  ].filter(Boolean);
  lines.push(`  ${joinParts(summaryParts)}`);

  const actionsToShow = result.actions.filter(a => a.action !== 'PENDING');
  if (actionsToShow.length > 0) {
    lines.push('');
    for (const action of actionsToShow) {
      const sideColor: ColorName = action.side === DIRECTION.LONG ? 'green' : 'red';
      let actionColor: ColorName = 'dim';
      let actionIcon: string = ICONS.INFO;

      switch (action.action) {
        case 'FILLED':
          actionColor = 'green';
          actionIcon = ICONS.ACTION;
          break;
        case 'EXPIRED':
          actionColor = 'yellow';
          actionIcon = ICONS.SKIP;
          break;
        case 'INVALID':
          actionColor = 'red';
          actionIcon = ICONS.ERROR;
          break;
        case 'ERROR':
          actionColor = 'red';
          actionIcon = ICONS.WARNING;
          break;
      }

      const details = action.error
        ? action.error
        : action.action === 'EXPIRED' && action.expiresAt
          ? `expired at ${action.expiresAt.toLocaleTimeString()}`
          : action.action === 'FILLED' && action.currentPrice
            ? `filled at ${action.currentPrice.toPrecision(6)}`
            : '';

      lines.push(
        `    ${colorize(actionIcon, actionColor)} ${action.symbol} ${colorize(action.side, sideColor)} ` +
        `${colorize(action.action, actionColor)}` +
        (action.limitPrice ? ` limit=${action.limitPrice.toPrecision(6)}` : '') +
        (details ? ` ${colorize(details, 'dim')}` : '')
      );
    }
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
