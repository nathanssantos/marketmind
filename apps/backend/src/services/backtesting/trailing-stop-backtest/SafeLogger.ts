import type { WriteStream } from 'fs';
import { createWriteStream } from 'fs';
import type { LogLevel, OutputConfig, BacktestProgress } from './types';

const DEFAULT_CONFIG: OutputConfig = {
  logLevel: 'summary',
  progressIntervalPercent: 5,
  progressIntervalSeconds: 30,
  outputFile: '',
  maxConsoleLines: 1000,
};

export class SafeLogger {
  private config: OutputConfig;
  private lineCount = 0;
  private lastProgressTime = 0;
  private lastProgressPercent = 0;
  private fileStream: WriteStream | null = null;
  private truncated = false;

  constructor(config: Partial<OutputConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.outputFile) {
      this.fileStream = createWriteStream(this.config.outputFile, { flags: 'w' });
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.config.logLevel === 'silent') return false;
    if (this.config.logLevel === 'summary' && level === 'verbose') return false;
    return true;
  }

  private writeToConsole(message: string): void {
    if (this.truncated) return;

    if (this.lineCount >= this.config.maxConsoleLines) {
      console.log('... [output truncated, see file for full results]');
      this.truncated = true;
      return;
    }

    console.log(message);
    this.lineCount++;
  }

  private writeToFile(message: string): void {
    if (this.fileStream) {
      this.fileStream.write(`${message  }\n`);
    }
  }

  log(message: string, level: LogLevel = 'summary'): void {
    const formatted = `[${this.formatTimestamp()}] ${message}`;

    this.writeToFile(formatted);

    if (this.shouldLog(level)) {
      this.writeToConsole(formatted);
    }
  }

  info(message: string): void {
    this.log(message, 'summary');
  }

  verbose(message: string): void {
    this.log(message, 'verbose');
  }

  error(message: string): void {
    const formatted = `[${this.formatTimestamp()}] ERROR: ${message}`;
    this.writeToFile(formatted);
    console.error(formatted);
  }

  progress(progress: BacktestProgress): void {
    const now = Date.now();
    const percentDiff = progress.percentComplete - this.lastProgressPercent;
    const timeDiff = (now - this.lastProgressTime) / 1000;

    const shouldReport =
      percentDiff >= this.config.progressIntervalPercent ||
      timeDiff >= this.config.progressIntervalSeconds ||
      progress.percentComplete === 100 ||
      this.lastProgressTime === 0;

    if (!shouldReport) return;

    this.lastProgressTime = now;
    this.lastProgressPercent = progress.percentComplete;

    const eta = progress.estimatedRemainingMs > 0
      ? this.formatDuration(progress.estimatedRemainingMs)
      : '--';

    const message = [
      `Progress: ${progress.percentComplete.toFixed(0).padStart(3)}%`,
      `(${progress.currentCombination.toString().padStart(5)}/${progress.totalCombinations})`,
      `| ETA: ${eta}`,
      `| Best PnL: ${progress.bestPnlSoFar >= 0 ? '+' : ''}${progress.bestPnlSoFar.toFixed(1)}%`,
    ].join(' ');

    this.log(message, 'summary');
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  summary(results: {
    totalCombinations: number;
    elapsedMs: number;
    top3: Array<{ pnl: number; sharpe: number; maxDrawdown: number; score: number }>;
    outputFile?: string;
  }): void {
    const duration = this.formatDuration(results.elapsedMs);

    this.log(`Completed: ${results.totalCombinations} combinations | Total time: ${duration}`, 'summary');

    if (results.outputFile) {
      this.log(`Results saved to: ${results.outputFile}`, 'summary');
    }

    if (results.top3.length > 0) {
      this.log('Top 3 by composite score:', 'summary');
      results.top3.forEach((r, i) => {
        const pnlSign = r.pnl >= 0 ? '+' : '';
        this.log(
          `  ${i + 1}. PnL: ${pnlSign}${r.pnl.toFixed(1)}% | Sharpe: ${r.sharpe.toFixed(2)} | DD: ${r.maxDrawdown.toFixed(1)}% | Score: ${r.score.toFixed(3)}`,
          'summary'
        );
      });
    }
  }

  startRun(config: { totalCombinations: number; symbol: string; period: string }): void {
    this.log(`Starting optimization: ${config.totalCombinations} combinations`, 'summary');
    this.log(`Symbol: ${config.symbol} | Period: ${config.period}`, 'summary');
    this.lineCount = 2;
    this.truncated = false;
    this.lastProgressTime = 0;
    this.lastProgressPercent = 0;
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

export const createSafeLogger = (config: Partial<OutputConfig> = {}): SafeLogger => new SafeLogger(config);
