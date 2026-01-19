export interface FrontendLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  emoji: string;
  message: string;
  symbol?: string;
  interval?: string;
}

const MAX_ENTRIES = 500;

class AutoTradingLogBuffer {
  private buffers: Map<string, FrontendLogEntry[]> = new Map();
  private idCounter = 0;

  generateId(): string {
    return `${Date.now()}-${++this.idCounter}`;
  }

  addLog(walletId: string, entry: Omit<FrontendLogEntry, 'id'>): FrontendLogEntry {
    const buffer = this.buffers.get(walletId) ?? [];
    const fullEntry: FrontendLogEntry = { ...entry, id: this.generateId() };

    buffer.push(fullEntry);
    if (buffer.length > MAX_ENTRIES) buffer.shift();

    this.buffers.set(walletId, buffer);
    return fullEntry;
  }

  getRecentLogs(walletId: string, limit = 100): FrontendLogEntry[] {
    const buffer = this.buffers.get(walletId) ?? [];
    return buffer.slice(-limit);
  }

  clear(walletId: string): void {
    this.buffers.delete(walletId);
  }

  clearAll(): void {
    this.buffers.clear();
  }
}

export const autoTradingLogBuffer = new AutoTradingLogBuffer();
