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
  totalTradesExecuted: number;
  watcherResults: WatcherResult[];
}

export class WatcherLogBuffer {
  private logs: LogEntry[] = [];
  private setups: SetupLogEntry[] = [];
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
    colorize(`📍 ${batch.totalSetupsDetected} setups`, 'magenta'),
    colorize(`💹 ${batch.totalTradesExecuted} trades`, 'blue'),
  ];
  lines.push(`  📊 ${summaryParts.join(' │ ')}`);

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
  return {
    batchId,
    startTime,
    endTime,
    totalWatchers: results.length,
    successCount: results.filter(r => r.status === 'success').length,
    skippedCount: results.filter(r => r.status === 'skipped').length,
    errorCount: results.filter(r => r.status === 'error').length,
    totalSetupsDetected: results.reduce((sum, r) => sum + r.setupsDetected.length, 0),
    totalTradesExecuted: results.reduce((sum, r) => sum + r.tradesExecuted, 0),
    watcherResults: results,
  };
};
