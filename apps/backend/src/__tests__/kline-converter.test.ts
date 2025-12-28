import { describe, it, expect } from 'vitest';
import {
  convertDbKlineToKline,
  convertDbKlinesToKlines,
  convertDbKlinesReversed,
  type DbKline,
} from '../utils/kline-converter';

const createDbKline = (index: number): DbKline => ({
  openTime: new Date(1700000000000 + index * 60000),
  closeTime: new Date(1700000000000 + (index + 1) * 60000 - 1),
  open: '100.00',
  high: '105.00',
  low: '95.00',
  close: '102.00',
  volume: '1000',
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
});

describe('kline-converter', () => {
  describe('convertDbKlineToKline', () => {
    it('should convert Date to timestamp for openTime', () => {
      const dbKline = createDbKline(0);
      const kline = convertDbKlineToKline(dbKline);

      expect(typeof kline.openTime).toBe('number');
      expect(kline.openTime).toBe(dbKline.openTime.getTime());
    });

    it('should convert Date to timestamp for closeTime', () => {
      const dbKline = createDbKline(0);
      const kline = convertDbKlineToKline(dbKline);

      expect(typeof kline.closeTime).toBe('number');
      expect(kline.closeTime).toBe(dbKline.closeTime.getTime());
    });

    it('should preserve all other fields', () => {
      const dbKline = createDbKline(0);
      const kline = convertDbKlineToKline(dbKline);

      expect(kline.open).toBe(dbKline.open);
      expect(kline.high).toBe(dbKline.high);
      expect(kline.low).toBe(dbKline.low);
      expect(kline.close).toBe(dbKline.close);
      expect(kline.volume).toBe(dbKline.volume);
      expect(kline.quoteVolume).toBe(dbKline.quoteVolume);
      expect(kline.trades).toBe(dbKline.trades);
      expect(kline.takerBuyBaseVolume).toBe(dbKline.takerBuyBaseVolume);
      expect(kline.takerBuyQuoteVolume).toBe(dbKline.takerBuyQuoteVolume);
    });
  });

  describe('convertDbKlinesToKlines', () => {
    it('should convert array of DbKlines to Klines', () => {
      const dbKlines = [createDbKline(0), createDbKline(1), createDbKline(2)];
      const klines = convertDbKlinesToKlines(dbKlines);

      expect(klines).toHaveLength(3);
      klines.forEach((kline, i) => {
        expect(typeof kline.openTime).toBe('number');
        expect(typeof kline.closeTime).toBe('number');
        const dbKline = dbKlines[i];
        if (dbKline) {
          expect(kline.openTime).toBe(dbKline.openTime.getTime());
        }
      });
    });

    it('should preserve order', () => {
      const dbKlines = [createDbKline(0), createDbKline(1), createDbKline(2)];
      const klines = convertDbKlinesToKlines(dbKlines);

      const first = klines[0];
      const second = klines[1];
      const third = klines[2];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(third).toBeDefined();
      if (first && second && third) {
        expect(first.openTime).toBeLessThan(second.openTime);
        expect(second.openTime).toBeLessThan(third.openTime);
      }
    });

    it('should handle empty array', () => {
      const klines = convertDbKlinesToKlines([]);
      expect(klines).toHaveLength(0);
    });
  });

  describe('convertDbKlinesReversed', () => {
    it('should reverse the array and convert', () => {
      const dbKlines = [createDbKline(0), createDbKline(1), createDbKline(2)];
      const first = dbKlines[0];
      const last = dbKlines[2];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      if (!first || !last) return;

      const originalFirst = first.openTime.getTime();
      const originalLast = last.openTime.getTime();

      const klines = convertDbKlinesReversed(dbKlines);

      expect(klines).toHaveLength(3);
      const klineFirst = klines[0];
      const klineLast = klines[2];
      if (klineFirst && klineLast) {
        expect(klineFirst.openTime).toBe(originalLast);
        expect(klineLast.openTime).toBe(originalFirst);
      }
    });

    it('should handle empty array', () => {
      const klines = convertDbKlinesReversed([]);
      expect(klines).toHaveLength(0);
    });

    it('should handle single element', () => {
      const dbKlines = [createDbKline(0)];
      const klines = convertDbKlinesReversed(dbKlines);

      expect(klines).toHaveLength(1);
      const kline = klines[0];
      const dbKline = dbKlines[0];
      if (kline && dbKline) {
        expect(kline.openTime).toBe(dbKline.openTime.getTime());
      }
    });
  });
});
