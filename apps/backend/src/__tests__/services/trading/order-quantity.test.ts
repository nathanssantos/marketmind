import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: () => ({
    getSymbolFilters: async () =>
      new Map<string, { stepSize: number; minNotional: number }>([
        ['BTCUSDT', { stepSize: 0.001, minNotional: 5 }],
        ['ETHUSDT', { stepSize: 0.001, minNotional: 5 }],
      ]),
  }),
}));

vi.mock('../../../services/binance-api-cache', () => ({
  guardBinanceCall: <T>(fn: () => Promise<T> | T) => Promise.resolve(fn()),
}));

const mockGetAccountInformationV3 = vi.fn();
const mockGetAccountInformation = vi.fn();

vi.mock('../../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: () => ({
    getAccountInformationV3: mockGetAccountInformationV3,
  }),
}));

vi.mock('../../../services/binance-client', () => ({
  isPaperWallet: (w: { walletType?: string; apiKeyEncrypted?: string }) =>
    w.walletType === 'paper' || w.apiKeyEncrypted === 'paper-trading',
  createBinanceClient: () => ({
    getAccountInformation: mockGetAccountInformation,
  }),
}));

const { calculateQtyFromPercent } = await import('../../../services/trading/order-quantity');

const makeWallet = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 'w1',
    userId: 'u1',
    name: 'Wallet',
    walletType: 'live',
    apiKeyEncrypted: 'k',
    apiSecretEncrypted: 's',
    currentBalance: '1000',
    marketType: 'FUTURES',
    createdAt: new Date(),
    ...overrides,
  }) as unknown as Parameters<typeof calculateQtyFromPercent>[0]['wallet'];

describe('calculateQtyFromPercent', () => {
  it('paper wallet: uses DB balance and 1x leverage', async () => {
    const wallet = makeWallet({ walletType: 'paper', apiKeyEncrypted: 'paper-trading', currentBalance: '1000' });

    const result = await calculateQtyFromPercent({
      wallet,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      percent: 50,
      price: 100000,
    });

    expect(result.leverage).toBe(1);
    expect(result.balance).toBe(1000);
    expect(result.quantity).toBe('0.005');
    expect(result.notional).toBeCloseTo(500, 2);
  });

  it('live FUTURES 75% @ 10x → notional ≈ balance * 7.5 (boleta bug)', async () => {
    mockGetAccountInformationV3.mockResolvedValue({
      availableBalance: '1000',
      positions: [{ symbol: 'BTCUSDT', leverage: '10' }],
    });

    const wallet = makeWallet();

    const result = await calculateQtyFromPercent({
      wallet,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      percent: 75,
      price: 100000,
    });

    expect(result.leverage).toBe(10);
    expect(result.balance).toBe(1000);
    expect(result.notional).toBeCloseTo(7500, -1);
    expect(result.marginUsed).toBeCloseTo(750, -1);
  });

  it('rounds quantity to stepSize', async () => {
    mockGetAccountInformationV3.mockResolvedValue({
      availableBalance: '1000',
      positions: [{ symbol: 'BTCUSDT', leverage: '5' }],
    });

    const wallet = makeWallet();

    const result = await calculateQtyFromPercent({
      wallet,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      percent: 33.33,
      price: 50000,
    });

    expect(/^\d+\.\d{1,3}$/.test(result.quantity)).toBe(true);
  });

  it('reads leverage from accountInformationV3.positions', async () => {
    // V3 positionRisk dropped leverage — accountInfoV3 is the only source.
    mockGetAccountInformationV3.mockResolvedValue({
      availableBalance: '1000',
      positions: [{ symbol: 'BTCUSDT', leverage: '20' }],
    });

    const wallet = makeWallet();

    const result = await calculateQtyFromPercent({
      wallet,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      percent: 10,
      price: 100000,
    });

    expect(result.leverage).toBe(20);
  });

  it('falls back to 1x leverage when accountInfo has no entry for the symbol', async () => {
    mockGetAccountInformationV3.mockResolvedValue({ availableBalance: '1000', positions: [] });

    const wallet = makeWallet();

    const result = await calculateQtyFromPercent({
      wallet,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      percent: 50,
      price: 100000,
    });

    expect(result.leverage).toBe(1);
  });

  it('rejects percent out of range', async () => {
    const wallet = makeWallet({ walletType: 'paper', apiKeyEncrypted: 'paper-trading' });

    await expect(
      calculateQtyFromPercent({ wallet, symbol: 'BTCUSDT', marketType: 'FUTURES', percent: 0, price: 100000 }),
    ).rejects.toThrow();

    await expect(
      calculateQtyFromPercent({ wallet, symbol: 'BTCUSDT', marketType: 'FUTURES', percent: 101, price: 100000 }),
    ).rejects.toThrow();
  });

  it('rejects when live FUTURES balance is zero', async () => {
    mockGetAccountInformationV3.mockResolvedValue({ availableBalance: '0', positions: [] });

    const wallet = makeWallet();

    await expect(
      calculateQtyFromPercent({ wallet, symbol: 'BTCUSDT', marketType: 'FUTURES', percent: 50, price: 100000 }),
    ).rejects.toThrow();
  });

  it('rejects when notional is below minNotional', async () => {
    const wallet = makeWallet({ walletType: 'paper', apiKeyEncrypted: 'paper-trading', currentBalance: '1' });

    await expect(
      calculateQtyFromPercent({ wallet, symbol: 'BTCUSDT', marketType: 'FUTURES', percent: 1, price: 100000 }),
    ).rejects.toThrow(/minimum/i);
  });
});
