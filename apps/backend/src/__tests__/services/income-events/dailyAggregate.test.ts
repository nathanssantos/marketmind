import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { incomeEvents } from '../../../db/schema';
import { getDailyIncomeSum } from '../../../services/income-events';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../../helpers/test-fixtures';

describe('getDailyIncomeSum', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  it('sums PNL-contributing types per day in UTC', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live' });
    const db = getTestDatabase();

    const day = new Date('2026-04-19T12:00:00Z');

    await db.insert(incomeEvents).values([
      { walletId: wallet.id, userId: user.id, binanceTranId: 1, incomeType: 'REALIZED_PNL', amount: '100', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day },
      { walletId: wallet.id, userId: user.id, binanceTranId: 2, incomeType: 'COMMISSION', amount: '-5', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day },
      { walletId: wallet.id, userId: user.id, binanceTranId: 3, incomeType: 'FUNDING_FEE', amount: '-2', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day },
      { walletId: wallet.id, userId: user.id, binanceTranId: 4, incomeType: 'TRANSFER', amount: '1000', asset: 'USDT', source: 'binance', incomeTime: day },
    ]);

    const map = await getDailyIncomeSum({
      walletId: wallet.id,
      userId: user.id,
      from: new Date('2026-04-19T00:00:00Z'),
      to: new Date('2026-04-19T23:59:59Z'),
      tz: 'UTC',
    });

    expect(map.get('2026-04-19')).toBeCloseTo(93, 2);
  });

  it('respects tz: event at 02:00 UTC counts as previous day in America/Sao_Paulo', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live' });
    const db = getTestDatabase();

    const eventUtc = new Date('2026-04-19T02:00:00Z');

    await db.insert(incomeEvents).values([
      { walletId: wallet.id, userId: user.id, binanceTranId: 10, incomeType: 'REALIZED_PNL', amount: '50', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: eventUtc },
    ]);

    const mapSp = await getDailyIncomeSum({
      walletId: wallet.id,
      userId: user.id,
      from: new Date('2026-04-17T00:00:00Z'),
      to: new Date('2026-04-20T00:00:00Z'),
      tz: 'America/Sao_Paulo',
    });

    expect(mapSp.get('2026-04-18')).toBeCloseTo(50, 2);
    expect(mapSp.get('2026-04-19')).toBeUndefined();
  });

  it('multi-day position: yesterday fees stay on yesterday', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live' });
    const db = getTestDatabase();

    const day1 = new Date('2026-04-18T10:00:00Z');
    const day2 = new Date('2026-04-19T14:00:00Z');

    await db.insert(incomeEvents).values([
      { walletId: wallet.id, userId: user.id, binanceTranId: 100, incomeType: 'COMMISSION', amount: '-0.50', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day1 },
      { walletId: wallet.id, userId: user.id, binanceTranId: 101, incomeType: 'FUNDING_FEE', amount: '-1.20', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day1 },
      { walletId: wallet.id, userId: user.id, binanceTranId: 102, incomeType: 'REALIZED_PNL', amount: '115.78', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day2 },
      { walletId: wallet.id, userId: user.id, binanceTranId: 103, incomeType: 'COMMISSION', amount: '-0.40', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: day2 },
    ]);

    const map = await getDailyIncomeSum({
      walletId: wallet.id,
      userId: user.id,
      from: new Date('2026-04-17T00:00:00Z'),
      to: new Date('2026-04-20T00:00:00Z'),
      tz: 'UTC',
    });

    expect(map.get('2026-04-18')).toBeCloseTo(-1.70, 2);
    expect(map.get('2026-04-19')).toBeCloseTo(115.38, 2);
  });
});
