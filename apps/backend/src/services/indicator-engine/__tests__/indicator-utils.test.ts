import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { calculateHighest, calculateLowest, calculateVolumeSMA } from '../indicator-utils';

const makeKline = (overrides: Partial<Record<'open' | 'high' | 'low' | 'close' | 'volume', string>>): Kline => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: Date.now(),
  closeTime: Date.now() + 3600000,
  open: overrides.open ?? '100',
  high: overrides.high ?? '110',
  low: overrides.low ?? '90',
  close: overrides.close ?? '105',
  volume: overrides.volume ?? '1000',
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
} as Kline);

describe('calculateHighest', () => {
  it('returns empty array for empty klines', () => {
    expect(calculateHighest([], 3, 'high')).toEqual([]);
  });

  it('returns empty array for period <= 0', () => {
    expect(calculateHighest([makeKline({})], 0, 'high')).toEqual([]);
    expect(calculateHighest([makeKline({})], -1, 'high')).toEqual([]);
  });

  it('returns nulls for indices before period-1', () => {
    const klines = [makeKline({ high: '10' }), makeKline({ high: '20' }), makeKline({ high: '30' })];
    const result = calculateHighest(klines, 3, 'high');
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(30);
  });

  it('calculates highest high over period', () => {
    const klines = [
      makeKline({ high: '10' }),
      makeKline({ high: '30' }),
      makeKline({ high: '20' }),
      makeKline({ high: '25' }),
      makeKline({ high: '15' }),
    ];
    const result = calculateHighest(klines, 3, 'high');
    expect(result).toEqual([null, null, 30, 30, 25]);
  });

  it('supports close source', () => {
    const klines = [makeKline({ close: '50' }), makeKline({ close: '60' })];
    const result = calculateHighest(klines, 2, 'close');
    expect(result).toEqual([null, 60]);
  });

  it('supports open source', () => {
    const klines = [makeKline({ open: '40' }), makeKline({ open: '35' })];
    const result = calculateHighest(klines, 1, 'open');
    expect(result).toEqual([40, 35]);
  });

  it('supports low source', () => {
    const klines = [makeKline({ low: '80' }), makeKline({ low: '85' })];
    const result = calculateHighest(klines, 2, 'low');
    expect(result).toEqual([null, 85]);
  });

  it('supports volume source', () => {
    const klines = [makeKline({ volume: '500' }), makeKline({ volume: '700' })];
    const result = calculateHighest(klines, 2, 'volume');
    expect(result).toEqual([null, 700]);
  });

  it('defaults to high for unknown source', () => {
    const klines = [makeKline({ high: '99' })];
    const result = calculateHighest(klines, 1, 'unknown');
    expect(result).toEqual([99]);
  });

  it('handles period of 1', () => {
    const klines = [makeKline({ high: '10' }), makeKline({ high: '20' }), makeKline({ high: '5' })];
    const result = calculateHighest(klines, 1, 'high');
    expect(result).toEqual([10, 20, 5]);
  });
});

describe('calculateLowest', () => {
  it('returns empty array for empty klines', () => {
    expect(calculateLowest([], 3, 'low')).toEqual([]);
  });

  it('returns empty array for period <= 0', () => {
    expect(calculateLowest([makeKline({})], 0, 'low')).toEqual([]);
    expect(calculateLowest([makeKline({})], -1, 'low')).toEqual([]);
  });

  it('returns nulls for indices before period-1', () => {
    const klines = [makeKline({ low: '30' }), makeKline({ low: '20' }), makeKline({ low: '10' })];
    const result = calculateLowest(klines, 3, 'low');
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(10);
  });

  it('calculates lowest low over period', () => {
    const klines = [
      makeKline({ low: '30' }),
      makeKline({ low: '10' }),
      makeKline({ low: '20' }),
      makeKline({ low: '15' }),
      makeKline({ low: '25' }),
    ];
    const result = calculateLowest(klines, 3, 'low');
    expect(result).toEqual([null, null, 10, 10, 15]);
  });

  it('supports close source', () => {
    const klines = [makeKline({ close: '50' }), makeKline({ close: '40' })];
    const result = calculateLowest(klines, 2, 'close');
    expect(result).toEqual([null, 40]);
  });

  it('supports high source', () => {
    const klines = [makeKline({ high: '100' }), makeKline({ high: '90' })];
    const result = calculateLowest(klines, 2, 'high');
    expect(result).toEqual([null, 90]);
  });

  it('supports volume source', () => {
    const klines = [makeKline({ volume: '500' }), makeKline({ volume: '300' })];
    const result = calculateLowest(klines, 2, 'volume');
    expect(result).toEqual([null, 300]);
  });

  it('defaults to low for unknown source', () => {
    const klines = [makeKline({ low: '42' })];
    const result = calculateLowest(klines, 1, 'unknown');
    expect(result).toEqual([42]);
  });

  it('handles period of 1', () => {
    const klines = [makeKline({ low: '10' }), makeKline({ low: '5' }), makeKline({ low: '15' })];
    const result = calculateLowest(klines, 1, 'low');
    expect(result).toEqual([10, 5, 15]);
  });
});

describe('calculateVolumeSMA', () => {
  it('returns empty array for empty klines', () => {
    expect(calculateVolumeSMA([], 3)).toEqual([]);
  });

  it('returns empty array for period <= 0', () => {
    expect(calculateVolumeSMA([makeKline({})], 0)).toEqual([]);
    expect(calculateVolumeSMA([makeKline({})], -1)).toEqual([]);
  });

  it('returns nulls for indices before period-1', () => {
    const klines = [makeKline({ volume: '100' }), makeKline({ volume: '200' }), makeKline({ volume: '300' })];
    const result = calculateVolumeSMA(klines, 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(200);
  });

  it('calculates volume SMA correctly', () => {
    const klines = [
      makeKline({ volume: '100' }),
      makeKline({ volume: '200' }),
      makeKline({ volume: '300' }),
      makeKline({ volume: '400' }),
    ];
    const result = calculateVolumeSMA(klines, 2);
    expect(result).toEqual([null, 150, 250, 350]);
  });

  it('handles period of 1', () => {
    const klines = [makeKline({ volume: '100' }), makeKline({ volume: '200' })];
    const result = calculateVolumeSMA(klines, 1);
    expect(result).toEqual([100, 200]);
  });

  it('handles single kline with period 1', () => {
    const klines = [makeKline({ volume: '500' })];
    const result = calculateVolumeSMA(klines, 1);
    expect(result).toEqual([500]);
  });

  it('returns all nulls when period exceeds kline count', () => {
    const klines = [makeKline({ volume: '100' }), makeKline({ volume: '200' })];
    const result = calculateVolumeSMA(klines, 5);
    expect(result).toEqual([null, null]);
  });
});
