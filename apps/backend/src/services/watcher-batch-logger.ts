import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../../logs/auto-trading.log');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const TABLE_CHARS = {
  top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
  bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
  left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
  right: '│', 'right-mid': '┤', middle: '│',
};

const colorize = (text: string, color: keyof typeof COLORS): string =>
  `${COLORS[color]}${text}${COLORS.reset}`;

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  emoji: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SetupLogEntry {
  type: string;
  direction: string;
  confidence: number;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskReward: string;
}

export interface FilterCheckEntry {
  filterName: string;
  passed: boolean;
  reason: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RejectionEntry {
  setupType: string;
  direction: string;
  reason: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface TradeExecutionEntry {
  setupType: string;
  direction: string;
  entryPrice: string;
  quantity: string;
  stopLoss?: string;
  takeProfit?: string;
  orderType: string;
  status: 'executed' | 'pending' | 'failed';
}

export interface WatcherResult {
  watcherId: string;
  symbol: string;
  interval: string;
  marketType: string;
  profileName?: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  klinesCount?: number;
  setupsDetected: SetupLogEntry[];
  filterChecks: FilterCheckEntry[];
  rejections: RejectionEntry[];
  tradeExecutions: TradeExecutionEntry[];
  tradesExecuted: number;
  durationMs: number;
  logs: LogEntry[];
}

export interface BatchResult {
  batchId: number;
  startTime: Date;
  endTime: Date;
  totalWatchers: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  totalSetupsDetected: number;
  totalRejections: number;
  totalFilterBlocks: number;
  totalTradesExecuted: number;
  watcherResults: WatcherResult[];
}

export class WatcherLogBuffer {
  private logs: LogEntry[] = [];
  private setups: SetupLogEntry[] = [];
  private filters: FilterCheckEntry[] = [];
  private rejectionList: RejectionEntry[] = [];
  private executions: TradeExecutionEntry[] = [];
  private tradesExecuted = 0;
  private startTime: number;

  constructor(
    public readonly watcherId: string,
    public readonly symbol: string,
    public readonly interval: string,
    public readonly marketType: string,
    public readonly profileName?: string
  ) {
    this.startTime = Date.now();
  }

  log(emoji: string, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date(),
      level: 'info',
      emoji,
      message,
      data,
    });
  }

  warn(emoji: string, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date(),
      level: 'warn',
      emoji,
      message,
      data,
    });
  }

  error(emoji: string, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date(),
      level: 'error',
      emoji,
      message,
      data,
    });
  }

  addSetup(setup: SetupLogEntry): void {
    this.setups.push(setup);
  }

  addFilterCheck(filter: FilterCheckEntry): void {
    this.filters.push(filter);
  }

  addRejection(rejection: RejectionEntry): void {
    this.rejectionList.push(rejection);
  }

  addTradeExecution(execution: TradeExecutionEntry): void {
    this.executions.push(execution);
  }

  incrementTrades(): void {
    this.tradesExecuted++;
  }

  toResult(status: 'success' | 'skipped' | 'error', reason?: string, klinesCount?: number): WatcherResult {
    return {
      watcherId: this.watcherId,
      symbol: this.symbol,
      interval: this.interval,
      marketType: this.marketType,
      profileName: this.profileName,
      status,
      reason,
      klinesCount,
      setupsDetected: this.setups,
      filterChecks: this.filters,
      rejections: this.rejectionList,
      tradeExecutions: this.executions,
      tradesExecuted: this.tradesExecuted,
      durationMs: Date.now() - this.startTime,
      logs: this.logs,
    };
  }
}

const ensureLogDir = (): void => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

const stripAnsi = (str: string): string =>
  str.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');

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
    case 'error': return colorize('❌ ERR', 'red');
    default: return status;
  }
};

