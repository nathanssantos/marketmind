import type { Kline } from '@marketmind/types';
import type { KlineIndex } from './types';

export class GranularPriceIndex implements KlineIndex {
  private index: Map<number, Kline>;
  private sortedTimestamps: number[];
  public readonly size: number;
  public readonly firstTimestamp: number;
  public readonly lastTimestamp: number;

  constructor(klines: Kline[]) {
    this.index = new Map();
    this.sortedTimestamps = [];

    for (const kline of klines) {
      const ts = kline.openTime;
      this.index.set(ts, kline);
      this.sortedTimestamps.push(ts);
    }

    this.sortedTimestamps.sort((a, b) => a - b);
    this.size = this.sortedTimestamps.length;
    this.firstTimestamp = this.sortedTimestamps[0] ?? 0;
    this.lastTimestamp = this.sortedTimestamps[this.sortedTimestamps.length - 1] ?? 0;
  }

  get(timestamp: number): Kline | undefined {
    return this.index.get(timestamp);
  }

  getNearest(timestamp: number): Kline | undefined {
    if (this.size === 0) return undefined;

    let left = 0;
    let right = this.sortedTimestamps.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.sortedTimestamps[mid]! < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    const ts = this.sortedTimestamps[left];
    return ts !== undefined ? this.index.get(ts) : undefined;
  }

  getRange(startTs: number, endTs: number): Kline[] {
    const result: Kline[] = [];

    const startIdx = this.findStartIndex(startTs);
    if (startIdx === -1) return result;

    for (let i = startIdx; i < this.sortedTimestamps.length; i++) {
      const ts = this.sortedTimestamps[i]!;
      if (ts > endTs) break;

      const kline = this.index.get(ts);
      if (kline) result.push(kline);
    }

    return result;
  }

  *iterate(startTs: number, endTs: number): Generator<Kline> {
    const startIdx = this.findStartIndex(startTs);
    if (startIdx === -1) return;

    for (let i = startIdx; i < this.sortedTimestamps.length; i++) {
      const ts = this.sortedTimestamps[i]!;
      if (ts > endTs) break;

      const kline = this.index.get(ts);
      if (kline) yield kline;
    }
  }

  private findStartIndex(targetTs: number): number {
    if (this.size === 0) return -1;

    let left = 0;
    let right = this.sortedTimestamps.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.sortedTimestamps[mid]! < targetTs) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    if (this.sortedTimestamps[left]! >= targetTs) {
      return left;
    }

    return -1;
  }

  getKlineAtOrAfter(timestamp: number): Kline | undefined {
    const idx = this.findStartIndex(timestamp);
    if (idx === -1) return undefined;

    const ts = this.sortedTimestamps[idx];
    return ts !== undefined ? this.index.get(ts) : undefined;
  }

  getKlineBefore(timestamp: number): Kline | undefined {
    if (this.size === 0) return undefined;

    let left = 0;
    let right = this.sortedTimestamps.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (this.sortedTimestamps[mid]! < timestamp) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    const ts = this.sortedTimestamps[left];
    if (ts !== undefined && ts < timestamp) {
      return this.index.get(ts);
    }

    return undefined;
  }
}

export const createGranularPriceIndex = (klines: Kline[]): GranularPriceIndex => {
  return new GranularPriceIndex(klines);
};
