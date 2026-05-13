import {
    colorize,
    MaintenanceLogBuffer,
    RotationLogBuffer,
    StartupLogBuffer,
    stripAnsi,
    WatcherLogBuffer,
    type BatchResult,
    type CorruptionFixEntry,
    type FilterCheckEntry,
    type GapFillEntry,
    type LogEntry,
    type MaintenanceResult,
    type RejectionEntry,
    type RestoredWatcherInfo,
    type RotationResult,
    type SetupLogEntry,
    type TradeExecutionEntry,
    type WatcherResult,
} from '@marketmind/logger';
import type { PendingOrdersCheckResult, PositionSyncResult, ReconnectionValidationResult } from '@marketmind/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceCache } from './price-cache';
import {
    formatBatchResults,
    formatDetailedLogs,
    formatMaintenanceResults,
    formatPendingOrdersCheckResults,
    formatPositionSyncResults,
    formatReconnectionValidationResults,
    formatRotationNoChanges,
    formatRotationResults,
    header,
} from './watcher-batch-formatters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../../logs/trading-engine.log');

export {
    MaintenanceLogBuffer,
    RotationLogBuffer, StartupLogBuffer, WatcherLogBuffer, type BatchResult, type CorruptionFixEntry, type FilterCheckEntry, type GapFillEntry, type LogEntry, type MaintenanceResult, type RejectionEntry, type RestoredWatcherInfo, type RotationResult, type SetupLogEntry, type TradeExecutionEntry, type WatcherResult
};

export {
    formatBatchResults,
    formatDetailedLogs,
    formatMaintenanceResults,
    formatPendingOrdersCheckResults,
    formatPositionSyncResults,
    formatReconnectionValidationResults,
    formatRotationNoChanges,
    formatRotationResults,
} from './watcher-batch-formatters';

const STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

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

  const ICONS = { SUCCESS: '✓', ERROR: '✗', ACTION: '>' } as const;
  const joinParts = (parts: string[]): string => parts.filter(Boolean).join(colorize(' · ', 'dim'));

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
      const typeColor = w.isManual ? 'cyan' : 'magenta';
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

export const outputMaintenanceResults = (result: MaintenanceResult): void => {
  if (result.totalGapsFound === 0 && result.totalCorruptedFixed === 0 && result.type === 'periodic') return;

  const summary = formatMaintenanceResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
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

export const outputReconnectionValidationResults = (result: ReconnectionValidationResult): void => {
  if (result.totalMismatches === 0) return;

  const summary = formatReconnectionValidationResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

export const outputPositionSyncResults = (result: PositionSyncResult): void => {
  const hasIssues = result.totalOrphaned > 0 || result.totalUnknown > 0 || result.totalUpdated > 0;
  if (!hasIssues) return;

  const summary = formatPositionSyncResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};

export const outputPendingOrdersCheckResults = (result: PendingOrdersCheckResult): void => {
  const hasActivity = result.expiredCount > 0 || result.invalidCount > 0 || result.filledCount > 0 || result.errorCount > 0;
  if (!hasActivity) return;

  const summary = formatPendingOrdersCheckResults(result);
  console.log(summary);
  writeToFile(`${summary}\n`);
};