export const formatBatchResults = (batch: BatchResult): string => {
  const lines: string[] = [];
  const durationMs = batch.endTime.getTime() - batch.startTime.getTime();

  lines.push('');
  lines.push(colorize(`═══════════════════════════════════════════════════════════════════════════════════════════════`, 'cyan'));
  lines.push(colorize(`  🔄 BATCH #${batch.batchId}`, 'bright') + colorize(` │ ${batch.startTime.toLocaleTimeString()} │ Duration: ${durationMs}ms`, 'dim'));
  lines.push(colorize(`═══════════════════════════════════════════════════════════════════════════════════════════════`, 'cyan'));

  const summaryParts = [
    `${batch.totalWatchers} watchers`,
    colorize(`✅ ${batch.successCount}`, 'green'),
    colorize(`⏭️ ${batch.skippedCount}`, 'yellow'),
    colorize(`❌ ${batch.errorCount}`, 'red'),
  ];
  const detailParts = [
    colorize(`📍 ${batch.totalSetupsDetected} setups`, 'magenta'),
    colorize(`🚫 ${batch.totalRejections} rejected`, 'yellow'),
    colorize(`🔒 ${batch.totalFilterBlocks} blocked`, 'red'),
    colorize(`💹 ${batch.totalTradesExecuted} trades`, 'blue'),
  ];
  lines.push(`  📊 ${summaryParts.join(' │ ')}`);
  lines.push(`  📈 ${detailParts.join(' │ ')}`);

  if (batch.watcherResults.length > 0) {
    const watcherTable = new Table({
      head: ['Symbol', 'Interval', 'Market', 'Status', 'Klines', 'Setups', 'Trades', 'Time', 'Details'],
      colWidths: [14, 10, 10, 12, 8, 8, 8, 10, 40],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
      chars: {
        top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
        right: '│', 'right-mid': '┤', middle: '│',
      },
    });

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
        details.slice(0, 38),
      ]);
    }

    lines.push(watcherTable.toString());
  }

  const setupResults = batch.watcherResults.filter(r => r.setupsDetected.length > 0);
  if (setupResults.length > 0) {
    lines.push('');
    lines.push(colorize('  📍 DETECTED SETUPS', 'magenta'));

    const setupTable = new Table({
      head: ['Symbol', 'Strategy', 'Dir', 'Conf', 'Entry', 'Stop Loss', 'Take Profit', 'R:R'],
      colWidths: [14, 28, 7, 7, 16, 16, 16, 8],
      style: {
        head: ['magenta'],
        border: ['gray'],
      },
      chars: {
        top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
        right: '│', 'right-mid': '┤', middle: '│',
      },
    });

    for (const result of setupResults) {
      for (const setup of result.setupsDetected) {
        const dirColor = setup.direction === 'LONG' ? 'green' : 'red';
        setupTable.push([
          colorize(result.symbol, 'bright'),
          setup.type.slice(0, 26),
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
    lines.push('');
    lines.push(colorize('  ❌ ERRORS', 'red'));

    const errorTable = new Table({
      head: ['Symbol', 'Interval', 'Error'],
      colWidths: [14, 10, 80],
      style: {
        head: ['red'],
        border: ['gray'],
      },
    });

    for (const result of errorResults) {
      const errorLogs = result.logs.filter(l => l.level === 'error');
      const errorMsg = result.reason ?? errorLogs.map(l => l.message).join('; ') ?? 'Unknown error';
      errorTable.push([
        result.symbol,
        result.interval,
        colorize(errorMsg.slice(0, 78), 'red'),
      ]);
    }

    lines.push(errorTable.toString());
  }

  const rejectionResults = batch.watcherResults.filter(r => r.rejections.length > 0);
  if (rejectionResults.length > 0) {
    lines.push('');
    lines.push(colorize('  🚫 SETUP REJECTIONS', 'yellow'));

    const rejectionTable = new Table({
      head: ['Symbol', 'Setup', 'Dir', 'Reason', 'Details'],
      colWidths: [14, 24, 7, 28, 35],
      style: {
        head: ['yellow'],
        border: ['gray'],
      },
      chars: TABLE_CHARS,
    });

    for (const result of rejectionResults) {
      for (const rejection of result.rejections) {
        const dirColor = rejection.direction === 'LONG' ? 'green' : 'red';
        const detailStr = rejection.details
          ? Object.entries(rejection.details).map(([k, v]) => `${k}:${v}`).join(' ').slice(0, 33)
          : '-';
        rejectionTable.push([
          colorize(result.symbol, 'bright'),
          rejection.setupType.slice(0, 22),
          colorize(rejection.direction, dirColor),
          colorize(rejection.reason.slice(0, 26), 'yellow'),
          detailStr,
        ]);
      }
    }

    lines.push(rejectionTable.toString());
  }

  const filterBlockResults = batch.watcherResults.filter(r => r.filterChecks.some(f => !f.passed));
  if (filterBlockResults.length > 0) {
    lines.push('');
    lines.push(colorize('  🔒 FILTER BLOCKS', 'red'));

    const filterTable = new Table({
      head: ['Symbol', 'Filter', 'Reason', 'Details'],
      colWidths: [14, 20, 35, 40],
      style: {
        head: ['red'],
        border: ['gray'],
      },
      chars: TABLE_CHARS,
    });

    for (const result of filterBlockResults) {
      for (const filter of result.filterChecks.filter(f => !f.passed)) {
        const detailStr = filter.details
          ? Object.entries(filter.details).map(([k, v]) => `${k}:${v}`).join(' ').slice(0, 38)
          : '-';
        filterTable.push([
          colorize(result.symbol, 'bright'),
          colorize(filter.filterName, 'red'),
          filter.reason.slice(0, 33),
          detailStr,
        ]);
      }
    }

    lines.push(filterTable.toString());
  }

  const tradeResults = batch.watcherResults.filter(r => r.tradeExecutions.length > 0);
  if (tradeResults.length > 0) {
    lines.push('');
    lines.push(colorize('  💹 TRADE EXECUTIONS', 'blue'));

    const tradeTable = new Table({
      head: ['Symbol', 'Setup', 'Dir', 'Entry', 'Qty', 'SL', 'TP', 'Type', 'Status'],
      colWidths: [14, 20, 7, 14, 14, 14, 14, 10, 10],
      style: {
        head: ['blue'],
        border: ['gray'],
      },
      chars: TABLE_CHARS,
    });

    for (const result of tradeResults) {
      for (const trade of result.tradeExecutions) {
        const dirColor = trade.direction === 'LONG' ? 'green' : 'red';
        const statusColor = trade.status === 'executed' ? 'green' : trade.status === 'pending' ? 'yellow' : 'red';
        tradeTable.push([
          colorize(result.symbol, 'bright'),
          trade.setupType.slice(0, 18),
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

export const outputBatchResults = (batch: BatchResult, verbose = false): void => {
  const summary = formatBatchResults(batch);
  console.log(summary);
  writeToFile(`${summary}\n`);

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
    errorCount: results.filter(r => r.status === 'error').length,
    totalSetupsDetected: results.reduce((sum, r) => sum + r.setupsDetected.length, 0),
    totalRejections: results.reduce((sum, r) => sum + r.rejections.length, 0),
    totalFilterBlocks: filterBlocks,
    totalTradesExecuted: results.reduce((sum, r) => sum + r.tradesExecuted, 0),
    watcherResults: results,
  };
};

export interface RestoredWatcherInfo {
  symbol: string;
  interval: string;
  marketType: string;
  profileId?: string;
  isManual: boolean;
  status: 'success' | 'failed';
  error?: string;
  klinesPrefetched?: number;
  totalKlinesInDb?: number;
  nextCandleClose?: Date;
}

export class StartupLogBuffer {
  private restoredWatchers: RestoredWatcherInfo[] = [];
  private startTime: number;
  private persistedCount = 0;

  constructor() {
    this.startTime = Date.now();
  }

  setPersistedCount(count: number): void {
    this.persistedCount = count;
  }

  addRestoredWatcher(info: RestoredWatcherInfo): void {
    this.restoredWatchers.push(info);
  }

  getResults(): { watchers: RestoredWatcherInfo[]; persistedCount: number; durationMs: number } {
    return {
      watchers: this.restoredWatchers,
      persistedCount: this.persistedCount,
      durationMs: Date.now() - this.startTime,
    };
  }
}

export const formatStartupResults = (
  watchers: RestoredWatcherInfo[],
  persistedCount: number,
  durationMs: number
): string => {
  const lines: string[] = [];

  lines.push('');
  lines.push(colorize('═══════════════════════════════════════════════════════════════════════════════════════════════', 'cyan'));
  lines.push(colorize(`  🚀 AUTO-TRADING STARTUP`, 'bright') + colorize(` │ ${new Date().toLocaleTimeString()} │ Duration: ${durationMs}ms`, 'dim'));
  lines.push(colorize('═══════════════════════════════════════════════════════════════════════════════════════════════', 'cyan'));

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
  lines.push(`  📋 ${summaryParts.join(' │ ')}`);
  lines.push(`  📊 ${typeParts.join(' │ ')}`);

  if (watchers.length > 0) {
    const watcherTable = new Table({
      head: ['Symbol', 'Interval', 'Market', 'Type', 'Status', 'Klines', 'Next Candle'],
      colWidths: [14, 10, 10, 10, 10, 10, 22],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
      chars: TABLE_CHARS,
    });

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

    lines.push('');
    lines.push(colorize('  📡 RESTORED WATCHERS', 'cyan'));
    lines.push(watcherTable.toString());
  }

  const failedWatchers = watchers.filter(w => w.status === 'failed');
  if (failedWatchers.length > 0) {
    lines.push('');
    lines.push(colorize('  ❌ FAILED RESTORATIONS', 'red'));

    const errorTable = new Table({
      head: ['Symbol', 'Interval', 'Market', 'Error'],
      colWidths: [14, 10, 10, 60],
      style: {
        head: ['red'],
        border: ['gray'],
      },
      chars: TABLE_CHARS,
    });

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

export interface GapFillEntry {
  symbol: string;
  interval: string;
  marketType: string;
  gapsFound: number;
  candlesFilled: number;
  status: 'success' | 'partial' | 'skipped' | 'error';
  reason?: string;
}

export interface CorruptionFixEntry {
  symbol: string;
  interval: string;
  marketType: string;
  corruptedFound: number;
  fixed: number;
  status: 'success' | 'partial' | 'error';
}

export interface MaintenanceResult {
  type: 'startup' | 'periodic';
  startTime: Date;
  endTime: Date;
  pairsChecked: number;
  totalGapsFound: number;
  totalCandlesFilled: number;
  totalCorruptedFixed: number;
  gapFills: GapFillEntry[];
  corruptionFixes: CorruptionFixEntry[];
}

export class MaintenanceLogBuffer {
  private gapFills: GapFillEntry[] = [];
  private corruptionFixes: CorruptionFixEntry[] = [];
  private startTime: number;
  private type: 'startup' | 'periodic';
  private pairsChecked = 0;

  constructor(type: 'startup' | 'periodic' = 'startup') {
    this.startTime = Date.now();
    this.type = type;
  }

  setPairsChecked(count: number): void {
    this.pairsChecked = count;
  }

  addGapFill(entry: GapFillEntry): void {
    this.gapFills.push(entry);
  }

  addCorruptionFix(entry: CorruptionFixEntry): void {
    this.corruptionFixes.push(entry);
  }

  toResult(): MaintenanceResult {
    return {
      type: this.type,
      startTime: new Date(this.startTime),
      endTime: new Date(),
      pairsChecked: this.pairsChecked,
      totalGapsFound: this.gapFills.reduce((sum, g) => sum + g.gapsFound, 0),
      totalCandlesFilled: this.gapFills.reduce((sum, g) => sum + g.candlesFilled, 0),
      totalCorruptedFixed: this.corruptionFixes.reduce((sum, c) => sum + c.fixed, 0),
      gapFills: this.gapFills,
      corruptionFixes: this.corruptionFixes,
    };
  }
}

const getMaintenanceStatusDisplay = (status: 'success' | 'partial' | 'skipped' | 'error'): { color: keyof typeof COLORS; icon: string } => {
  if (status === 'success') return { color: 'green', icon: '✅' };
  if (status === 'partial') return { color: 'yellow', icon: '⚠️' };
  return { color: 'red', icon: '❌' };
};

const formatGapFillsTable = (gapFills: GapFillEntry[]): string[] => {
  const lines: string[] = [];
  const gapsWithActivity = gapFills.filter(g => g.gapsFound > 0 || g.candlesFilled > 0);
  if (gapsWithActivity.length === 0) return lines;

  lines.push('');
  lines.push(colorize('  📉 GAP FILLS', 'yellow'));

  const gapTable = new Table({
    head: ['Symbol', 'Interval', 'Market', 'Gaps', 'Candles', 'Status'],
    colWidths: [14, 10, 10, 8, 10, 12],
    style: { head: ['yellow'], border: ['gray'] },
    chars: TABLE_CHARS,
  });

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

  lines.push('');
  lines.push(colorize('  🛠️ CORRUPTION FIXES', 'blue'));

  const corruptionTable = new Table({
    head: ['Symbol', 'Interval', 'Market', 'Found', 'Fixed', 'Status'],
    colWidths: [14, 10, 10, 8, 8, 12],
    style: { head: ['blue'], border: ['gray'] },
    chars: TABLE_CHARS,
  });

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

  lines.push('');
  lines.push(colorize('  ❌ ERRORS', 'red'));

  const errorTable = new Table({
    head: ['Symbol', 'Interval', 'Market', 'Error'],
    colWidths: [14, 10, 10, 60],
    style: { head: ['red'], border: ['gray'] },
    chars: TABLE_CHARS,
  });

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
  const title = result.type === 'startup' ? '🔧 KLINE MAINTENANCE (STARTUP)' : '🔧 KLINE MAINTENANCE (PERIODIC)';

  lines.push('');
  lines.push(colorize('═══════════════════════════════════════════════════════════════════════════════════════════════', 'cyan'));
  lines.push(colorize(`  ${title}`, 'bright') + colorize(` │ ${result.startTime.toLocaleTimeString()} │ Duration: ${durationMs}ms`, 'dim'));
  lines.push(colorize('═══════════════════════════════════════════════════════════════════════════════════════════════', 'cyan'));

  const summaryParts = [
    `${result.pairsChecked} pairs`,
    colorize(`🔍 ${result.totalGapsFound} gaps`, result.totalGapsFound > 0 ? 'yellow' : 'dim'),
    colorize(`📥 ${result.totalCandlesFilled} filled`, result.totalCandlesFilled > 0 ? 'green' : 'dim'),
    colorize(`🛠️ ${result.totalCorruptedFixed} fixed`, result.totalCorruptedFixed > 0 ? 'blue' : 'dim'),
  ];
  lines.push(`  📊 ${summaryParts.join(' │ ')}`);

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
