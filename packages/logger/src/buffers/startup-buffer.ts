import type { RestoredWatcherInfo } from './types';

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
