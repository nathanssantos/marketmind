import type {
  FilterCheckEntry,
  LogEntry,
  RejectionEntry,
  SetupLogEntry,
  TradeExecutionEntry,
  WatcherResult,
} from './types';

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
