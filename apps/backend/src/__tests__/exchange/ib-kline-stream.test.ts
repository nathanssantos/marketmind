import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IBKlineStream } from '../../exchange/interactive-brokers/kline-stream';

describe('IB Kline Stream', () => {
  describe('Initialization', () => {
    it('should create kline stream instance', () => {
      const stream = new IBKlineStream();

      expect(stream.exchangeId).toBe('INTERACTIVE_BROKERS');
      expect(stream.getSubscriptionCount()).toBe(0);
    });
  });

  describe('Subscription Management', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should start and stop without subscriptions', () => {
      stream.start();
      stream.stop();
      expect(stream.getSubscriptionCount()).toBe(0);
    });

    it('should track subscription count correctly', () => {
      expect(stream.getSubscriptionCount()).toBe(0);
    });
  });

  describe('Handler Management', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should accept kline update handler', () => {
      const handler = vi.fn();
      stream.onKlineUpdate(handler);
      expect(true).toBe(true);
    });
  });

  describe.skip('Integration Tests (require IB Gateway)', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should fetch historical data for AAPL', async () => {
      const klines = await stream.getHistoricalData(
        'AAPL',
        '1d',
        '1 M',
        undefined,
        true
      );

      expect(Array.isArray(klines)).toBe(true);
      expect(klines.length).toBeGreaterThan(0);

      const firstKline = klines[0];
      expect(firstKline?.openTime).toBeDefined();
      expect(firstKline?.closeTime).toBeDefined();
      expect(parseFloat(firstKline?.open ?? '0')).toBeGreaterThan(0);
      expect(parseFloat(firstKline?.high ?? '0')).toBeGreaterThan(0);
      expect(parseFloat(firstKline?.low ?? '0')).toBeGreaterThan(0);
      expect(parseFloat(firstKline?.close ?? '0')).toBeGreaterThan(0);
    });

    it('should fetch historical data with different intervals', async () => {
      const intervals = ['1m', '5m', '15m', '1h', '1d'];

      for (const interval of intervals) {
        const klines = await stream.getHistoricalData(
          'AAPL',
          interval,
          '1 W',
          undefined,
          true
        );

        expect(Array.isArray(klines)).toBe(true);
        expect(klines.length).toBeGreaterThan(0);
      }
    });

    it('should fetch historical data for multiple symbols', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'];

      for (const symbol of symbols) {
        const klines = await stream.getHistoricalData(
          symbol,
          '1d',
          '1 W',
          undefined,
          true
        );

        expect(Array.isArray(klines)).toBe(true);
        expect(klines.length).toBeGreaterThan(0);
      }
    });

    it('should subscribe to real-time kline updates', async () => {
      const updates: any[] = [];

      stream.onKlineUpdate((update) => {
        updates.push(update);
      });

      stream.start();
      stream.subscribe('AAPL', '1m');

      expect(stream.getSubscriptionCount()).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      stream.unsubscribe('AAPL', '1m');
      stream.stop();

      expect(stream.getSubscriptionCount()).toBe(0);
    });

    it('should handle multiple subscriptions', async () => {
      stream.start();
      stream.subscribe('AAPL', '1m');
      stream.subscribe('MSFT', '1m');
      stream.subscribe('AAPL', '5m');

      expect(stream.getSubscriptionCount()).toBe(3);

      stream.unsubscribe('AAPL', '1m');
      expect(stream.getSubscriptionCount()).toBe(2);

      stream.stop();
      expect(stream.getSubscriptionCount()).toBe(0);
    });

    it('should not duplicate subscriptions for same symbol/interval', async () => {
      stream.start();
      stream.subscribe('AAPL', '1m');
      stream.subscribe('AAPL', '1m');
      stream.subscribe('AAPL', '1m');

      expect(stream.getSubscriptionCount()).toBe(1);

      stream.stop();
    });

    it('should fetch extended hours data', async () => {
      const rthKlines = await stream.getHistoricalData(
        'AAPL',
        '1h',
        '1 D',
        undefined,
        true
      );

      const extendedKlines = await stream.getHistoricalData(
        'AAPL',
        '1h',
        '1 D',
        undefined,
        false
      );

      expect(extendedKlines.length).toBeGreaterThanOrEqual(rthKlines.length);
    });
  });

  describe.skip('Data Quality Tests (require IB Gateway)', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should return valid OHLCV data', async () => {
      const klines = await stream.getHistoricalData('AAPL', '1d', '1 M');

      for (const kline of klines) {
        const open = parseFloat(kline.open);
        const high = parseFloat(kline.high);
        const low = parseFloat(kline.low);
        const close = parseFloat(kline.close);
        const volume = parseFloat(kline.volume);

        expect(high).toBeGreaterThanOrEqual(low);
        expect(high).toBeGreaterThanOrEqual(open);
        expect(high).toBeGreaterThanOrEqual(close);
        expect(low).toBeLessThanOrEqual(open);
        expect(low).toBeLessThanOrEqual(close);
        expect(volume).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return chronologically ordered data', async () => {
      const klines = await stream.getHistoricalData('AAPL', '1d', '1 M');

      for (let i = 1; i < klines.length; i++) {
        const prevKline = klines[i - 1];
        const currKline = klines[i];
        expect(currKline?.openTime).toBeGreaterThan(prevKline?.openTime ?? 0);
      }
    });

    it('should return non-overlapping time periods', async () => {
      const klines = await stream.getHistoricalData('AAPL', '1d', '1 M');

      for (let i = 1; i < klines.length; i++) {
        const prevKline = klines[i - 1];
        const currKline = klines[i];
        expect(currKline?.openTime).toBeGreaterThan(prevKline?.closeTime ?? 0);
      }
    });
  });
});
