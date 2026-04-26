import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useActiveWalletMock = vi.fn();
const useQuickTradeStoreMock = vi.fn();
const getSymbolLeverageQueryMock = vi.fn();

vi.mock('./useActiveWallet', () => ({
  useActiveWallet: () => useActiveWalletMock(),
}));

vi.mock('../store/quickTradeStore', () => ({
  useQuickTradeStore: (selector: (state: { sizePercent: number }) => unknown) =>
    selector({ sizePercent: useQuickTradeStoreMock() }),
}));

vi.mock('@/renderer/utils/trpc', () => ({
  trpc: {
    futuresTrading: {
      getSymbolLeverage: {
        useQuery: () => getSymbolLeverageQueryMock(),
      },
    },
  },
}));

vi.mock('@shared/utils', () => ({
  roundTradingQty: (qty: number) => qty.toFixed(4),
}));

import { useOrderQuantity } from './useOrderQuantity';

describe('useOrderQuantity', () => {
  beforeEach(() => {
    useActiveWalletMock.mockReturnValue({
      activeWallet: { id: 'w1', currentBalance: '10000' },
    });
    useQuickTradeStoreMock.mockReturnValue(10);
    getSymbolLeverageQueryMock.mockReturnValue({ data: { leverage: 5 } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('computes FUTURES quantity = (balance × leverage × pct) / price', () => {
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    // 10000 × 5 × 0.10 / 50000 = 0.1
    expect(result.current.getQuantity(50_000)).toBe('0.1000');
    expect(result.current.leverage).toBe(5);
    expect(result.current.balance).toBe(10_000);
    expect(result.current.sizePercent).toBe(10);
  });

  it('SPOT quantity ignores leverage (always 1×)', () => {
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'SPOT'));
    // 10000 × 1 × 0.10 / 50000 = 0.02
    expect(result.current.getQuantity(50_000)).toBe('0.0200');
    expect(result.current.leverage).toBe(1);
  });

  it('returns 0 quantity when balance is zero', () => {
    useActiveWalletMock.mockReturnValue({
      activeWallet: { id: 'w1', currentBalance: '0' },
    });
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    expect(result.current.getQuantity(50_000)).toBe('0.0000');
  });

  it('returns 0 quantity when price is zero or negative', () => {
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    expect(result.current.getQuantity(0)).toBe('0.0000');
    expect(result.current.getQuantity(-1)).toBe('0.0000');
  });

  it('falls back to leverage=1 when symbolLeverage query has no data', () => {
    getSymbolLeverageQueryMock.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    // 10000 × 1 × 0.10 / 50000 = 0.02
    expect(result.current.getQuantity(50_000)).toBe('0.0200');
    expect(result.current.leverage).toBe(1);
  });

  it('reflects sizePercent changes from the store', () => {
    useQuickTradeStoreMock.mockReturnValue(50);
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    // 10000 × 5 × 0.50 / 50000 = 0.5
    expect(result.current.getQuantity(50_000)).toBe('0.5000');
    expect(result.current.sizePercent).toBe(50);
  });

  it('handles missing wallet gracefully (balance=0)', () => {
    useActiveWalletMock.mockReturnValue({ activeWallet: null });
    const { result } = renderHook(() => useOrderQuantity('BTCUSDT', 'FUTURES'));
    expect(result.current.getQuantity(50_000)).toBe('0.0000');
    expect(result.current.balance).toBe(0);
  });
});
