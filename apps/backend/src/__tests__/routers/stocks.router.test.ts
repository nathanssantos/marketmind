import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedCaller } from '../helpers/test-caller';
import { cleanupTables, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';

const checkShortability = vi.fn();
vi.mock('../../exchange/interactive-brokers/shortable-checker', () => ({
  shortableChecker: { checkShortability: (...args: unknown[]) => checkShortability(...args) },
}));

vi.mock('binance', async () => {
  const actual = await vi.importActual<typeof import('binance')>('binance');
  class StubClient {
    setTimeOffset() {}
    getTimeOffset() { return 0; }
  }
  return { ...actual, USDMClient: StubClient, MainClient: StubClient };
});

describe('Stocks router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    checkShortability.mockReset();
  });

  const setup = async () => {
    const { user, session } = await createAuthenticatedUser();
    return createAuthenticatedCaller(user, session);
  };

  it('reports the NYSE session with the next open or close', async () => {
    const caller = await setup();

    const status = await caller.stocks.marketStatus();

    expect(['PRE_MARKET', 'REGULAR', 'AFTER_HOURS', 'CLOSED']).toContain(status.sessionType);
    expect(status.isOpen).toBe(status.sessionType === 'REGULAR');
    expect(status.timezone).toBe('America/New_York');
    expect(status.sessionType === 'CLOSED' ? status.nextOpen : status.nextClose).toBeTruthy();
  });

  it('returns the shortability info when the gateway answers', async () => {
    checkShortability.mockResolvedValue({ symbol: 'AAPL', available: true, difficulty: 'easy', sharesAvailable: 1_000_000 });
    const caller = await setup();

    const result = await caller.stocks.shortability({ symbol: 'aapl' });

    expect(result).toEqual({ known: true, info: expect.objectContaining({ symbol: 'AAPL', available: true }) });
    expect(checkShortability).toHaveBeenCalledWith('aapl');
  });

  it('reports shortability as unknown when the gateway is not connected', async () => {
    checkShortability.mockRejectedValue(new Error('ECONNREFUSED'));
    const caller = await setup();

    const result = await caller.stocks.shortability({ symbol: 'AAPL' });

    expect(result).toEqual({ known: false, reason: 'Interactive Brokers Gateway is not connected' });
  });

  it('estimates the tiered commission for a stock order', async () => {
    const caller = await setup();

    const estimate = await caller.stocks.commissionEstimate({ shares: 100, price: 150 });

    expect(estimate.shares).toBe(100);
    expect(estimate.tradeValue).toBe(15_000);
    expect(estimate.commission).toBeGreaterThan(0);
    expect(estimate.commission).toBeLessThanOrEqual(15_000 * 0.01);
  });

  it('returns zero commission for IBKR Lite', async () => {
    const caller = await setup();

    const estimate = await caller.stocks.commissionEstimate({ shares: 100, price: 150, accountType: 'LITE' });

    expect(estimate.commission).toBe(0);
  });

  it('serves whole-share filters for stock symbols', async () => {
    const caller = await setup();

    const filters = await caller.trading.getSymbolFilters({ symbol: 'AAPL', marketType: 'SPOT', exchange: 'INTERACTIVE_BROKERS' });

    expect(filters).toEqual({ minNotional: 1, minQty: 1, stepSize: 1, tickSize: 0.01 });
  });

  it('creates an Interactive Brokers paper wallet in USD on spot', async () => {
    const caller = await setup();

    const wallet = await caller.wallet.createPaper({ name: 'IB Paper', exchange: 'INTERACTIVE_BROKERS', marketType: 'SPOT', currency: 'USD' });

    expect(wallet.exchange).toBe('INTERACTIVE_BROKERS');
    const [listed] = await caller.wallet.list();
    expect(listed?.exchange).toBe('INTERACTIVE_BROKERS');
    expect(listed?.marketType).toBe('SPOT');
  });

  it('refuses an Interactive Brokers wallet on futures', async () => {
    const caller = await setup();

    await expect(
      caller.wallet.createPaper({ name: 'IB Futures', exchange: 'INTERACTIVE_BROKERS', marketType: 'FUTURES' }),
    ).rejects.toThrow('stocks only');
  });

  it('creates an Interactive Brokers gateway wallet without calling Binance', async () => {
    const caller = await setup();

    const wallet = await caller.wallet.create({ name: 'IB Gateway', apiKey: 'unused', apiSecret: 'unused', walletType: 'testnet', marketType: 'SPOT', exchange: 'INTERACTIVE_BROKERS' });

    expect(wallet.exchange).toBe('INTERACTIVE_BROKERS');
    expect(wallet.currency).toBe('USD');
  });

  it('rejects a paper stock order while no stock price is available', async () => {
    const { user, session } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', marketType: 'SPOT', exchange: 'INTERACTIVE_BROKERS' });
    const caller = createAuthenticatedCaller(user, session);

    await expect(
      caller.trading.createOrder({ walletId: wallet.id, symbol: 'AAPL', marketType: 'SPOT', side: 'BUY', type: 'MARKET', quantity: '1' }),
    ).rejects.toThrow('Interactive Brokers Gateway is not connected');
  });
});
