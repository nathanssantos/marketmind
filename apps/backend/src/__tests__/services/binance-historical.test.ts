import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backfillHistoricalKlines,
  calculateStartTime,
  fetchHistoricalKlinesFromAPI,
  fetchFuturesKlinesFromAPI,
  getIntervalMilliseconds,
  smartBackfillKlines,
} from '../../services/binance-historical';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    query: {
      klines: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { db } = await import('../../db');

describe('BinanceHistorical Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
  });

  describe('getIntervalMilliseconds', () => {
    it('should return correct milliseconds for 1m interval', () => {
      expect(getIntervalMilliseconds('1m')).toBe(60000);
    });

    it('should return correct milliseconds for 5m interval', () => {
      expect(getIntervalMilliseconds('5m')).toBe(300000);
    });

    it('should return correct milliseconds for 15m interval', () => {
      expect(getIntervalMilliseconds('15m')).toBe(900000);
    });

    it('should return correct milliseconds for 30m interval', () => {
      expect(getIntervalMilliseconds('30m')).toBe(1800000);
    });

    it('should return correct milliseconds for 1h interval', () => {
      expect(getIntervalMilliseconds('1h')).toBe(3600000);
    });

    it('should return correct milliseconds for 4h interval', () => {
      expect(getIntervalMilliseconds('4h')).toBe(14400000);
    });

    it('should return correct milliseconds for 1d interval', () => {
      expect(getIntervalMilliseconds('1d')).toBe(86400000);
    });

    it('should return correct milliseconds for 1w interval', () => {
      expect(getIntervalMilliseconds('1w')).toBe(604800000);
    });

    it('should return correct milliseconds for 1M interval', () => {
      expect(getIntervalMilliseconds('1M')).toBe(2592000000);
    });

    it('should return correct milliseconds for 1s interval', () => {
      expect(getIntervalMilliseconds('1s')).toBe(1000);
    });
  });

  describe('calculateStartTime', () => {
    it('should calculate start time for 100 periods of 1h', () => {
      const now = Date.now();
      const result = calculateStartTime('1h', 100);
      const expected = new Date(now - 100 * 3600000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(100);
    });

    it('should calculate start time for 50 periods of 1d', () => {
      const now = Date.now();
      const result = calculateStartTime('1d', 50);
      const expected = new Date(now - 50 * 86400000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(100);
    });

    it('should calculate start time for 1000 periods of 1m', () => {
      const now = Date.now();
      const result = calculateStartTime('1m', 1000);
      const expected = new Date(now - 1000 * 60000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(100);
    });
  });

  describe('backfillHistoricalKlines', () => {
    it('should fetch and insert klines for SPOT market', async () => {
      const mockCandles = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50000000', 5000, '500', '25000000'],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCandles),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await backfillHistoricalKlines(
        'BTCUSDT',
        '1h',
        new Date(1700000000000),
        new Date(1700003600000),
        'SPOT'
      );

      expect(result).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.binance.com'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should fetch and insert klines for FUTURES market', async () => {
      const mockCandles = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50000000', 5000, '500', '25000000'],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCandles),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await backfillHistoricalKlines(
        'BTCUSDT',
        '1h',
        new Date(1700000000000),
        new Date(1700003600000),
        'FUTURES'
      );

      expect(result).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fapi.binance.com'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        backfillHistoricalKlines('BTCUSDT', '1h', new Date(1700000000000))
      ).rejects.toThrow('Server error: 500 Internal Server Error');
    });

    it('should stop when no more candles are returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await backfillHistoricalKlines(
        'BTCUSDT',
        '1h',
        new Date(1700000000000),
        new Date(1700003600000)
      );

      expect(result).toBe(0);
    });
  });

  describe('fetchHistoricalKlinesFromAPI', () => {
    it('should fetch klines and return mapped data', async () => {
      const mockCandles = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50000000', 5000, '500', '25000000'],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCandles),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await fetchHistoricalKlinesFromAPI(
        'BTCUSDT',
        '1h',
        new Date(1700000000000),
        new Date(1700003600000)
      );

      expect(result).toHaveLength(1);
      expect(result[0].openTime).toBe(1700000000000);
      expect(result[0].open).toBe('50000');
      expect(result[0].close).toBe('50200');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        fetchHistoricalKlinesFromAPI('BTCUSDT', '1h', new Date(1700000000000))
      ).rejects.toThrow('Server error: 500 Internal Server Error');
    });
  });

  describe('fetchFuturesKlinesFromAPI', () => {
    it('should fetch futures klines and return mapped data', async () => {
      const mockCandles = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50000000', 5000, '500', '25000000'],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCandles),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await fetchFuturesKlinesFromAPI(
        'BTCUSDT',
        '1h',
        new Date(1700000000000),
        new Date(1700003600000)
      );

      expect(result).toHaveLength(1);
      expect(result[0].openTime).toBe(1700000000000);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fapi.binance.com'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        fetchFuturesKlinesFromAPI('BTCUSDT', '1h', new Date(1700000000000))
      ).rejects.toThrow('Server error: 500');
    });
  });

  describe('smartBackfillKlines', () => {
    it('should detect gaps and calculate result', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const mockCandles = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50000000', 5000, '500', '25000000'],
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCandles) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      const result = await smartBackfillKlines('BTCUSDT', '1h', 100);

      expect(result).toHaveProperty('totalInDb');
      expect(result).toHaveProperty('downloaded');
      expect(result).toHaveProperty('gaps');
      expect(result).toHaveProperty('alreadyComplete');
    });
  });
});
