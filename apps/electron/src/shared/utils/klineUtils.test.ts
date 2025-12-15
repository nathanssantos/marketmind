import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  getKlineAverageTradeSize,
  getKlineAverageTradeValue,
  getKlineBodySize,
  getKlineBuyPressure,
  getKlineClose,
  getKlineCloseTime,
  getKlineDuration,
  getKlineHigh,
  getKlineLow,
  getKlineLowerWick,
  getKlineOpen,
  getKlinePressureType,
  getKlineQuoteVolume,
  getKlineSellPressure,
  getKlineTakerBuyBaseVolume,
  getKlineTakerBuyQuoteVolume,
  getKlineTimestamp,
  getKlineTrades,
  getKlineUpperWick,
  getKlineVolume,
  isKlineBearish,
  isKlineBullish,
  parseKlinePrice,
  parseKlineVolume,
} from './klineUtils';

const createKline = (overrides: Partial<Kline> = {}): Kline => ({
  openTime: 1700000000000,
  closeTime: 1700003600000,
  open: '100',
  high: '110',
  low: '95',
  close: '105',
  volume: '1000',
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '600',
  takerBuyQuoteVolume: '60000',
  ...overrides,
});

describe('klineUtils', () => {
  describe('parseKlinePrice', () => {
    it('should parse price string to number', () => {
      expect(parseKlinePrice('100.50')).toBe(100.5);
    });

    it('should handle integer strings', () => {
      expect(parseKlinePrice('100')).toBe(100);
    });

    it('should handle small decimals', () => {
      expect(parseKlinePrice('0.00001234')).toBe(0.00001234);
    });
  });

  describe('parseKlineVolume', () => {
    it('should parse volume string to number', () => {
      expect(parseKlineVolume('1000.5')).toBe(1000.5);
    });

    it('should handle large volumes', () => {
      expect(parseKlineVolume('1000000000')).toBe(1000000000);
    });
  });

  describe('getKlineOpen', () => {
    it('should return open price as number', () => {
      const kline = createKline({ open: '42000.50' });
      expect(getKlineOpen(kline)).toBe(42000.5);
    });
  });

  describe('getKlineHigh', () => {
    it('should return high price as number', () => {
      const kline = createKline({ high: '42500.75' });
      expect(getKlineHigh(kline)).toBe(42500.75);
    });
  });

  describe('getKlineLow', () => {
    it('should return low price as number', () => {
      const kline = createKline({ low: '41500.25' });
      expect(getKlineLow(kline)).toBe(41500.25);
    });
  });

  describe('getKlineClose', () => {
    it('should return close price as number', () => {
      const kline = createKline({ close: '42100.00' });
      expect(getKlineClose(kline)).toBe(42100);
    });
  });

  describe('getKlineVolume', () => {
    it('should return volume as number', () => {
      const kline = createKline({ volume: '1500.5' });
      expect(getKlineVolume(kline)).toBe(1500.5);
    });
  });

  describe('getKlineTimestamp', () => {
    it('should return openTime', () => {
      const kline = createKline({ openTime: 1700000000000 });
      expect(getKlineTimestamp(kline)).toBe(1700000000000);
    });
  });

  describe('getKlineCloseTime', () => {
    it('should return closeTime', () => {
      const kline = createKline({ closeTime: 1700003600000 });
      expect(getKlineCloseTime(kline)).toBe(1700003600000);
    });
  });

  describe('getKlineDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const kline = createKline({ openTime: 1700000000000, closeTime: 1700003600000 });
      expect(getKlineDuration(kline)).toBe(3600000);
    });

    it('should return 0 for same open and close time', () => {
      const kline = createKline({ openTime: 1700000000000, closeTime: 1700000000000 });
      expect(getKlineDuration(kline)).toBe(0);
    });
  });

  describe('isKlineBullish', () => {
    it('should return true when close > open', () => {
      const kline = createKline({ open: '100', close: '105' });
      expect(isKlineBullish(kline)).toBe(true);
    });

    it('should return false when close < open', () => {
      const kline = createKline({ open: '105', close: '100' });
      expect(isKlineBullish(kline)).toBe(false);
    });

    it('should return false when close equals open', () => {
      const kline = createKline({ open: '100', close: '100' });
      expect(isKlineBullish(kline)).toBe(false);
    });
  });

  describe('isKlineBearish', () => {
    it('should return true when close < open', () => {
      const kline = createKline({ open: '105', close: '100' });
      expect(isKlineBearish(kline)).toBe(true);
    });

    it('should return false when close > open', () => {
      const kline = createKline({ open: '100', close: '105' });
      expect(isKlineBearish(kline)).toBe(false);
    });

    it('should return false when close equals open', () => {
      const kline = createKline({ open: '100', close: '100' });
      expect(isKlineBearish(kline)).toBe(false);
    });
  });

  describe('getKlineBodySize', () => {
    it('should return body size for bullish kline', () => {
      const kline = createKline({ open: '100', close: '110' });
      expect(getKlineBodySize(kline)).toBe(10);
    });

    it('should return body size for bearish kline', () => {
      const kline = createKline({ open: '110', close: '100' });
      expect(getKlineBodySize(kline)).toBe(10);
    });

    it('should return 0 for doji', () => {
      const kline = createKline({ open: '100', close: '100' });
      expect(getKlineBodySize(kline)).toBe(0);
    });
  });

  describe('getKlineUpperWick', () => {
    it('should return upper wick for bullish kline', () => {
      const kline = createKline({ open: '100', high: '115', close: '110' });
      expect(getKlineUpperWick(kline)).toBe(5);
    });

    it('should return upper wick for bearish kline', () => {
      const kline = createKline({ open: '110', high: '115', close: '100' });
      expect(getKlineUpperWick(kline)).toBe(5);
    });

    it('should return 0 when high equals max(open, close)', () => {
      const kline = createKline({ open: '100', high: '110', close: '110' });
      expect(getKlineUpperWick(kline)).toBe(0);
    });
  });

  describe('getKlineLowerWick', () => {
    it('should return lower wick for bullish kline', () => {
      const kline = createKline({ open: '100', low: '95', close: '110' });
      expect(getKlineLowerWick(kline)).toBe(5);
    });

    it('should return lower wick for bearish kline', () => {
      const kline = createKline({ open: '110', low: '95', close: '100' });
      expect(getKlineLowerWick(kline)).toBe(5);
    });

    it('should return 0 when low equals min(open, close)', () => {
      const kline = createKline({ open: '100', low: '100', close: '110' });
      expect(getKlineLowerWick(kline)).toBe(0);
    });
  });

  describe('getKlineQuoteVolume', () => {
    it('should return quote volume as number', () => {
      const kline = createKline({ quoteVolume: '100000.50' });
      expect(getKlineQuoteVolume(kline)).toBe(100000.5);
    });
  });

  describe('getKlineTrades', () => {
    it('should return number of trades', () => {
      const kline = createKline({ trades: 150 });
      expect(getKlineTrades(kline)).toBe(150);
    });
  });

  describe('getKlineTakerBuyBaseVolume', () => {
    it('should return taker buy base volume as number', () => {
      const kline = createKline({ takerBuyBaseVolume: '500.25' });
      expect(getKlineTakerBuyBaseVolume(kline)).toBe(500.25);
    });
  });

  describe('getKlineTakerBuyQuoteVolume', () => {
    it('should return taker buy quote volume as number', () => {
      const kline = createKline({ takerBuyQuoteVolume: '50000.50' });
      expect(getKlineTakerBuyQuoteVolume(kline)).toBe(50000.5);
    });
  });

  describe('getKlineBuyPressure', () => {
    it('should return buy pressure ratio', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '600' });
      expect(getKlineBuyPressure(kline)).toBe(0.6);
    });

    it('should return 0.5 when volume is 0', () => {
      const kline = createKline({ volume: '0', takerBuyBaseVolume: '0' });
      expect(getKlineBuyPressure(kline)).toBe(0.5);
    });

    it('should return 1 when all volume is buy', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '1000' });
      expect(getKlineBuyPressure(kline)).toBe(1);
    });

    it('should return 0 when no buy volume', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '0' });
      expect(getKlineBuyPressure(kline)).toBe(0);
    });
  });

  describe('getKlineSellPressure', () => {
    it('should return sell pressure ratio', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '600' });
      expect(getKlineSellPressure(kline)).toBe(0.4);
    });

    it('should return 0.5 when volume is 0', () => {
      const kline = createKline({ volume: '0', takerBuyBaseVolume: '0' });
      expect(getKlineSellPressure(kline)).toBe(0.5);
    });
  });

  describe('getKlinePressureType', () => {
    it('should return buy when buy pressure > 0.55', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '600' });
      expect(getKlinePressureType(kline)).toBe('buy');
    });

    it('should return sell when buy pressure < 0.45', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '400' });
      expect(getKlinePressureType(kline)).toBe('sell');
    });

    it('should return neutral when buy pressure is between 0.45 and 0.55', () => {
      const kline = createKline({ volume: '1000', takerBuyBaseVolume: '500' });
      expect(getKlinePressureType(kline)).toBe('neutral');
    });
  });

  describe('getKlineAverageTradeSize', () => {
    it('should return average trade size', () => {
      const kline = createKline({ volume: '1000', trades: 100 });
      expect(getKlineAverageTradeSize(kline)).toBe(10);
    });

    it('should return 0 when trades is 0', () => {
      const kline = createKline({ volume: '1000', trades: 0 });
      expect(getKlineAverageTradeSize(kline)).toBe(0);
    });
  });

  describe('getKlineAverageTradeValue', () => {
    it('should return average trade value', () => {
      const kline = createKline({ quoteVolume: '100000', trades: 100 });
      expect(getKlineAverageTradeValue(kline)).toBe(1000);
    });

    it('should return 0 when trades is 0', () => {
      const kline = createKline({ quoteVolume: '100000', trades: 0 });
      expect(getKlineAverageTradeValue(kline)).toBe(0);
    });
  });
});
