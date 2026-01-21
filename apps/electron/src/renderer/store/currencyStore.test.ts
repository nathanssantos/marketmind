import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { convertUsdtToBrl, useCurrencyStore } from './currencyStore';

describe('currencyStore', () => {
  describe('convertUsdtToBrl', () => {
    it('should convert USDT to BRL correctly', () => {
      expect(convertUsdtToBrl(100, 5.5)).toBe(550);
    });

    it('should handle zero values', () => {
      expect(convertUsdtToBrl(0, 5.5)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(convertUsdtToBrl(-100, 5.5)).toBe(-550);
    });
  });

  describe('useCurrencyStore', () => {
    it('should have default values', () => {
      const { result } = renderHook(() => useCurrencyStore());

      expect(result.current.usdtBrlRate).toBe(6.0);
      expect(result.current.showBrlValues).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should toggle showBrlValues', () => {
      const { result } = renderHook(() => useCurrencyStore());

      act(() => {
        result.current.setShowBrlValues(false);
      });

      expect(result.current.showBrlValues).toBe(false);

      act(() => {
        result.current.setShowBrlValues(true);
      });

      expect(result.current.showBrlValues).toBe(true);
    });

    it('should update rate manually', () => {
      const { result } = renderHook(() => useCurrencyStore());

      act(() => {
        result.current.setUsdtBrlRate(5.75);
      });

      expect(result.current.usdtBrlRate).toBe(5.75);
      expect(result.current.lastUpdated).not.toBeNull();
    });
  });
});
