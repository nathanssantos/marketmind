import type { BacktestProgressPhase } from '@marketmind/types';
import type { WebSocketService } from '../websocket';

const ETA_MIN_PROGRESS_PERCENT = 5;
const TICK_THROTTLE_PERCENT = 5;

export interface BacktestProgressReporterOptions {
  backtestId: string;
  userId: string;
  wsService?: WebSocketService | null;
}

export class BacktestProgressReporter {
  private readonly backtestId: string;
  private readonly userId: string;
  private readonly wsService: WebSocketService | null;
  private readonly startedAt: number;
  private phase: BacktestProgressPhase = 'fetchingKlines';
  private total = 1;
  private processed = 0;
  private lastEmittedPercent = -1;

  constructor(options: BacktestProgressReporterOptions) {
    this.backtestId = options.backtestId;
    this.userId = options.userId;
    this.wsService = options.wsService ?? null;
    this.startedAt = Date.now();
  }

  setPhase(phase: BacktestProgressPhase, total: number): void {
    this.phase = phase;
    this.total = Math.max(total, 1);
    this.processed = 0;
    this.lastEmittedPercent = -1;
    this.emit();
  }

  tick(processed: number): void {
    this.processed = Math.min(Math.max(processed, 0), this.total);
    const pct = Math.floor((this.processed / this.total) * 100);
    if (pct >= this.lastEmittedPercent + TICK_THROTTLE_PERCENT || this.processed === this.total) {
      this.emit();
    }
  }

  complete(resultId: string): void {
    if (!this.wsService) return;
    this.wsService.emitBacktestComplete(this.userId, {
      backtestId: this.backtestId,
      resultId,
      durationMs: Date.now() - this.startedAt,
    });
  }

  fail(error: string): void {
    if (!this.wsService) return;
    this.wsService.emitBacktestFailed(this.userId, {
      backtestId: this.backtestId,
      error,
    });
  }

  private emit(): void {
    if (!this.wsService) return;
    const pct = Math.floor((this.processed / this.total) * 100);
    const elapsed = Date.now() - this.startedAt;
    const etaMs = pct > ETA_MIN_PROGRESS_PERCENT && this.processed > 0
      ? Math.max(0, Math.round((elapsed / this.processed) * (this.total - this.processed)))
      : null;

    this.lastEmittedPercent = pct;

    this.wsService.emitBacktestProgress(this.userId, {
      backtestId: this.backtestId,
      phase: this.phase,
      processed: this.processed,
      total: this.total,
      etaMs,
      startedAt: this.startedAt,
    });
  }
}
