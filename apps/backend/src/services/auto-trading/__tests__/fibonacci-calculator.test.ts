import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

const { mockComputeMulti } = vi.hoisted(() => ({
  mockComputeMulti: vi.fn(),
}));
vi.mock('../../../services/pine/PineIndicatorService', () => ({
  PineIndicatorService: class {
    compute = vi.fn().mockResolvedValue([]);
    computeMulti = mockComputeMulti;
  },
}));

vi.mock('../../../lib/indicators', () => ({
  calculateFibonacciProjection: vi.fn(),
  calculateTimeframeLookback: vi.fn(),
}));

vi.mock('../../../constants', () => ({
  TIME_MS: {
    SECOND: 1000,
    MINUTE: 60_000,
    HOUR: 3_600_000,
    DAY: 86_400_000,
    WEEK: 604_800_000,
  },
  UNIT_MS: {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  },
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
}));

import {
  getIntervalMs,
  getAdxBasedFibonacciLevel,
  calculateFibonacciTakeProfit,
} from '../validation/fibonacci-calculator';
import { calculateFibonacciProjection, calculateTimeframeLookback } from '../../../lib/indicators';

const mockedCalculateFibonacciProjection = vi.mocked(calculateFibonacciProjection);
const mockedCalculateTimeframeLookback = vi.mocked(calculateTimeframeLookback);

const setupAdxMock = (adxValues: (number | null)[]) => {
  mockComputeMulti.mockResolvedValue({
    adx: adxValues,
    plusDI: [],
    minusDI: [],
  });
};

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i, i));

describe('getIntervalMs', () => {
  it('should parse minute intervals', () => {
    expect(getIntervalMs('1m')).toBe(60_000);
    expect(getIntervalMs('5m')).toBe(300_000);
    expect(getIntervalMs('15m')).toBe(900_000);
  });

  it('should parse hour intervals', () => {
    expect(getIntervalMs('1h')).toBe(3_600_000);
    expect(getIntervalMs('4h')).toBe(14_400_000);
  });

  it('should parse day intervals', () => {
    expect(getIntervalMs('1d')).toBe(86_400_000);
  });

  it('should parse week intervals', () => {
    expect(getIntervalMs('1w')).toBe(604_800_000);
  });

  it('should return 4h default for invalid format', () => {
    expect(getIntervalMs('invalid')).toBe(4 * 3_600_000);
    expect(getIntervalMs('')).toBe(4 * 3_600_000);
    expect(getIntervalMs('abc123')).toBe(4 * 3_600_000);
  });

  it('should return 4h default for unknown unit', () => {
    expect(getIntervalMs('5x')).toBe(4 * 3_600_000);
  });
});

describe('getAdxBasedFibonacciLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 1.272 when klines are insufficient', async () => {
    const klines = createKlines(10);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(1.272);
    expect(mockComputeMulti).not.toHaveBeenCalled();
  });

  it('should return 1.272 when klines count is exactly 34', async () => {
    const klines = createKlines(34);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(1.272);
  });

  it('should return 1.272 when ADX is null', async () => {
    const klines = createKlines(50);
    setupAdxMock([null]);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(1.272);
  });

  it('should return 2.0 when ADX >= ADX_VERY_STRONG (45)', async () => {
    const klines = createKlines(50);
    setupAdxMock([50]);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(2.0);
  });

  it('should return 1.618 when ADX >= ADX_STRONG (40) but < ADX_VERY_STRONG', async () => {
    const klines = createKlines(50);
    setupAdxMock([42]);
    const result = await getAdxBasedFibonacciLevel(klines, 'SHORT');
    expect(result).toBe(1.618);
  });

  it('should return 1.382 when ADX >= ADX_MIN (25) but < ADX_STRONG', async () => {
    const klines = createKlines(50);
    setupAdxMock([30]);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(1.382);
  });

  it('should return 1.272 when ADX < ADX_MIN (25)', async () => {
    const klines = createKlines(50);
    setupAdxMock([15]);
    const result = await getAdxBasedFibonacciLevel(klines, 'LONG');
    expect(result).toBe(1.272);
  });

  it('should return 2.0 at ADX exactly 45', async () => {
    const klines = createKlines(50);
    setupAdxMock([45]);
    expect(await getAdxBasedFibonacciLevel(klines, 'LONG')).toBe(2.0);
  });

  it('should return 1.618 at ADX exactly 40', async () => {
    const klines = createKlines(50);
    setupAdxMock([40]);
    expect(await getAdxBasedFibonacciLevel(klines, 'LONG')).toBe(1.618);
  });

  it('should return 1.382 at ADX exactly 25', async () => {
    const klines = createKlines(50);
    setupAdxMock([25]);
    expect(await getAdxBasedFibonacciLevel(klines, 'LONG')).toBe(1.382);
  });

  it('should use last ADX value from array', async () => {
    const klines = createKlines(50);
    setupAdxMock([10, 20, 50]);
    expect(await getAdxBasedFibonacciLevel(klines, 'LONG')).toBe(2.0);
  });
});

describe('calculateFibonacciTakeProfit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCalculateTimeframeLookback.mockReturnValue(100);
  });

  it('should return null when projection fails', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue(null);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG');
    expect(result).toBeNull();
  });

  it('should return null when projection has empty levels', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG');
    expect(result).toBeNull();
  });

  it('should return price for matching target level', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 1.272, price: 115 },
        { level: 1.618, price: 120 },
        { level: 2.0, price: 130 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG', '2');
    expect(result).toBe(130);
  });

  it('should fall back to 1.618 level when target not found', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 1.272, price: 115 },
        { level: 1.618, price: 120 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG', '2');
    expect(result).toBe(120);
  });

  it('should return null when neither target nor 1.618 found', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 1.0, price: 110 },
        { level: 1.272, price: 115 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG', '2');
    expect(result).toBeNull();
  });

  it('should use auto mode with ADX-based level', async () => {
    setupAdxMock([50]);
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 1.618, price: 120 },
        { level: 2.0, price: 130 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG', 'auto');
    expect(result).toBe(130);
  });

  it('should use default parameters when not specified', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 2.0, price: 130 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG');
    expect(result).toBe(130);
  });

  it('should pass swingRange and interval to projection', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [{ level: 1.618, price: 120 }],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'SHORT',
    } as never);
    const klines = createKlines(50);
    await calculateFibonacciTakeProfit(klines, 100, 'SHORT', '1.618', '1h', 'extended');
    expect(mockedCalculateTimeframeLookback).toHaveBeenCalledWith('1h');
    expect(mockedCalculateFibonacciProjection).toHaveBeenCalledWith(
      klines, 49, 100, 'SHORT', 'extended'
    );
  });

  it('should match level with small floating point difference', async () => {
    mockedCalculateFibonacciProjection.mockReturnValue({
      levels: [
        { level: 1.6180001, price: 120 },
      ],
      swingHigh: { price: 110, index: 5 },
      swingLow: { price: 90, index: 10 },
      range: 20,
      direction: 'LONG',
    } as never);
    const klines = createKlines(50);
    const result = await calculateFibonacciTakeProfit(klines, 100, 'LONG', '1.618');
    expect(result).toBe(120);
  });
});
