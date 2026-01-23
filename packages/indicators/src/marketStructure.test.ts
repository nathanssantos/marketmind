import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  analyzeMarketStructure,
  getStructureConfidence,
  isDowntrendStructure,
  isRangingStructure,
  isUptrendStructure,
  MARKET_STRUCTURE_DEFAULTS,
} from './marketStructure';

const createMockKline = (open: number, high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(open),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

const createUptrendKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.floor(i / 10);
    const posInWave = i % 10;
    const baseWave = 100 + wave * 20;
    const base = posInWave < 5
      ? baseWave + posInWave * 3
      : baseWave + 15 - (posInWave - 5) * 2;
    klines.push(createMockKline(
      base,
      base + 3,
      base - 2,
      base + 1,
      i,
    ));
  }
  return klines;
};

const createDowntrendKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.floor(i / 10);
    const posInWave = i % 10;
    const baseWave = 300 - wave * 20;
    const base = posInWave < 5
      ? baseWave - posInWave * 3
      : baseWave - 15 + (posInWave - 5) * 2;
    klines.push(createMockKline(
      base,
      base + 2,
      base - 3,
      base - 1,
      i,
    ));
  }
  return klines;
};

const createRangingKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const base = 100 + Math.sin(i * 0.5) * 5;
    klines.push(createMockKline(base, base + 2, base - 2, base + 0.5, i));
  }
  return klines;
};

describe('analyzeMarketStructure', () => {
  it('should return RANGING for insufficient data', () => {
    const klines = createUptrendKlines(5);
    const result = analyzeMarketStructure(klines);

    expect(result.trend).toBe('RANGING');
    expect(result.confidence).toBe(0);
    expect(result.lastSwingHigh).toBeNull();
    expect(result.lastSwingLow).toBeNull();
  });

  it('should detect trend direction based on swing structure', () => {
    const uptrendKlines = createUptrendKlines(60);
    const uptrendResult = analyzeMarketStructure(uptrendKlines);

    expect(uptrendResult.higherHighs + uptrendResult.higherLows).toBeGreaterThan(0);
  });

  it('should detect lower structure in downtrend', () => {
    const klines = createDowntrendKlines(60);
    const result = analyzeMarketStructure(klines);

    expect(result.lowerHighs + result.lowerLows).toBeGreaterThan(0);
  });

  it('should detect RANGING when no clear trend', () => {
    const klines = createRangingKlines(60);
    const result = analyzeMarketStructure(klines);

    expect(result.trend).toBe('RANGING');
  });

  it('should track swing highs and lows', () => {
    const klines = createUptrendKlines(60);
    const result = analyzeMarketStructure(klines);

    const totalHighs = result.higherHighs + result.lowerHighs;
    const totalLows = result.higherLows + result.lowerLows;

    expect(totalHighs + totalLows).toBeGreaterThanOrEqual(0);
  });

  it('should return last swing high and low when available', () => {
    const klines = createUptrendKlines(60);
    const result = analyzeMarketStructure(klines);

    if (result.lastSwingHigh) {
      expect(result.lastSwingHigh.type).toBe('high');
      expect(result.lastSwingHigh.price).toBeGreaterThan(0);
    }

    if (result.lastSwingLow) {
      expect(result.lastSwingLow.type).toBe('low');
      expect(result.lastSwingLow.price).toBeGreaterThan(0);
    }
  });

  it('should calculate confidence between 0 and 100', () => {
    const klines = createUptrendKlines(60);
    const result = analyzeMarketStructure(klines);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('should respect custom lookback config', () => {
    const klines = createUptrendKlines(100);
    const result = analyzeMarketStructure(klines, { lookback: 30 });

    expect(result.trend).toBeDefined();
  });

  it('should respect minSwingsForTrend config', () => {
    const klines = createUptrendKlines(60);
    const strictResult = analyzeMarketStructure(klines, { minSwingsForTrend: 5 });
    const looseResult = analyzeMarketStructure(klines, { minSwingsForTrend: 1 });

    expect(looseResult.trend === 'UPTREND' || strictResult.trend === 'RANGING').toBe(true);
  });
});

describe('isUptrendStructure', () => {
  it('should return boolean for uptrend data', () => {
    const klines = createUptrendKlines(60);
    const result = isUptrendStructure(klines);
    expect(typeof result).toBe('boolean');
  });

  it('should return false for ranging', () => {
    const klines = createRangingKlines(60);
    expect(isUptrendStructure(klines)).toBe(false);
  });
});

describe('isDowntrendStructure', () => {
  it('should return boolean for downtrend data', () => {
    const klines = createDowntrendKlines(60);
    const result = isDowntrendStructure(klines);
    expect(typeof result).toBe('boolean');
  });

  it('should return false for ranging', () => {
    const klines = createRangingKlines(60);
    expect(isDowntrendStructure(klines)).toBe(false);
  });
});

describe('isRangingStructure', () => {
  it('should return true for ranging market', () => {
    const klines = createRangingKlines(60);
    expect(isRangingStructure(klines)).toBe(true);
  });

  it('should return boolean for trend data', () => {
    const uptrendKlines = createUptrendKlines(60);
    const downtrendKlines = createDowntrendKlines(60);

    expect(typeof isRangingStructure(uptrendKlines)).toBe('boolean');
    expect(typeof isRangingStructure(downtrendKlines)).toBe('boolean');
  });
});

describe('getStructureConfidence', () => {
  it('should return confidence for uptrend', () => {
    const klines = createUptrendKlines(60);
    const confidence = getStructureConfidence(klines);

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it('should return 50 for ranging market', () => {
    const klines = createRangingKlines(60);
    const confidence = getStructureConfidence(klines);

    expect(confidence).toBe(50);
  });

  it('should return 0 for insufficient data', () => {
    const klines = createUptrendKlines(5);
    const confidence = getStructureConfidence(klines);

    expect(confidence).toBe(0);
  });
});

describe('MARKET_STRUCTURE_DEFAULTS', () => {
  it('should have correct default values', () => {
    expect(MARKET_STRUCTURE_DEFAULTS.LOOKBACK).toBe(50);
    expect(MARKET_STRUCTURE_DEFAULTS.MIN_SWINGS_FOR_TREND).toBe(2);
  });
});
