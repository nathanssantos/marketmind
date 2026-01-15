import type { CorruptionFixEntry, GapFillEntry, MaintenanceResult } from './types';

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
