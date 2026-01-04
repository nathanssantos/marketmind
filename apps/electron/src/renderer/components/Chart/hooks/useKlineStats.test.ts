import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateKlineStats } from './useKlineStats';

const createMockKline = (overrides: Partial<Kline> = {}): Kline => ({
  openTime: 1700000000000,
  closeTime: 1700003600000,
  open: '100',
  high: '110',
  low: '95',
  close: '105',
  volume: '1000',
  quoteVolume: '100000',
  trades: 500,
  takerBuyBaseVolume: '600',
  takerBuyQuoteVolume: '60000',
  ...overrides,
});

describe('calculateKlineStats', () => {
  it('should return default values for null kline', () => {
    const result = calculateKlineStats(null);

    expect(result.isBullish).toBe(false);
    expect(result.change).toBe(0);
    expect(result.changePercent).toBe('0.00');
    expect(result.buyPressure).toBe(0.5);
    expect(result.pressureType).toBe('neutral');
    expect(result.trades).toBe(0);
    expect(result.quoteVolume).toBe(0);
    expect(result.avgTradeValue).toBe(0);
  });

  it('should detect bullish kline', () => {
    const kline = createMockKline({ open: '100', close: '110' });
    const result = calculateKlineStats(kline);

    expect(result.isBullish).toBe(true);
  });

  it('should detect bearish kline', () => {
    const kline = createMockKline({ open: '110', close: '100' });
    const result = calculateKlineStats(kline);

    expect(result.isBullish).toBe(false);
  });

  it('should treat equal open/close as bullish', () => {
    const kline = createMockKline({ open: '100', close: '100' });
    const result = calculateKlineStats(kline);

    expect(result.isBullish).toBe(true);
  });

  it('should calculate positive change correctly', () => {
    const kline = createMockKline({ open: '100', close: '110' });
    const result = calculateKlineStats(kline);

    expect(result.change).toBe(10);
    expect(result.changePercent).toBe('10.00');
  });

  it('should calculate negative change correctly', () => {
    const kline = createMockKline({ open: '100', close: '90' });
    const result = calculateKlineStats(kline);

    expect(result.change).toBe(-10);
    expect(result.changePercent).toBe('-10.00');
  });

  it('should calculate zero change correctly', () => {
    const kline = createMockKline({ open: '100', close: '100' });
    const result = calculateKlineStats(kline);

    expect(result.change).toBe(0);
    expect(result.changePercent).toBe('0.00');
  });

  it('should calculate fractional change percent', () => {
    const kline = createMockKline({ open: '100', close: '101.5' });
    const result = calculateKlineStats(kline);

    expect(result.change).toBe(1.5);
    expect(result.changePercent).toBe('1.50');
  });

  it('should return trades count', () => {
    const kline = createMockKline({ trades: 1234 });
    const result = calculateKlineStats(kline);

    expect(result.trades).toBe(1234);
  });

  it('should return quote volume', () => {
    const kline = createMockKline({ quoteVolume: '500000' });
    const result = calculateKlineStats(kline);

    expect(result.quoteVolume).toBe(500000);
  });

  it('should calculate buy pressure', () => {
    const kline = createMockKline({
      volume: '1000',
      takerBuyBaseVolume: '700',
    });
    const result = calculateKlineStats(kline);

    expect(result.buyPressure).toBe(0.7);
  });

  it('should detect buy pressure type', () => {
    const kline = createMockKline({
      volume: '1000',
      takerBuyBaseVolume: '700',
    });
    const result = calculateKlineStats(kline);

    expect(result.pressureType).toBe('buy');
  });

  it('should detect sell pressure type', () => {
    const kline = createMockKline({
      volume: '1000',
      takerBuyBaseVolume: '300',
    });
    const result = calculateKlineStats(kline);

    expect(result.pressureType).toBe('sell');
  });

  it('should detect neutral pressure type', () => {
    const kline = createMockKline({
      volume: '1000',
      takerBuyBaseVolume: '500',
    });
    const result = calculateKlineStats(kline);

    expect(result.pressureType).toBe('neutral');
  });

  it('should calculate average trade value', () => {
    const kline = createMockKline({
      quoteVolume: '100000',
      trades: 500,
    });
    const result = calculateKlineStats(kline);

    expect(result.avgTradeValue).toBe(200);
  });

  it('should handle large numbers', () => {
    const kline = createMockKline({
      open: '50000',
      close: '51000',
      volume: '10000000',
      quoteVolume: '500000000000',
      trades: 1000000,
    });
    const result = calculateKlineStats(kline);

    expect(result.change).toBe(1000);
    expect(result.changePercent).toBe('2.00');
    expect(result.quoteVolume).toBe(500000000000);
    expect(result.trades).toBe(1000000);
  });

  it('should handle small decimal prices', () => {
    const kline = createMockKline({
      open: '0.00001',
      close: '0.000011',
    });
    const result = calculateKlineStats(kline);

    expect(result.change).toBeCloseTo(0.000001, 10);
    expect(result.changePercent).toBe('10.00');
    expect(result.isBullish).toBe(true);
  });
});
