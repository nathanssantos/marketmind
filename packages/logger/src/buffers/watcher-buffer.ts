import type { PositionSide } from '@marketmind/types';
import type {
    FilterCheckEntry,
    LogEntry,
    RejectionEntry,
    SetupLogEntry,
    SetupValidationEntry,
    TradeExecutionEntry,
    ValidationCheck,
    WatcherResult,
} from './types';

export class WatcherLogBuffer {
  private logs: LogEntry[] = [];
  private setups: SetupLogEntry[] = [];
  private filters: FilterCheckEntry[] = [];
  private rejectionList: RejectionEntry[] = [];
  private executions: TradeExecutionEntry[] = [];
  private validations: SetupValidationEntry[] = [];
  private currentValidation: SetupValidationEntry | null = null;
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

  startSetupValidation(setup: {
    type: string;
    direction: PositionSide;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence: number;
    riskReward?: number;
  }): void {
    this.currentValidation = {
      setupType: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice.toFixed(4),
      stopLoss: setup.stopLoss?.toFixed(4),
      takeProfit: setup.takeProfit?.toFixed(4),
      confidence: setup.confidence,
      riskReward: setup.riskReward?.toFixed(2),
      checks: [],
      outcome: 'pending',
    };
  }

  addValidationCheck(check: ValidationCheck): void {
    if (this.currentValidation) {
      this.currentValidation.checks.push(check);
    }
  }

  completeSetupValidation(
    outcome: 'executed' | 'blocked' | 'failed',
    reason?: string,
    execution?: { quantity: string; orderType: string }
  ): void {
    if (this.currentValidation) {
      this.currentValidation.outcome = outcome;
      this.currentValidation.outcomeReason = reason;
      this.currentValidation.execution = execution;
      this.validations.push(this.currentValidation);
      this.currentValidation = null;
    }
  }

  getCurrentValidation(): SetupValidationEntry | null {
    return this.currentValidation;
  }

  toResult(
    status: 'success' | 'skipped' | 'pending' | 'error',
    reason?: string,
    klinesCount?: number,
    isRecentlyRotated?: boolean
  ): WatcherResult {
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
      setupValidations: this.validations,
      tradesExecuted: this.tradesExecuted,
      durationMs: Date.now() - this.startTime,
      logs: this.logs,
      isRecentlyRotated,
    };
  }
}
