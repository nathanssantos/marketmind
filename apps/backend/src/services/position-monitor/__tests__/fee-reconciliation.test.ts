import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAllTradeFeesForPosition = vi.fn().mockResolvedValue(null);
const mockGetLastClosingTrade = vi.fn().mockResolvedValue(null);
const mockGetOrderEntryFee = vi.fn().mockResolvedValue(null);

vi.mock('../../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({
    getAllTradeFeesForPosition: (...args: unknown[]) => mockGetAllTradeFeesForPosition(...args),
    getLastClosingTrade: (...args: unknown[]) => mockGetLastClosingTrade(...args),
    getOrderEntryFee: (...args: unknown[]) => mockGetOrderEntryFee(...args),
  })),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

import { fetchActualFeesFromExchange, fetchMissingEntryFee } from '../fee-reconciliation';

const createMockWallet = () => ({
  id: 'wallet-1',
  userId: 'user-1',
  exchange: 'binance',
}) as never;

const createMockExecution = (overrides = {}) => ({
  id: 'exec-1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  entryOrderId: '12345',
  openedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  ...overrides,
}) as never;

describe('fetchActualFeesFromExchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial values when exchange API returns null', async () => {
    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0.5, 0.5
    );

    expect(result.actualEntryFee).toBe(0.5);
    expect(result.actualExitFee).toBe(0.5);
    expect(result.actualFees).toBe(1);
  });

  it('should use exchange fees when getAllTradeFeesForPosition returns data', async () => {
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce({
      entryFee: 1.5,
      exitFee: 1.2,
      totalFees: 2.7,
      exitPrice: 51050,
      realizedPnl: 97.3,
    });

    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0.5, 0.5
    );

    expect(result.actualEntryFee).toBe(1.5);
    expect(result.actualExitFee).toBe(1.2);
    expect(result.actualFees).toBe(2.7);
    expect(result.actualExitPrice).toBe(51050);
  });

  it('should fallback to getLastClosingTrade when getAllTradeFeesForPosition returns null', async () => {
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce(null);
    mockGetLastClosingTrade.mockResolvedValueOnce({
      price: 51100,
      commission: 0.8,
    });

    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0.5, 0.5
    );

    expect(result.actualExitPrice).toBe(51100);
    expect(result.actualExitFee).toBe(0.8);
  });

  it('should fetch entry fee in fallback path when actualEntryFee is 0', async () => {
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce(null);
    mockGetLastClosingTrade.mockResolvedValueOnce({
      price: 51000,
      commission: 0.5,
    });
    mockGetOrderEntryFee.mockResolvedValueOnce({ entryFee: 0.6 });

    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0, 0.5
    );

    expect(result.actualEntryFee).toBe(0.6);
    expect(result.actualExitFee).toBe(0.5);
  });

  it('should handle exchange API errors gracefully', async () => {
    mockGetAllTradeFeesForPosition.mockRejectedValueOnce(new Error('API timeout'));

    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0.5, 0.5
    );

    expect(result.actualEntryFee).toBe(0.5);
    expect(result.actualExitFee).toBe(0.5);
  });

  it('should include accumulated funding in PnL calculation', async () => {
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce({
      entryFee: 0.5,
      exitFee: 0.5,
      totalFees: 1,
      exitPrice: 51000,
      realizedPnl: 99,
    });

    const resultWithFunding = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 5.0, 0.5, 0.5
    );

    const resultWithoutFunding = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution(),
      50000, 51000, 0.1, 0, 0.5, 0.5
    );

    expect(resultWithFunding.actualPnl).not.toBe(resultWithoutFunding.actualPnl);
  });

  it('should recalculate PnL for SHORT positions correctly', async () => {
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce({
      entryFee: 0.5,
      exitFee: 0.5,
      totalFees: 1,
      exitPrice: 49000,
      realizedPnl: 99,
    });

    const result = await fetchActualFeesFromExchange(
      createMockWallet(), createMockExecution({ side: 'SHORT' }),
      50000, 49000, 0.1, 0, 0.5, 0.5
    );

    expect(result.actualPnl).toBeGreaterThan(0);
    expect(result.actualPnlPercent).toBeGreaterThan(0);
  });
});

describe('fetchMissingEntryFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch entry fee from exchange', async () => {
    mockGetOrderEntryFee.mockResolvedValueOnce({ entryFee: 1.2 });

    const result = await fetchMissingEntryFee(
      createMockWallet(),
      createMockExecution(),
      {
        actualEntryFee: 0,
        actualExitFee: 0.5,
        actualExitPrice: 51000,
        accumulatedFunding: 0,
        entryPrice: 50000,
        quantity: 0.1,
      }
    );

    expect(result.actualEntryFee).toBe(1.2);
    expect(result.actualFees).toBe(1.7);
  });

  it('should keep original values when exchange fetch fails', async () => {
    mockGetOrderEntryFee.mockRejectedValueOnce(new Error('API error'));

    const result = await fetchMissingEntryFee(
      createMockWallet(),
      createMockExecution(),
      {
        actualEntryFee: 0,
        actualExitFee: 0.5,
        actualExitPrice: 51000,
        accumulatedFunding: 0,
        entryPrice: 50000,
        quantity: 0.1,
      }
    );

    expect(result.actualEntryFee).toBe(0);
    expect(result.actualFees).toBe(0.5);
  });

  it('should keep original values when exchange returns null', async () => {
    mockGetOrderEntryFee.mockResolvedValueOnce(null);

    const result = await fetchMissingEntryFee(
      createMockWallet(),
      createMockExecution(),
      {
        actualEntryFee: 0,
        actualExitFee: 0.5,
        actualExitPrice: 51000,
        accumulatedFunding: 0,
        entryPrice: 50000,
        quantity: 0.1,
      }
    );

    expect(result.actualEntryFee).toBe(0);
  });
});
