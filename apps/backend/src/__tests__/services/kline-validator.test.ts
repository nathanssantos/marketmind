import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const createDbKline = (overrides: Partial<{
  openTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  symbol: string;
  interval: string;
  marketType: 'SPOT' | 'FUTURES';
  closeTime: Date;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  createdAt: Date;
}> = {}) => ({
  openTime: new Date('2024-01-01T00:00:00Z'),
  open: '100',
  high: '105',
  low: '95',
  close: '102',
  volume: '1000',
  symbol: 'BTCUSDT',
  interval: '4h',
  marketType: 'SPOT' as const,
  closeTime: new Date('2024-01-01T04:00:00Z'),
  quoteVolume: '100000',
  trades: 1000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
  createdAt: new Date(),
  ...overrides,
});

describe('KlineValidator.isKlineStaleCorrupted', () => {
  it('should detect stale candle when high equals open and prev neighbor has higher high', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '95', close: '97' });
    const prevKline = createDbKline({ open: '98', high: '110', low: '96', close: '99' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, null);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('High equals Open');
  });

  it('should detect stale candle when high equals open and next neighbor has higher high', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '95', close: '97' });
    const nextKline = createDbKline({ open: '101', high: '115', low: '99', close: '110' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, null, nextKline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('High equals Open');
  });

  it('should not flag stale high when no neighbor has higher high', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '95', close: '97' });
    const prevKline = createDbKline({ open: '90', high: '95', low: '88', close: '92' });
    const nextKline = createDbKline({ open: '91', high: '96', low: '89', close: '93' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, nextKline);
    expect(result).toBeNull();
  });

  it('should detect stale candle when low equals open and prev neighbor has lower low', () => {
    const kline = createDbKline({ open: '100', high: '108', low: '100', close: '105' });
    const prevKline = createDbKline({ open: '98', high: '106', low: '90', close: '99' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, null);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('Low equals Open');
  });

  it('should detect stale candle when low equals open and next neighbor has lower low', () => {
    const kline = createDbKline({ open: '100', high: '108', low: '100', close: '105' });
    const nextKline = createDbKline({ open: '99', high: '107', low: '88', close: '96' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, null, nextKline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('Low equals Open');
  });

  it('should not flag stale low when no neighbor has lower low', () => {
    const kline = createDbKline({ open: '100', high: '108', low: '100', close: '105' });
    const prevKline = createDbKline({ open: '102', high: '110', low: '101', close: '106' });
    const nextKline = createDbKline({ open: '103', high: '111', low: '102', close: '107' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, nextKline);
    expect(result).toBeNull();
  });

  it('should detect stale candle when all OHLC values are equal', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '100', close: '100' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, null, null);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('All OHLC values equal');
  });

  it('should return null for normal kline where high and low differ from open', () => {
    const kline = createDbKline({ open: '100', high: '105', low: '95', close: '102' });
    const prevKline = createDbKline({ open: '98', high: '103', low: '93', close: '100' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, null);
    expect(result).toBeNull();
  });

  it('should return null when high equals open but no neighbor provided', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '95', close: '97' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, null, null);
    expect(result).toBeNull();
  });

  it('should return null when low equals open but no neighbor provided', () => {
    const kline = createDbKline({ open: '100', high: '108', low: '100', close: '105' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, null, null);
    expect(result).toBeNull();
  });

  it('should skip low-equals-open check when both high and low equal open (not flagged by second block)', () => {
    const kline = createDbKline({ open: '100', high: '100', low: '100', close: '100' });
    const prevKline = createDbKline({ open: '90', high: '95', low: '85', close: '92' });

    const result = KlineValidator.isKlineStaleCorrupted(kline, prevKline, null);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('All OHLC values equal');
  });
});

