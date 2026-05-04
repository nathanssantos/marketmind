/**
 * Coverage for the leverage-respect contract in live-order-executor.
 *
 * Regression: previously every auto-trade entry on a FUTURES symbol
 * called `setFuturesLeverage(symbol, config.leverage ?? 1)`. When the
 * watcher's autoTradingConfig.leverage was null (the common "use
 * whatever is configured for this symbol" case), the `?? 1` fallback
 * silently RESET the user's manually-configured leverage on Binance
 * to 1x on every fill. This test pins the new behavior: when
 * config.leverage is null/undefined, setFuturesLeverage is NOT called
 * and Binance keeps whatever the user configured via the popover.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks — vi.mock() is hoisted to file top, so any factory
// that closes over module-scope variables must use vi.hoisted().
const { setFuturesLeverageMock, setFuturesMarginTypeMock, executeBinanceOrderMock } = vi.hoisted(() => ({
  setFuturesLeverageMock: vi.fn().mockResolvedValue(undefined),
  setFuturesMarginTypeMock: vi.fn().mockResolvedValue(undefined),
  executeBinanceOrderMock: vi.fn().mockResolvedValue({
    orderId: 'order-1',
    price: '50000',
    executedQty: '0.1',
    origQty: '0.1',
    status: 'FILLED',
  }),
}));

vi.mock('../../../auto-trading', () => ({
  autoTradingService: {
    setFuturesLeverage: setFuturesLeverageMock,
    setFuturesMarginType: setFuturesMarginTypeMock,
    executeBinanceOrder: executeBinanceOrderMock,
  },
}));

vi.mock('../../../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({})),
}));

vi.mock('../protection-order-handler', () => ({
  protectionOrderHandler: vi.fn().mockResolvedValue({
    stopLossOrderId: null,
    takeProfitOrderId: null,
    stopLossAlgoId: null,
    takeProfitAlgoId: null,
    stopLossIsAlgo: false,
    takeProfitIsAlgo: false,
    orderListId: null,
  }),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
}));

import { executeLiveOrder } from '../live-order-executor';

const baseWatcher = {
  id: 'w-1',
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  setupType: 'manual',
  marketType: 'FUTURES' as const,
};

const baseSetup = {
  symbol: 'BTCUSDT',
  direction: 'LONG' as const,
  entryPrice: 50_000,
  stopLoss: 48_000,
  takeProfit: 53_000,
  confidence: 1,
  setupType: 'manual',
  fibonacciProjection: null,
  triggerKlineOpenTime: 0,
  startTime: 0,
};

const baseWallet = {
  id: 'wallet-1',
  walletType: 'live' as const,
  marketType: 'FUTURES' as const,
};

const makeConfig = (overrides: Partial<{ leverage: number | null }> = {}) => ({
  walletId: 'wallet-1',
  leverage: null,
  ...overrides,
}) as never;

describe('live-order-executor — leverage respect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call setFuturesLeverage when config.leverage is null', async () => {
    await executeLiveOrder(
      baseWatcher as never,
      baseSetup as never,
      undefined,
      baseWallet as never,
      makeConfig({ leverage: null }),
      { quantity: 0.1, sizePercent: 100 },
      'exec-1',
      'setup-1',
      'MARKET',
      false,
    );

    expect(setFuturesLeverageMock).not.toHaveBeenCalled();
    // Margin type still gets set — that's a separate concern from
    // user-configured leverage.
    expect(setFuturesMarginTypeMock).toHaveBeenCalledWith(baseWallet as never, 'BTCUSDT', 'CROSSED');
  });

  it('does NOT call setFuturesLeverage when config.leverage is undefined', async () => {
    await executeLiveOrder(
      baseWatcher as never,
      baseSetup as never,
      undefined,
      baseWallet as never,
      makeConfig({ leverage: undefined as never }),
      { quantity: 0.1, sizePercent: 100 },
      'exec-1',
      'setup-1',
      'MARKET',
      false,
    );

    expect(setFuturesLeverageMock).not.toHaveBeenCalled();
  });

  it('DOES call setFuturesLeverage when config.leverage is explicitly set', async () => {
    await executeLiveOrder(
      baseWatcher as never,
      baseSetup as never,
      undefined,
      baseWallet as never,
      makeConfig({ leverage: 10 }),
      { quantity: 0.1, sizePercent: 100 },
      'exec-1',
      'setup-1',
      'MARKET',
      false,
    );

    expect(setFuturesLeverageMock).toHaveBeenCalledWith(baseWallet as never, 'BTCUSDT', 10);
  });

  it('DOES call setFuturesLeverage with 1 when config.leverage is explicitly 1 (intentional 1x watcher)', async () => {
    // Edge case: user explicitly wanted leverage=1 on this auto-trader.
    // We respect the literal value — only null/undefined is "fall back
    // to user's symbol leverage".
    await executeLiveOrder(
      baseWatcher as never,
      baseSetup as never,
      undefined,
      baseWallet as never,
      makeConfig({ leverage: 1 }),
      { quantity: 0.1, sizePercent: 100 },
      'exec-1',
      'setup-1',
      'MARKET',
      false,
    );

    expect(setFuturesLeverageMock).toHaveBeenCalledWith(baseWallet as never, 'BTCUSDT', 1);
  });

  it('does not call setFuturesLeverage for SPOT watchers regardless of config', async () => {
    await executeLiveOrder(
      { ...baseWatcher, marketType: 'SPOT' } as never,
      baseSetup as never,
      undefined,
      { ...baseWallet, marketType: 'SPOT' } as never,
      makeConfig({ leverage: 10 }),
      { quantity: 0.1, sizePercent: 100 },
      'exec-1',
      'setup-1',
      'MARKET',
      false,
    );

    expect(setFuturesLeverageMock).not.toHaveBeenCalled();
    expect(setFuturesMarginTypeMock).not.toHaveBeenCalled();
  });
});
