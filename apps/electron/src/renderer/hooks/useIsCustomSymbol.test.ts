import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useBackendCustomSymbolsMock = vi.fn();

vi.mock('./useBackendCustomSymbols', () => ({
  useBackendCustomSymbols: () => useBackendCustomSymbolsMock(),
}));

import { useIsCustomSymbol } from './useIsCustomSymbol';

describe('useIsCustomSymbol', () => {
  beforeEach(() => {
    useBackendCustomSymbolsMock.mockReturnValue({
      customSymbols: {
        data: [
          { id: 1, symbol: 'POLITIFI' },
          { id: 2, symbol: 'MAGNIFICENT7' },
        ],
      },
    });
  });

  it('returns true for a symbol present in the custom-symbols list', () => {
    const { result } = renderHook(() => useIsCustomSymbol('POLITIFI'));
    expect(result.current).toBe(true);
  });

  it('case-insensitive match (renderer sometimes lowercases for room joins)', () => {
    const { result } = renderHook(() => useIsCustomSymbol('politifi'));
    expect(result.current).toBe(true);
  });

  it('returns false for real exchange symbols', () => {
    const { result } = renderHook(() => useIsCustomSymbol('BTCUSDT'));
    expect(result.current).toBe(false);
  });

  it('returns false when the symbol arg is undefined (no active tab)', () => {
    const { result } = renderHook(() => useIsCustomSymbol(undefined));
    expect(result.current).toBe(false);
  });

  it('returns false when the custom-symbols list hasnt loaded yet', () => {
    useBackendCustomSymbolsMock.mockReturnValue({ customSymbols: { data: undefined } });
    const { result } = renderHook(() => useIsCustomSymbol('POLITIFI'));
    expect(result.current).toBe(false);
  });
});
