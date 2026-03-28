import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMovingAverageWorker } from './useMovingAverageWorker';
import type { Kline } from '@marketmind/types';
import type { MovingAverageConfig } from './useMovingAverageWorker';

const createMockKline = (overrides: Partial<Kline> = {}): Kline => ({
  openTime: 1000,
  closeTime: 2000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 1000,
  quoteVolume: 100000,
  trades: 100,
  takerBuyBaseVolume: 500,
  takerBuyQuoteVolume: 50000,
  ...overrides,
});

describe('useMovingAverageWorker', () => {
  const mockKlines = [
    createMockKline({ openTime: 1000, close: 100 }),
    createMockKline({ openTime: 2000, close: 105 }),
    createMockKline({ openTime: 3000, close: 110 }),
  ];

  const mockConfigs: MovingAverageConfig[] = [
    { period: 20, type: 'SMA', color: '#ff0000', enabled: true },
    { period: 50, type: 'EMA', color: '#00ff00', enabled: true },
  ];

  it('should return null when disabled', () => {
    const { result } = renderHook(() => useMovingAverageWorker(mockKlines, mockConfigs, false));
    expect(result.current).toBeNull();
  });

  it('should return null when klines are empty', () => {
    const { result } = renderHook(() => useMovingAverageWorker([], mockConfigs, true));
    expect(result.current).toBeNull();
  });

  it('should return null when configs are empty', () => {
    const { result } = renderHook(() => useMovingAverageWorker(mockKlines, [], true));
    expect(result.current).toBeNull();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useMovingAverageWorker(mockKlines, mockConfigs, true))).not.toThrow();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useMovingAverageWorker(mockKlines, mockConfigs, true));
    expect(() => unmount()).not.toThrow();
  });

  it('should handle re-render with new klines', () => {
    const { rerender } = renderHook(
      ({ klines }) => useMovingAverageWorker(klines, mockConfigs, true),
      { initialProps: { klines: mockKlines } },
    );
    const newKlines = [...mockKlines, createMockKline({ openTime: 4000, close: 108 })];
    expect(() => rerender({ klines: newKlines })).not.toThrow();
  });

  it('should handle re-render with new configs', () => {
    const { rerender } = renderHook(
      ({ configs }) => useMovingAverageWorker(mockKlines, configs, true),
      { initialProps: { configs: mockConfigs } },
    );
    const newConfigs = [...mockConfigs, { period: 200, type: 'SMA' as const, color: '#0000ff', enabled: true }];
    expect(() => rerender({ configs: newConfigs })).not.toThrow();
  });

  it('should handle toggle from disabled to enabled', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useMovingAverageWorker(mockKlines, mockConfigs, enabled),
      { initialProps: { enabled: false } },
    );
    expect(() => rerender({ enabled: true })).not.toThrow();
  });

  it('should return null when toggled from enabled to disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useMovingAverageWorker(mockKlines, mockConfigs, enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current).toBeNull();
  });

  it('should handle single config', () => {
    const singleConfig = [mockConfigs[0]];
    expect(() => renderHook(() => useMovingAverageWorker(mockKlines, singleConfig, true))).not.toThrow();
  });
});
