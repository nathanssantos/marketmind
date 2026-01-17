import { describe, it, expect } from 'vitest';
import { KlineValidator, compareOHLC, OHLC_TOLERANCE, VOLUME_TOLERANCE } from '../../services/kline-validator';

describe('KlineValidator', () => {
  describe('isKlineDataSuspicious', () => {
    it('should detect low volume', () => {
      const kline = {
        volume: '0.005',
        high: '101',
        low: '99',
      };

      const result = KlineValidator.isKlineDataSuspicious(kline);
      expect(result.isValid).toBe(false);
      expect(result.shouldFetchFromAPI).toBe(true);
      expect(result.reason).toContain('Low volume');
    });

    it('should pass valid kline with sufficient volume', () => {
      const kline = {
        volume: '1000',
        high: '105',
        low: '95',
      };

      const result = KlineValidator.isKlineDataSuspicious(kline);
      expect(result.isValid).toBe(true);
    });

    it('should detect low volume ratio compared to existing', () => {
      const newKline = {
        volume: '0.5',
        high: '101',
        low: '99',
      };

      const existingKline = {
        volume: '1000',
        high: '102',
        low: '98',
      };

      const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
      expect(result.isValid).toBe(false);
      expect(result.shouldFetchFromAPI).toBe(true);
      expect(result.reason).toContain('Volume ratio too low');
    });

    it('should detect low range ratio compared to existing', () => {
      const newKline = {
        volume: '100',
        high: '100.01',
        low: '99.99',
      };

      const existingKline = {
        volume: '100',
        high: '110',
        low: '90',
      };

      const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
      expect(result.isValid).toBe(false);
      expect(result.shouldFetchFromAPI).toBe(true);
      expect(result.reason).toContain('Range ratio too low');
    });

    it('should handle zero existing volume gracefully', () => {
      const newKline = {
        volume: '100',
        high: '101',
        low: '99',
      };

      const existingKline = {
        volume: '0',
        high: '100',
        low: '100',
      };

      const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
      expect(result.isValid).toBe(true);
    });

    it('should pass when no existing data to compare', () => {
      const kline = {
        volume: '100',
        high: '105',
        low: '95',
      };

      const result = KlineValidator.isKlineDataSuspicious(kline);
      expect(result.isValid).toBe(true);
    });
  });

  describe('isKlineCorrupted', () => {
    const createValidKline = () => ({
      openTime: new Date('2024-01-01'),
      open: '100',
      high: '105',
      low: '95',
      close: '102',
      volume: '1000',
      symbol: 'BTCUSDT',
      interval: '4h',
      marketType: 'SPOT' as const,
      closeTime: new Date('2024-01-01T04:00:00'),
      quoteVolume: '100000',
      trades: 1000,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '50000',
      createdAt: new Date(),
    });

    it('should detect NaN values', () => {
      const kline = {
        ...createValidKline(),
        high: 'NaN',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('NaN values');
    });

    it('should detect zero or negative prices', () => {
      const kline = {
        ...createValidKline(),
        open: '0',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('Zero or negative prices');
    });

    it('should detect negligible volume', () => {
      const kline = {
        ...createValidKline(),
        volume: '0.00001',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('Zero or negligible volume');
    });

    it('should detect low > high', () => {
      const kline = {
        ...createValidKline(),
        low: '110',
        high: '100',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe('Low > High');
    });

    it('should detect open outside high/low range', () => {
      const kline = {
        ...createValidKline(),
        open: '120',
        high: '105',
        low: '95',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe('Open outside High/Low range');
    });

    it('should detect close outside high/low range', () => {
      const kline = {
        ...createValidKline(),
        close: '80',
        high: '105',
        low: '95',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe('Close outside High/Low range');
    });

    it('should detect flat candles', () => {
      const kline = {
        ...createValidKline(),
        open: '100',
        high: '100',
        low: '100',
        close: '100',
      };

      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('Flat candle');
    });

    it('should pass valid kline', () => {
      const kline = createValidKline();
      const result = KlineValidator.isKlineCorrupted(kline);
      expect(result).toBeNull();
    });
  });

  describe('isKlineSpikeCorrupted', () => {
    const createKline = (close: string, high: string, low: string, volume: string) => ({
      openTime: new Date('2024-01-01'),
      open: close,
      high,
      low,
      close,
      volume,
      symbol: 'BTCUSDT',
      interval: '4h',
      marketType: 'SPOT' as const,
      closeTime: new Date('2024-01-01T04:00:00'),
      quoteVolume: '100000',
      trades: 1000,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '50000',
      createdAt: new Date(),
    });

    it('should return null when no neighbors', () => {
      const kline = createKline('100', '105', '95', '1000');
      const result = KlineValidator.isKlineSpikeCorrupted(kline, null, null);
      expect(result).toBeNull();
    });

    it('should detect anomalous low volume', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('101', '103', '99', '5');
      const next = createKline('102', '104', '100', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('Anomalous low volume');
    });

    it('should detect anomalous small range', () => {
      const prev = createKline('100', '110', '90', '1000');
      const curr = createKline('100.5', '100.6', '100.4', '1000');
      const next = createKline('101', '111', '91', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('Anomalous small range');
    });

    it('should detect close price spike', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('150', '155', '145', '1000');
      const next = createKline('101', '103', '99', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('price spike');
    });

    it('should detect high price spike', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('101', '180', '99', '1000');
      const next = createKline('102', '104', '100', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('price spike');
    });

    it('should detect low price spike', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('99', '101', '50', '1000');
      const next = createKline('98', '100', '96', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).not.toBeNull();
      expect(result?.reason).toContain('price spike');
    });

    it('should pass normal kline with neighbors', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('101', '103', '99', '1100');
      const next = createKline('102', '104', '100', '1000');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, next);
      expect(result).toBeNull();
    });

    it('should work with only prev neighbor', () => {
      const prev = createKline('100', '102', '98', '1000');
      const curr = createKline('101', '103', '99', '1100');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, prev, null);
      expect(result).toBeNull();
    });

    it('should work with only next neighbor', () => {
      const curr = createKline('100', '102', '98', '1000');
      const next = createKline('101', '103', '99', '1100');

      const result = KlineValidator.isKlineSpikeCorrupted(curr, null, next);
      expect(result).toBeNull();
    });
  });
});

describe('compareOHLC', () => {
  const createOHLC = (open: string, high: string, low: string, close: string, volume: string) => ({
    open, high, low, close, volume,
  });

  it('should return no mismatch for identical data', () => {
    const wsData = createOHLC('100', '105', '95', '102', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(false);
    expect(result.mismatchFields).toHaveLength(0);
  });

  it('should return no mismatch for data within tolerance', () => {
    const wsData = createOHLC('100.05', '105.05', '95.05', '102.05', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(false);
  });

  it('should detect close mismatch above tolerance', () => {
    const wsData = createOHLC('100', '105', '95', '103', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields).toContain('close');
  });

  it('should detect high mismatch', () => {
    const wsData = createOHLC('100', '110', '95', '102', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields).toContain('high');
  });

  it('should detect low mismatch', () => {
    const wsData = createOHLC('100', '105', '90', '102', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields).toContain('low');
  });

  it('should detect open mismatch', () => {
    const wsData = createOHLC('99', '105', '95', '102', '1000');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields).toContain('open');
  });

  it('should detect volume mismatch (WS < REST * 0.9)', () => {
    const wsData = createOHLC('100', '105', '95', '102', '800');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields).toContain('volume');
  });

  it('should not flag volume when WS >= REST * 0.9', () => {
    const wsData = createOHLC('100', '105', '95', '102', '950');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.mismatchFields).not.toContain('volume');
  });

  it('should detect multiple mismatches', () => {
    const wsData = createOHLC('99', '110', '90', '103', '500');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchFields.length).toBeGreaterThan(1);
    expect(result.mismatchFields).toContain('volume');
    expect(result.mismatchFields).toContain('open');
    expect(result.mismatchFields).toContain('high');
    expect(result.mismatchFields).toContain('low');
    expect(result.mismatchFields).toContain('close');
  });

  it('should return parsed numeric values in result', () => {
    const wsData = createOHLC('100.5', '105.5', '95.5', '102.5', '1000.5');
    const restData = createOHLC('100', '105', '95', '102', '1000');

    const result = compareOHLC(wsData, restData);
    expect(result.ws.open).toBe(100.5);
    expect(result.ws.high).toBe(105.5);
    expect(result.ws.low).toBe(95.5);
    expect(result.ws.close).toBe(102.5);
    expect(result.ws.volume).toBe(1000.5);
    expect(result.rest.open).toBe(100);
    expect(result.rest.high).toBe(105);
    expect(result.rest.low).toBe(95);
    expect(result.rest.close).toBe(102);
    expect(result.rest.volume).toBe(1000);
  });
});

describe('OHLC Constants', () => {
  it('should have OHLC_TOLERANCE set to 0.001 (0.1%)', () => {
    expect(OHLC_TOLERANCE).toBe(0.001);
  });

  it('should have VOLUME_TOLERANCE set to 0.9 (90%)', () => {
    expect(VOLUME_TOLERANCE).toBe(0.9);
  });
});
