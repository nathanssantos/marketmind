import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    query: { klines: { findMany: vi.fn() } },
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: (e: unknown) => e,
}));

vi.mock('../../services/kline-validator', () => ({
  KlineValidator: {
    isKlineCorrupted: vi.fn(() => null),
    isKlineStaleCorrupted: vi.fn(() => null),
    isKlineSpikeCorrupted: vi.fn(() => null),
    fetchBinanceKlinesBatch: vi.fn(async () => new Map()),
  },
}));

import { db } from '../../db';
import { detectAndFixMisalignedKlines } from '../../services/kline-maintenance/corruption-detection';
import type { ActivePair } from '../../services/kline-maintenance/types';

const makePair = (interval: string, symbol = 'BTCUSDT', marketType = 'FUTURES'): ActivePair => ({
  symbol,
  interval: interval as ActivePair['interval'],
  marketType: marketType as ActivePair['marketType'],
});

describe('detectAndFixMisalignedKlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip alignment check for 1w interval', async () => {
    const pair = makePair('1w');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).not.toHaveBeenCalled();
  });

  it('should skip alignment check for 1M interval', async () => {
    const pair = makePair('1M');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).not.toHaveBeenCalled();
  });

  it('should skip alignment check for 1y interval', async () => {
    const pair = makePair('1y');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).not.toHaveBeenCalled();
  });

  it('should check alignment for 1h interval', async () => {
    vi.mocked(db.query.klines.findMany).mockResolvedValue([]);
    const pair = makePair('1h');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).toHaveBeenCalled();
  });

  it('should check alignment for 4h interval', async () => {
    vi.mocked(db.query.klines.findMany).mockResolvedValue([]);
    const pair = makePair('4h');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).toHaveBeenCalled();
  });

  it('should check alignment for 1d interval', async () => {
    vi.mocked(db.query.klines.findMany).mockResolvedValue([]);
    const pair = makePair('1d');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.query.klines.findMany).toHaveBeenCalled();
  });

  it('should not delete aligned klines for 1h', async () => {
    const hourMs = 3600000;
    const baseTime = Math.floor(Date.now() / hourMs) * hourMs;
    vi.mocked(db.query.klines.findMany).mockResolvedValue([
      { openTime: new Date(baseTime - hourMs * 2), closeTime: new Date(baseTime - hourMs * 2 + hourMs - 1), symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', open: '50000', high: '50100', low: '49900', close: '50050', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: new Date(baseTime - hourMs), closeTime: new Date(baseTime - 1), symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', open: '50050', high: '50200', low: '49950', close: '50100', volume: '1100', quoteVolume: '0', trades: 110, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ] as never);

    const pair = makePair('1h');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('should delete misaligned klines for 1h', async () => {
    const hourMs = 3600000;
    const baseTime = Math.floor(Date.now() / hourMs) * hourMs;
    const misalignedTime = baseTime - hourMs + 5000;

    vi.mocked(db.query.klines.findMany).mockResolvedValue([
      { openTime: new Date(misalignedTime), closeTime: new Date(misalignedTime + hourMs - 1), symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', open: '50000', high: '50100', low: '49900', close: '50050', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ] as never);

    const deleteMock = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.delete).mockImplementation(deleteMock as never);

    const pair = makePair('1h');
    const result = await detectAndFixMisalignedKlines(pair);
    expect(result).toBe(1);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});
