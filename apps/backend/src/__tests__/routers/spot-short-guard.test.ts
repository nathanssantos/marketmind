import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { priceCache } from '../../services/price-cache';
import { createAuthenticatedCaller } from '../helpers/test-caller';
import { cleanupTables, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';

vi.mock('binance', async () => {
  const actual = await vi.importActual<typeof import('binance')>('binance');
  class StubClient {
    setTimeOffset() {}
    getTimeOffset() { return 0; }
  }
  return { ...actual, USDMClient: StubClient, MainClient: StubClient };
});

const SYMBOL = 'BTCUSDT';

const setup = async (marketType: 'SPOT' | 'FUTURES') => {
  const { user, session } = await createAuthenticatedUser();
  const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', marketType });
  return { wallet, caller: createAuthenticatedCaller(user, session) };
};

describe('Spot wallets never open a short', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    priceCache.updateFromWebSocket(SYMBOL, 'FUTURES', 50_000);
    priceCache.updateFromWebSocket(SYMBOL, 'SPOT', 50_000);
  });

  it('rejects trading.createPosition SHORT on a spot wallet', async () => {
    const { caller, wallet } = await setup('SPOT');

    await expect(
      caller.trading.createPosition({ walletId: wallet.id, symbol: SYMBOL, side: 'SHORT', entryPrice: '50000', entryQty: '0.1' }),
    ).rejects.toThrow('Spot wallets cannot open short positions');
  });

  it('accepts trading.createPosition LONG on a spot wallet', async () => {
    const { caller, wallet } = await setup('SPOT');

    const position = await caller.trading.createPosition({ walletId: wallet.id, symbol: SYMBOL, side: 'LONG', entryPrice: '50000', entryQty: '0.1' });

    expect(position.id).toBeDefined();
  });

  it('still accepts trading.createPosition SHORT on a futures wallet', async () => {
    const { caller, wallet } = await setup('FUTURES');

    const position = await caller.trading.createPosition({ walletId: wallet.id, symbol: SYMBOL, side: 'SHORT', entryPrice: '50000', entryQty: '0.1' });

    expect(position.id).toBeDefined();
  });

  it('rejects futuresTrading.createOrder on a spot wallet', async () => {
    const { caller, wallet } = await setup('SPOT');

    await expect(
      caller.futuresTrading.createOrder({ walletId: wallet.id, symbol: SYMBOL, side: 'SELL', type: 'MARKET', quantity: '0.1' }),
    ).rejects.toThrow('Spot wallets cannot trade futures');
  });

  it('rejects futuresTrading.createPosition on a spot wallet', async () => {
    const { caller, wallet } = await setup('SPOT');

    await expect(
      caller.futuresTrading.createPosition({ walletId: wallet.id, symbol: SYMBOL, side: 'SHORT', entryPrice: '50000', entryQty: '0.1' }),
    ).rejects.toThrow('Spot wallets cannot trade futures');
  });

  it('rejects futuresTrading.reversePosition on a spot wallet', async () => {
    const { caller, wallet } = await setup('SPOT');

    await expect(
      caller.futuresTrading.reversePosition({ walletId: wallet.id, symbol: SYMBOL, positionId: 'any' }),
    ).rejects.toThrow('Spot wallets cannot trade futures');
  });
});
