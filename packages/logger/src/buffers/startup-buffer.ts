import type { RestoredWatcherInfo } from './types';

export class StartupLogBuffer {
  private restoredWatchers: RestoredWatcherInfo[] = [];
  private startTime: number;
  private persistedCount = 0;
  private preloadedConfigs = 0;
  private walletCount = 0;

  constructor() {
    this.startTime = Date.now();
  }

  setPersistedCount(count: number): void {
    this.persistedCount = count;
  }

  setPreloadedConfigs(configs: number, wallets: number): void {
    this.preloadedConfigs = configs;
    this.walletCount = wallets;
  }

  addRestoredWatcher(info: RestoredWatcherInfo): void {
    this.restoredWatchers.push(info);
  }

  getResults(): { watchers: RestoredWatcherInfo[]; persistedCount: number; durationMs: number; preloadedConfigs: number; walletCount: number } {
    return {
      watchers: this.restoredWatchers,
      persistedCount: this.persistedCount,
      durationMs: Date.now() - this.startTime,
      preloadedConfigs: this.preloadedConfigs,
      walletCount: this.walletCount,
    };
  }
}