describe('KlineValidator.isKlineCorrupted - additional branch coverage', () => {
  it('should detect NaN in open specifically', () => {
    const kline = createDbKline({ open: 'invalid' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('NaN values');
  });

  it('should detect NaN in low specifically', () => {
    const kline = createDbKline({ low: 'notanumber' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('NaN values');
  });

  it('should detect NaN in close specifically', () => {
    const kline = createDbKline({ close: 'abc' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('NaN values');
  });

  it('should detect NaN in volume specifically', () => {
    const kline = createDbKline({ volume: 'xyz' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('NaN values');
  });

  it('should detect negative price in high', () => {
    const kline = createDbKline({ open: '100', high: '-5', low: '-10', close: '-7' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('Zero or negative prices');
  });

  it('should detect negative price in low', () => {
    const kline = createDbKline({ open: '100', high: '105', low: '-1', close: '102' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('Zero or negative prices');
  });

  it('should detect negative price in close', () => {
    const kline = createDbKline({ open: '100', high: '105', low: '95', close: '-1' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain('Zero or negative prices');
  });

  it('should detect open below low', () => {
    const kline = createDbKline({ open: '90', high: '105', low: '95', close: '102' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('Open outside High/Low range');
  });

  it('should detect close above high', () => {
    const kline = createDbKline({ open: '100', high: '105', low: '95', close: '110' });
    const result = KlineValidator.isKlineCorrupted(kline);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('Close outside High/Low range');
  });
});

describe('KlineValidator.isKlineDataSuspicious - additional branch coverage', () => {
  it('should pass when existing data has zero range but valid new data', () => {
    const newKline = { volume: '100', high: '105', low: '95' };
    const existingKline = { volume: '100', high: '100', low: '100' };

    const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
    expect(result.isValid).toBe(true);
  });

  it('should pass when volume ratio is above threshold', () => {
    const newKline = { volume: '100', high: '105', low: '95' };
    const existingKline = { volume: '200', high: '110', low: '90' };

    const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
    expect(result.isValid).toBe(true);
  });

  it('should pass when range ratio is above threshold', () => {
    const newKline = { volume: '100', high: '106', low: '94' };
    const existingKline = { volume: '100', high: '110', low: '90' };

    const result = KlineValidator.isKlineDataSuspicious(newKline, existingKline);
    expect(result.isValid).toBe(true);
  });
});

describe('KlineValidator.validateAgainstAPI', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should return valid when API returns no data', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const kline = createDbKline();
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('should return valid when API response is not ok', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => [],
    } as Response);

    const kline = createDbKline();
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('should return valid when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const kline = createDbKline();
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('should return valid when API kline timestamp does not match', async () => {
    const klineOpenTime = new Date('2024-01-01T00:00:00Z');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[9999999, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: klineOpenTime });
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('should return valid when db kline matches API kline', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs) });
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('should return mismatches when db kline differs from API kline', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs), close: '120', high: '125' });
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
    const fields = result.mismatches.map(m => m.field);
    expect(fields).toContain('close');
    expect(fields).toContain('high');
  });

  it('should use FUTURES API URL for futures market type', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs) });
    await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'FUTURES');

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('fapi.binance.com');
  });

  it('should use SPOT API URL for spot market type', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs) });
    await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('api.binance.com');
  });

  it('should include diffPercent in mismatches', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [[openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0']],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs), open: '110' });
    const result = await KlineValidator.validateAgainstAPI(kline, 'BTCUSDT', '4h', 'SPOT');
    expect(result.isValid).toBe(false);
    const openMismatch = result.mismatches.find(m => m.field === 'open');
    expect(openMismatch).toBeDefined();
    expect(openMismatch!.dbValue).toBe(110);
    expect(openMismatch!.apiValue).toBe(100);
    expect(openMismatch!.diffPercent).toBe(10);
  });
});

describe('KlineValidator.fetchBinanceKlinesBatch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should return empty map when response is not ok', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => [],
    } as Response);

    const result = await KlineValidator.fetchBinanceKlinesBatch('BTCUSDT', '4h', 1000, 2000, 'SPOT');
    expect(result.size).toBe(0);
  });

  it('should return empty map when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result = await KlineValidator.fetchBinanceKlinesBatch('BTCUSDT', '4h', 1000, 2000, 'SPOT');
    expect(result.size).toBe(0);
  });

  it('should return populated map on success', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [1000, '100', '105', '95', '102', '1000', 2000, '100000', 500, '500', '50000'],
        [2000, '101', '106', '96', '103', '1100', 3000, '110000', 600, '550', '55000'],
      ],
    } as Response);

    const result = await KlineValidator.fetchBinanceKlinesBatch('BTCUSDT', '4h', 1000, 2000, 'SPOT');
    expect(result.size).toBe(2);
    expect(result.get(1000)?.open).toBe('100');
    expect(result.get(2000)?.open).toBe('101');
  });

  it('should use FUTURES API URL for futures market type', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await KlineValidator.fetchBinanceKlinesBatch('BTCUSDT', '4h', 1000, 2000, 'FUTURES');

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('fapi.binance.com');
  });

  it('should use SPOT API URL for spot market type', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await KlineValidator.fetchBinanceKlinesBatch('BTCUSDT', '4h', 1000, 2000, 'SPOT');

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('api.binance.com');
  });
});

