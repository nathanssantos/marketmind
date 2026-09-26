import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIME_MS } from '@marketmind/types';

const { findManyMock, maintenanceLogFindFirstMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  maintenanceLogFindFirstMock: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    query: {
      klines: { findMany: findManyMock },
      pairMaintenanceLog: { findFirst: maintenanceLogFindFirstMock },
    },
  },
}));

vi.mock('../../services/custom-symbol-service', () => ({
  getCustomSymbolService: () => null,
}));

vi.mock('../../services/binance-historical', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/binance-historical')>()),
  fetchHistoricalKlinesFromAPI: vi.fn(),
  fetchFuturesKlinesFromAPI: vi.fn(),
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() },
  serializeError: (error: unknown) => String(error),
}));

import { detectGaps } from '../../services/kline-maintenance/gap-detection';

const monthlyBar = (year: number, monthIndex: number) => ({ openTime: new Date(Date.UTC(year, monthIndex, 1)) });
const minuteBar = (openTime: number) => ({ openTime: new Date(openTime) });

const NOW = Date.UTC(2026, 8, 26, 12, 45, 0);
const MONTHLY_PAIR = { symbol: 'BTCUSDT', interval: '1M' as const, marketType: 'FUTURES' as const };
const MINUTE_PAIR = { symbol: 'BTCUSDT', interval: '1m' as const, marketType: 'FUTURES' as const };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  findManyMock.mockReset();
  maintenanceLogFindFirstMock.mockReset();
  maintenanceLogFindFirstMock.mockResolvedValue({ earliestKlineDate: new Date(Date.UTC(2019, 8, 8)) });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('detectGaps with calendar intervals', () => {
  it('reports no gap for a complete run of monthly bars across 28, 30 and 31 day months', async () => {
    findManyMock.mockResolvedValue(Array.from({ length: 9 }, (_, monthIndex) => monthlyBar(2026, monthIndex)));

    expect(await detectGaps(MONTHLY_PAIR)).toEqual([]);
  });

  it('reports exactly the missing month with calendar-aligned bounds', async () => {
    findManyMock.mockResolvedValue([0, 1, 2, 3, 5, 6, 7, 8].map((monthIndex) => monthlyBar(2026, monthIndex)));

    const gaps = await detectGaps(MONTHLY_PAIR);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      gapStart: new Date(Date.UTC(2026, 4, 1)),
      gapEnd: new Date(Date.UTC(2026, 4, 1)),
      missingCandles: 1,
    });
  });
});

describe('detectGaps tail handling', () => {
  it('never reports the bar that is still open, but reports closed bars missing at the end', async () => {
    findManyMock.mockResolvedValue(Array.from({ length: 7 }, (_, monthIndex) => monthlyBar(2026, monthIndex)));

    const gaps = await detectGaps(MONTHLY_PAIR);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      gapStart: new Date(Date.UTC(2026, 7, 1)),
      gapEnd: new Date(Date.UTC(2026, 7, 1)),
      missingCandles: 1,
    });
  });

  it('reports nothing when only the open bar is absent', async () => {
    const lastClosedOpenTime = NOW - NOW % TIME_MS.MINUTE - TIME_MS.MINUTE;
    findManyMock.mockResolvedValue([3, 2, 1, 0].map((back) => minuteBar(lastClosedOpenTime - back * TIME_MS.MINUTE)));

    expect(await detectGaps(MINUTE_PAIR)).toEqual([]);
  });
});

describe('detectGaps with fixed intervals', () => {
  it('reports the missing minutes inside a 1m series', async () => {
    const start = NOW - 10 * TIME_MS.MINUTE;
    findManyMock.mockResolvedValue([0, 1, 2, 5, 6, 7, 8, 9, 10].map((step) => minuteBar(start + step * TIME_MS.MINUTE)));

    const gaps = await detectGaps(MINUTE_PAIR);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      gapStart: new Date(start + 3 * TIME_MS.MINUTE),
      gapEnd: new Date(start + 4 * TIME_MS.MINUTE),
      missingCandles: 2,
    });
  });
});
