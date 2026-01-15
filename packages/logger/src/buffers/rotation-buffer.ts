import type { RotationLogEntry, RotationResult } from './types';

export class RotationLogBuffer {
  private logs: RotationLogEntry[] = [];
  private startTime: Date;
  private _added: string[] = [];
  private _removed: string[] = [];
  private _kept = 0;
  private _skippedWithPositions: string[] = [];
  private _skippedInsufficientKlines: string[] = [];

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

  setResult(result: {
    added: string[];
    removed: string[];
    kept: number;
    skippedWithPositions: string[];
    skippedInsufficientKlines: string[];
  }): void {
    this._added = result.added;
    this._removed = result.removed;
    this._kept = result.kept;
    this._skippedWithPositions = result.skippedWithPositions;
    this._skippedInsufficientKlines = result.skippedInsufficientKlines;
  }

  toResult(): RotationResult {
    const hasChanges = this._added.length > 0 || this._removed.length > 0;
    return {
      walletId: this.walletId,
      startTime: this.startTime,
      endTime: new Date(),
      interval: this.interval,
      added: this._added,
      removed: this._removed,
      kept: this._kept,
      skippedWithPositions: this._skippedWithPositions,
      skippedInsufficientKlines: this._skippedInsufficientKlines,
      hasChanges,
      logs: this.logs,
    };
  }
}
