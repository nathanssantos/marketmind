import type { KlineValidationEntry, RotationLogEntry, RotationResult } from './types';

export class RotationLogBuffer {
  private logs: RotationLogEntry[] = [];
  private startTime: Date;
  private _marketType = 'FUTURES';
  private _targetCount = 0;
  private _slotsAvailable = 0;
  private _currentSymbols: string[] = [];
  private _optimalSymbols: string[] = [];
  private _added: string[] = [];
  private _removed: string[] = [];
  private _kept = 0;
  private _skippedInsufficientKlines: string[] = [];
  private _skippedInsufficientCapital: string[] = [];
  private _klineValidations: KlineValidationEntry[] = [];

  constructor(
    public readonly walletId: string,
    public readonly interval: string
  ) {
    this.startTime = new Date();
  }

  log(emoji: string, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date(),
      emoji,
      message,
      data,
    });
  }

  setContext(context: {
    marketType: string;
    targetCount: number;
    slotsAvailable: number;
    currentSymbols: string[];
    optimalSymbols: string[];
  }): void {
    this._marketType = context.marketType;
    this._targetCount = context.targetCount;
    this._slotsAvailable = context.slotsAvailable;
    this._currentSymbols = context.currentSymbols;
    this._optimalSymbols = context.optimalSymbols;
  }

  setResult(result: {
    added: string[];
    removed: string[];
    kept: number;
    skippedInsufficientKlines: string[];
    skippedInsufficientCapital: string[];
  }): void {
    this._added = result.added;
    this._removed = result.removed;
    this._kept = result.kept;
    this._skippedInsufficientKlines = result.skippedInsufficientKlines;
    this._skippedInsufficientCapital = result.skippedInsufficientCapital;
  }

  addKlineValidation(validation: KlineValidationEntry): void {
    this._klineValidations.push(validation);
  }

  toResult(): RotationResult {
    const hasChanges = this._added.length > 0 || this._removed.length > 0;
    return {
      walletId: this.walletId,
      startTime: this.startTime,
      endTime: new Date(),
      interval: this.interval,
      marketType: this._marketType,
      targetCount: this._targetCount,
      slotsAvailable: this._slotsAvailable,
      currentSymbols: this._currentSymbols,
      optimalSymbols: this._optimalSymbols,
      added: this._added,
      removed: this._removed,
      kept: this._kept,
      skippedInsufficientKlines: this._skippedInsufficientKlines,
      skippedInsufficientCapital: this._skippedInsufficientCapital,
      klineValidations: this._klineValidations,
      hasChanges,
      logs: this.logs,
    };
  }
}
