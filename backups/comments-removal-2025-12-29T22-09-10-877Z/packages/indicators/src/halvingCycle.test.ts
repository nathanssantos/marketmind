import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateHalvingCycle } from './halvingCycle';

const createMockKline = (timestamp: number): Kline => ({
  openTime: timestamp,
  open: '50000',
  high: '51000',
  low: '49000',
  close: '50500',
  volume: '1000',
  closeTime: timestamp + 86399999,
  quoteVolume: '50000000',
  trades: 1000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '25000000',
});

describe('calculateHalvingCycle', () => {
  it('should return empty arrays for empty input', () => {
    const result = calculateHalvingCycle([]);
    expect(result.phase).toEqual([]);
    expect(result.daysFromHalving).toEqual([]);
    expect(result.cycleProgress).toEqual([]);
  });

  it('should identify accumulation phase after halving', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const testDate = halvingDate + 60 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('accumulation');
    expect(result.daysFromHalving[0]).toBeGreaterThan(0);
    expect(result.cycleProgress[0]).toBeLessThan(0.25);
  });

  it('should identify markup phase', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const testDate = halvingDate + 500 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('markup');
    expect(result.cycleProgress[0]).toBeGreaterThanOrEqual(0.25);
    expect(result.cycleProgress[0]).toBeLessThan(0.5);
  });

  it('should identify distribution phase', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const testDate = halvingDate + 1000 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('distribution');
    expect(result.cycleProgress[0]).toBeGreaterThanOrEqual(0.5);
    expect(result.cycleProgress[0]).toBeLessThan(0.75);
  });

  it('should identify markdown phase', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const testDate = halvingDate + 1300 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('markdown');
    expect(result.cycleProgress[0]).toBeGreaterThanOrEqual(0.75);
  });

  it('should calculate days from halving correctly', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const daysAfter = 100;
    const testDate = halvingDate + daysAfter * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.daysFromHalving[0]).toBeGreaterThanOrEqual(daysAfter - 1);
    expect(result.daysFromHalving[0]).toBeLessThanOrEqual(daysAfter + 1);
  });

  it('should calculate cycle progress as percentage', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const testDate = halvingDate + 365 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.cycleProgress[0]).toBeGreaterThan(0);
    expect(result.cycleProgress[0]).toBeLessThan(1);
  });

  it('should handle multiple klines across different phases', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const klines = [
      createMockKline(halvingDate + 100 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + 500 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + 1000 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + 1300 * 24 * 60 * 60 * 1000),
    ];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('accumulation');
    expect(result.phase[1]).toBe('markup');
    expect(result.phase[2]).toBe('distribution');
    expect(result.phase[3]).toBe('markdown');
  });

  it('should return null for dates before first halving', () => {
    const beforeFirstHalving = new Date('2010-01-01').getTime();
    const klines = [createMockKline(beforeFirstHalving)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBeNull();
    expect(result.daysFromHalving[0]).toBeNull();
    expect(result.cycleProgress[0]).toBeNull();
  });

  it('should handle the 2020 halving correctly', () => {
    const halving2020 = new Date('2020-05-11').getTime();
    const testDate = halving2020 + 200 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).not.toBeNull();
    expect(result.daysFromHalving[0]).toBeGreaterThan(0);
  });

  it('should handle the 2024 halving correctly', () => {
    const halving2024 = new Date('2024-04-20').getTime();
    const testDate = halving2024 + 30 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(testDate)];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('accumulation');
    expect(result.daysFromHalving[0]).toBeGreaterThanOrEqual(29);
    expect(result.daysFromHalving[0]).toBeLessThanOrEqual(31);
  });

  it('should cycle through phases correctly', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const cycleDays = 1460;
    
    const klines = [
      createMockKline(halvingDate + cycleDays * 0.1 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + cycleDays * 0.3 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + cycleDays * 0.6 * 24 * 60 * 60 * 1000),
      createMockKline(halvingDate + cycleDays * 0.9 * 24 * 60 * 60 * 1000),
    ];

    const result = calculateHalvingCycle(klines);

    expect(result.phase[0]).toBe('accumulation');
    expect(result.phase[1]).toBe('markup');
    expect(result.phase[2]).toBe('distribution');
    expect(result.phase[3]).toBe('markdown');
  });

  it('should handle edge case at phase boundaries', () => {
    const halvingDate = new Date('2024-04-20').getTime();
    const cycleDays = 1460;
    
    const exactQuarter = halvingDate + cycleDays * 0.25 * 24 * 60 * 60 * 1000;
    const klines = [createMockKline(exactQuarter)];

    const result = calculateHalvingCycle(klines);

    expect(['accumulation', 'markup']).toContain(result.phase[0]);
  });
});
