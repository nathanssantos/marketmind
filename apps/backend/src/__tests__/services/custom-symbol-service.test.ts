import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  cleanupTables,
  getTestDatabase,
  setupTestDatabase,
  teardownTestDatabase,
} from '../helpers/test-db';
import { customSymbolComponents, customSymbols, klines as klinesTable } from '../../db/schema';

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
});
