import type { Interval } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBinanceKlineSync } from '../services/binance-kline-sync';

describe('BinanceKlineSync', () => {
  let sync: ReturnType<typeof getBinanceKlineSync>;

  beforeEach(() => {
    sync = getBinanceKlineSync();
  });

  afterEach(() => {
    sync.shutdown();
  });

  it('should subscribe to kline stream', () => {
    expect(() => {
      sync.subscribe('BTCUSDT', '1m' as Interval);
    }).not.toThrow();
  });

  it('should unsubscribe from kline stream', () => {
    sync.subscribe('BTCUSDT', '1m' as Interval);
    
    expect(() => {
      sync.unsubscribe('BTCUSDT', '1m' as Interval);
    }).not.toThrow();
  });

  it('should not throw when subscribing to same stream twice', () => {
    sync.subscribe('BTCUSDT', '1m' as Interval);
    
    expect(() => {
      sync.subscribe('BTCUSDT', '1m' as Interval);
    }).not.toThrow();
  });

  it('should get latest kline time from database', async () => {
    const latest = await sync.getLatestKline('BTCUSDT', '1m' as Interval);
    
    expect(latest).toBeNull();
  });

  it('should shutdown all connections gracefully', () => {
    sync.subscribe('BTCUSDT', '1m' as Interval);
    sync.subscribe('ETHUSDT', '5m' as Interval);
    
    expect(() => {
      sync.shutdown();
    }).not.toThrow();
  });
});
