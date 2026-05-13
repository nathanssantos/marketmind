import { beforeEach, describe, expect, it } from 'vitest';
import { useQuickTradeStore } from './quickTradeStore';

describe('quickTradeStore', () => {
  beforeEach(() => {
    useQuickTradeStore.setState({ sizePercent: 0.1, pendingPrefill: null });
  });

  it('sets and reads sizePercent', () => {
    useQuickTradeStore.getState().setSizePercent(25);
    expect(useQuickTradeStore.getState().sizePercent).toBe(25);
  });

  it('stores a pendingPrefill via prefillFromDrawing', () => {
    useQuickTradeStore.getState().prefillFromDrawing({
      side: 'BUY',
      entryPrice: '50000',
      stopLoss: '49000',
      takeProfit: '52000',
    });
    expect(useQuickTradeStore.getState().pendingPrefill).toEqual({
      side: 'BUY',
      entryPrice: '50000',
      stopLoss: '49000',
      takeProfit: '52000',
    });
  });

  it('consumePrefill returns the payload and clears it', () => {
    const payload = { side: 'SELL' as const, entryPrice: '50000', stopLoss: '51000', takeProfit: '48000' };
    useQuickTradeStore.getState().prefillFromDrawing(payload);
    const consumed = useQuickTradeStore.getState().consumePrefill();
    expect(consumed).toEqual(payload);
    expect(useQuickTradeStore.getState().pendingPrefill).toBeNull();
    // Second call returns null — single-use semantics.
    expect(useQuickTradeStore.getState().consumePrefill()).toBeNull();
  });

  it('consumePrefill returns null when nothing is pending', () => {
    expect(useQuickTradeStore.getState().consumePrefill()).toBeNull();
  });
});