describe('KlineValidator.validateBatchAgainstAPI', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should return empty map for empty input', async () => {
    const result = await KlineValidator.validateBatchAgainstAPI([], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(0);
  });

  it('should mark klines as valid when API has no matching kline', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const kline = createDbKline({ openTime: new Date('2024-01-01T00:00:00Z') });
    const result = await KlineValidator.validateBatchAgainstAPI([kline], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(1);
    const entry = result.get(kline.openTime.getTime());
    expect(entry?.isValid).toBe(true);
    expect(entry?.mismatches).toHaveLength(0);
  });

  it('should validate matching klines against API data', async () => {
    const openTimeMs1 = new Date('2024-01-01T00:00:00Z').getTime();
    const openTimeMs2 = new Date('2024-01-01T04:00:00Z').getTime();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [openTimeMs1, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0'],
        [openTimeMs2, '101', '106', '96', '103', '1100', 0, '0', 0, '0', '0'],
      ],
    } as Response);

    const kline1 = createDbKline({ openTime: new Date(openTimeMs1), open: '100', high: '105', low: '95', close: '102', volume: '1000' });
    const kline2 = createDbKline({ openTime: new Date(openTimeMs2), open: '101', high: '106', low: '96', close: '103', volume: '1100' });

    const result = await KlineValidator.validateBatchAgainstAPI([kline1, kline2], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(2);
    expect(result.get(openTimeMs1)?.isValid).toBe(true);
    expect(result.get(openTimeMs2)?.isValid).toBe(true);
  });

  it('should detect mismatches in batch validation', async () => {
    const openTimeMs = new Date('2024-01-01T00:00:00Z').getTime();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [openTimeMs, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0'],
      ],
    } as Response);

    const kline = createDbKline({ openTime: new Date(openTimeMs), close: '130', high: '135' });

    const result = await KlineValidator.validateBatchAgainstAPI([kline], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(1);
    const entry = result.get(openTimeMs);
    expect(entry?.isValid).toBe(false);
    expect(entry!.mismatches.length).toBeGreaterThan(0);
  });

  it('should handle mixed matching and non-matching klines', async () => {
    const openTimeMs1 = new Date('2024-01-01T00:00:00Z').getTime();
    const openTimeMs2 = new Date('2024-01-01T04:00:00Z').getTime();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [openTimeMs1, '100', '105', '95', '102', '1000', 0, '0', 0, '0', '0'],
      ],
    } as Response);

    const kline1 = createDbKline({ openTime: new Date(openTimeMs1), open: '100', high: '105', low: '95', close: '102', volume: '1000' });
    const kline2 = createDbKline({ openTime: new Date(openTimeMs2), open: '101', high: '106', low: '96', close: '103', volume: '1100' });

    const result = await KlineValidator.validateBatchAgainstAPI([kline1, kline2], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(2);
    expect(result.get(openTimeMs1)?.isValid).toBe(true);
    expect(result.get(openTimeMs2)?.isValid).toBe(true);
    expect(result.get(openTimeMs2)?.mismatches).toHaveLength(0);
  });

  it('should sort klines by openTime for batch fetch bounds', async () => {
    const openTimeMs1 = new Date('2024-01-01T08:00:00Z').getTime();
    const openTimeMs2 = new Date('2024-01-01T00:00:00Z').getTime();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const kline1 = createDbKline({ openTime: new Date(openTimeMs1) });
    const kline2 = createDbKline({ openTime: new Date(openTimeMs2) });

    await KlineValidator.validateBatchAgainstAPI([kline1, kline2], 'BTCUSDT', '4h', 'SPOT');

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(`startTime=${openTimeMs2}`);
    expect(calledUrl).toContain(`endTime=${openTimeMs1}`);
  });

  it('should handle fetch failure gracefully in batch', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

    const kline = createDbKline({ openTime: new Date('2024-01-01T00:00:00Z') });
    const result = await KlineValidator.validateBatchAgainstAPI([kline], 'BTCUSDT', '4h', 'SPOT');
    expect(result.size).toBe(1);
    const entry = result.get(kline.openTime.getTime());
    expect(entry?.isValid).toBe(true);
    expect(entry?.mismatches).toHaveLength(0);
  });
});
