import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  cleanupTables,
  getTestDatabase,
  setupTestDatabase,
  teardownTestDatabase,
} from '../helpers/test-db';
import { customSymbolComponents, customSymbols, klines as klinesTable } from '../../db/schema';
import { smartBackfillKlines } from '../../services/binance-historical';

vi.mock('../../services/binance-historical', () => ({
  smartBackfillKlines: vi.fn().mockResolvedValue({
    totalInDb: 0,
    downloaded: 0,
    gaps: 0,
    alreadyComplete: true,
  }),
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => null,
}));

vi.mock('../../services/binance-spot-stream', () => ({
  binancePriceStream: {
    subscribeToPrice: vi.fn(),
    unsubscribeFromPrice: vi.fn(),
  },
}));

vi.mock('../../services/custom-symbol-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/custom-symbol-helpers')>();
  return {
    ...actual,
    fetchBinancePrice: vi.fn().mockResolvedValue(0),
    fetchMarketCaps: vi.fn().mockResolvedValue(new Map()),
  };
});

const { CustomSymbolService } = await import('../../services/custom-symbol-service');

const makeKline = (
  symbol: string,
  marketType: 'SPOT' | 'FUTURES',
  openTime: Date,
  close: number,
) => ({
  symbol,
  interval: '1h' as const,
  marketType,
  openTime,
  closeTime: new Date(openTime.getTime() + 60 * 60 * 1000),
  open: close.toString(),
  high: (close * 1.01).toString(),
  low: (close * 0.99).toString(),
  close: close.toString(),
  volume: '100',
  quoteVolume: (close * 100).toString(),
  trades: 50,
  takerBuyBaseVolume: '50',
  takerBuyQuoteVolume: (close * 50).toString(),
});

const seedKlines = async (symbol: string, marketType: 'SPOT' | 'FUTURES', count: number, basePrice = 100) => {
  const db = getTestDatabase();
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, i) =>
    makeKline(symbol, marketType, new Date(now - (count - i) * 60 * 60 * 1000), basePrice + i * 0.1),
  );
  await db.insert(klinesTable).values(rows);
};

