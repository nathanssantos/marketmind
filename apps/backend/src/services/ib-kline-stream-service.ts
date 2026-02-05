import { IBKlineStream } from '../exchange/interactive-brokers/kline-stream';

interface Subscription {
  symbol: string;
  interval: string;
  clientCount: number;
}

class IBKlineStreamService {
  private stream: IBKlineStream | null = null;
  private subscriptions: Map<string, Subscription> = new Map();

  private getOrCreateStream(): IBKlineStream {
    if (!this.stream) {
      this.stream = new IBKlineStream();
      this.stream.start();
    }
    return this.stream;
  }

  private getKey(symbol: string, interval: string): string {
    return `${symbol}_${interval}`.toLowerCase();
  }

  async subscribe(symbol: string, interval: string): Promise<void> {
    const key = this.getKey(symbol, interval);
    const existing = this.subscriptions.get(key);

    if (existing) {
      existing.clientCount++;
      return;
    }

    this.subscriptions.set(key, { symbol, interval, clientCount: 1 });
    await this.getOrCreateStream().subscribe(symbol, interval);
  }

  unsubscribe(symbol: string, interval: string): void {
    const key = this.getKey(symbol, interval);
    const existing = this.subscriptions.get(key);

    if (!existing) return;

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      this.subscriptions.delete(key);
      this.stream?.unsubscribe(symbol, interval);
    }
  }

  stop(): void {
    this.stream?.stop();
    this.stream = null;
    this.subscriptions.clear();
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

export const ibKlineStreamService = new IBKlineStreamService();
