import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVortexWorker } from './useVortexWorker';

describe('useVortexWorker', () => {
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '100', close: '105', volume: '1100', quoteVolume: '115500', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '57750' },
  ];

  it('should return null when disabled', () => {
    const { result } = renderHook(() => useVortexWorker(mockKlines, false));
    expect(result.current).toBeNull();
  });

  it('should return null when klines are empty', () => {
    const { result } = renderHook(() => useVortexWorker([], true));
    expect(result.current).toBeNull();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useVortexWorker(mockKlines, true))).not.toThrow();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useVortexWorker(mockKlines, true));
    expect(() => unmount()).not.toThrow();
  });

  it('should handle re-render with new klines', () => {
    const { rerender } = renderHook(({ klines }) => useVortexWorker(klines, true), {
      initialProps: { klines: mockKlines },
    });
    const newKlines = [...mockKlines, { openTime: 3000, closeTime: 4000, open: '105', high: '110', low: '103', close: '108', volume: '1200', quoteVolume: '129600', trades: 120, takerBuyBaseVolume: '600', takerBuyQuoteVolume: '64800' }];
    expect(() => rerender({ klines: newKlines })).not.toThrow();
  });

  it('should handle toggle from disabled to enabled', () => {
    const { rerender } = renderHook(({ enabled }) => useVortexWorker(mockKlines, enabled), {
      initialProps: { enabled: false },
    });
    expect(() => rerender({ enabled: true })).not.toThrow();
  });

  it('should accept custom period', () => {
    expect(() => renderHook(() => useVortexWorker(mockKlines, true, 14))).not.toThrow();
  });
});