describe('CustomSymbolService — backfillKlines', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    vi.mocked(smartBackfillKlines).mockReset();
    vi.mocked(smartBackfillKlines).mockResolvedValue({
      totalInDb: 0,
      downloaded: 0,
      gaps: 0,
      alreadyComplete: true,
    });
  });

  it('falls back to alternate marketType when configured one has no klines', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX',
      name: 'Test Index',
      category: 'other',
      baseValue: '100',
      weightingMethod: 'EQUAL',
      capPercent: '40',
      rebalanceIntervalDays: 30,
      isActive: true,
    }).returning();

    expect(cs).toBeDefined();
    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values({
      customSymbolId: cs.id,
      symbol: 'BTCUSDT',
      marketType: 'SPOT',
      coingeckoId: null,
      weight: '1.0',
      basePrice: '60000',
      isActive: true,
    });

    // Seed klines as FUTURES only (no SPOT rows)
    await seedKlines('BTCUSDT', 'FUTURES', 50, 60000);

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX');
    await service.backfillKlines('TESTIDX', '1h', 'SPOT');

    const updated = await db.query.customSymbolComponents.findFirst({
      where: and(
        eq(customSymbolComponents.customSymbolId, cs.id),
        eq(customSymbolComponents.symbol, 'BTCUSDT'),
      ),
    });

    expect(updated?.marketType).toBe('FUTURES');
  });

  it('renormalizes weights when some components have no klines', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX2',
      name: 'Test Index 2',
      category: 'other',
      baseValue: '100',
      weightingMethod: 'EQUAL',
      capPercent: '40',
      rebalanceIntervalDays: 30,
      isActive: true,
    }).returning();

    if (!cs) throw new Error('Failed to insert custom symbol');

    // 2 components, each weight 0.5; only one will have klines
    await db.insert(customSymbolComponents).values([
      {
        customSymbolId: cs.id,
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        coingeckoId: null,
        weight: '0.5',
        basePrice: '60000',
        isActive: true,
      },
      {
        customSymbolId: cs.id,
        symbol: 'NOKLINESUSDT',
        marketType: 'FUTURES',
        coingeckoId: null,
        weight: '0.5',
        basePrice: '100',
        isActive: true,
      },
    ]);

    // Seed klines for BTCUSDT only
    await seedKlines('BTCUSDT', 'FUTURES', 30, 60000);

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX2');
    await service.backfillKlines('TESTIDX2', '1h', 'FUTURES');

    // Synthetic klines for the index were produced — proves the renormalization
    // branch was taken (otherwise no component had klines for all timestamps and
    // commonTimestamps would be empty).
    const indexKlines = await db.query.klines.findMany({
      where: and(
        eq(klinesTable.symbol, 'TESTIDX2'),
        eq(klinesTable.interval, '1h'),
      ),
    });

    expect(indexKlines.length).toBeGreaterThan(0);
  });

  it('writes nothing when no component has usable klines', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX3',
      name: 'Test Index 3',
      category: 'other',
      baseValue: '100',
      weightingMethod: 'EQUAL',
      capPercent: '40',
      rebalanceIntervalDays: 30,
      isActive: true,
    }).returning();

    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values({
      customSymbolId: cs.id,
      symbol: 'EMPTYUSDT',
      marketType: 'FUTURES',
      coingeckoId: null,
      weight: '1.0',
      basePrice: '100',
      isActive: true,
    });

    // No klines seeded for EMPTYUSDT in any market type
    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX3');
    await service.backfillKlines('TESTIDX3', '1h', 'FUTURES');

    const indexKlines = await db.query.klines.findMany({
      where: eq(klinesTable.symbol, 'TESTIDX3'),
    });
    expect(indexKlines).toHaveLength(0);
  });

  it('refreshes from Binance FUTURES when smartBackfillKlines downloads new rows', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX4', name: 'Refresh Index', category: 'other', baseValue: '100',
      weightingMethod: 'EQUAL', capPercent: '40', rebalanceIntervalDays: 30, isActive: true,
    }).returning();
    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values({
      customSymbolId: cs.id, symbol: 'BTCUSDT', marketType: 'SPOT',
      coingeckoId: null, weight: '1.0', basePrice: '60000', isActive: true,
    });

    // Simulate smartBackfillKlines populating FUTURES klines mid-call.
    vi.mocked(smartBackfillKlines).mockImplementationOnce(async () => {
      const now = Date.now();
      const rows = Array.from({ length: 30 }, (_, i) =>
        makeKline('BTCUSDT', 'FUTURES', new Date(now - (30 - i) * 60 * 60 * 1000), 60000 + i),
      );
      await db.insert(klinesTable).values(rows);
      return { totalInDb: 30, downloaded: 30, gaps: 0, alreadyComplete: false };
    });

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX4');
    await service.backfillKlines('TESTIDX4', '1h', 'SPOT');

    expect(vi.mocked(smartBackfillKlines)).toHaveBeenCalledWith('BTCUSDT', '1h', expect.any(Number), 'FUTURES');

    const updated = await db.query.customSymbolComponents.findFirst({
      where: and(
        eq(customSymbolComponents.customSymbolId, cs.id),
        eq(customSymbolComponents.symbol, 'BTCUSDT'),
      ),
    });
    expect(updated?.marketType).toBe('FUTURES');
  });

  it('falls back to SPOT smartBackfillKlines when FUTURES returns 0 and DB has no rows', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX5', name: 'Spot Fallback', category: 'other', baseValue: '100',
      weightingMethod: 'EQUAL', capPercent: '40', rebalanceIntervalDays: 30, isActive: true,
    }).returning();
    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values({
      customSymbolId: cs.id, symbol: 'NEWCOIN', marketType: 'FUTURES',
      coingeckoId: null, weight: '1.0', basePrice: '5', isActive: true,
    });

    // First call (FUTURES) returns nothing; second call (SPOT) populates SPOT klines.
    vi.mocked(smartBackfillKlines)
      .mockImplementationOnce(async () => ({ totalInDb: 0, downloaded: 0, gaps: 0, alreadyComplete: true }))
      .mockImplementationOnce(async () => {
        const now = Date.now();
        const rows = Array.from({ length: 20 }, (_, i) =>
          makeKline('NEWCOIN', 'SPOT', new Date(now - (20 - i) * 60 * 60 * 1000), 5 + i * 0.1),
        );
        await db.insert(klinesTable).values(rows);
        return { totalInDb: 20, downloaded: 20, gaps: 0, alreadyComplete: false };
      });

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX5');
    await service.backfillKlines('TESTIDX5', '1h', 'FUTURES');

    expect(vi.mocked(smartBackfillKlines)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(smartBackfillKlines).mock.calls[0]?.[3]).toBe('FUTURES');
    expect(vi.mocked(smartBackfillKlines).mock.calls[1]?.[3]).toBe('SPOT');

    const updated = await db.query.customSymbolComponents.findFirst({
      where: and(
        eq(customSymbolComponents.customSymbolId, cs.id),
        eq(customSymbolComponents.symbol, 'NEWCOIN'),
      ),
    });
    expect(updated?.marketType).toBe('SPOT');
  });

  it('swallows smartBackfillKlines errors and proceeds with cached rows', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX6', name: 'Resilient Index', category: 'other', baseValue: '100',
      weightingMethod: 'EQUAL', capPercent: '40', rebalanceIntervalDays: 30, isActive: true,
    }).returning();
    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values({
      customSymbolId: cs.id, symbol: 'BTCUSDT', marketType: 'FUTURES',
      coingeckoId: null, weight: '1.0', basePrice: '60000', isActive: true,
    });

    await seedKlines('BTCUSDT', 'FUTURES', 40, 60000);

    vi.mocked(smartBackfillKlines).mockRejectedValue(new Error('Binance API down'));

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX6');
    await service.backfillKlines('TESTIDX6', '1h', 'FUTURES');

    const indexKlines = await db.query.klines.findMany({
      where: and(eq(klinesTable.symbol, 'TESTIDX6'), eq(klinesTable.interval, '1h')),
    });
    expect(indexKlines.length).toBeGreaterThan(0);
  });

  it('returns early without writes when the customSymbol is not loaded', async () => {
    const service = new CustomSymbolService();
    await service.backfillKlines('NOTLOADED', '1h', 'FUTURES');
    expect(vi.mocked(smartBackfillKlines)).not.toHaveBeenCalled();
  });

  it('produces synthetic index klines with weighted-average close', async () => {
    const db = getTestDatabase();
    const [cs] = await db.insert(customSymbols).values({
      symbol: 'TESTIDX7', name: 'Math Index', category: 'other', baseValue: '100',
      weightingMethod: 'EQUAL', capPercent: '40', rebalanceIntervalDays: 30, isActive: true,
    }).returning();
    if (!cs) throw new Error('Failed to insert custom symbol');

    await db.insert(customSymbolComponents).values([
      {
        customSymbolId: cs.id, symbol: 'AAA', marketType: 'FUTURES',
        coingeckoId: null, weight: '0.5', basePrice: '100', isActive: true,
      },
      {
        customSymbolId: cs.id, symbol: 'BBB', marketType: 'FUTURES',
        coingeckoId: null, weight: '0.5', basePrice: '200', isActive: true,
      },
    ]);

    // Both components at their base prices → index should be close to baseValue (100).
    const now = Date.now();
    const aligned = Math.floor(now / 3_600_000) * 3_600_000;
    await db.insert(klinesTable).values([
      makeKline('AAA', 'FUTURES', new Date(aligned - 3_600_000), 100),
      makeKline('AAA', 'FUTURES', new Date(aligned), 110),
      makeKline('BBB', 'FUTURES', new Date(aligned - 3_600_000), 200),
      makeKline('BBB', 'FUTURES', new Date(aligned), 220),
    ]);

    const service = new CustomSymbolService();
    await service.hotLoad('TESTIDX7');
    await service.backfillKlines('TESTIDX7', '1h', 'FUTURES');

    const indexKlines = await db.query.klines.findMany({
      where: and(eq(klinesTable.symbol, 'TESTIDX7'), eq(klinesTable.interval, '1h')),
    });
    expect(indexKlines.length).toBe(2);

    // Both components at base price → index ≈ baseValue (100). At +10% on both → +10% on index.
    const lastIndex = indexKlines.find((k) => k.openTime.getTime() === aligned);
    expect(lastIndex).toBeDefined();
    const close = parseFloat(lastIndex!.close);
    expect(close).toBeGreaterThan(108);
    expect(close).toBeLessThan(112);
  });
});
