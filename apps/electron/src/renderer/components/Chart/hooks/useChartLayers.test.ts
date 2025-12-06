import type { Kline, Viewport } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChartLayers } from './useChartLayers';

const mockKlines: Kline[] = [];

const mockViewport: Viewport = {
  start: 0,
  end: 100,
  priceMin: 90,
  priceMax: 110,
  width: 800,
  height: 600,
};

const mockTheme = {
  grid: '#333',
  text: '#fff',
  bullish: '#10b981',
  bearish: '#ef4444',
  background: '#1e222d',
  crosshair: '#666',
};

describe('useChartLayers', () => {
  it('should create basic layers', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
      })
    );

    expect(result.current).toHaveLength(2);
    expect(result.current[0].id).toBe('grid');
    expect(result.current[1].id).toBe('klines');
  });

  it('should include grid layer when showGrid is true', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showGrid: true,
      })
    );

    const gridLayer = result.current.find((l) => l.id === 'grid');
    expect(gridLayer).toBeDefined();
  });

  it('should exclude grid layer when showGrid is false', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showGrid: false,
      })
    );

    const gridLayer = result.current.find((l) => l.id === 'grid');
    expect(gridLayer).toBeUndefined();
  });

  it('should include indicators layer when showIndicators is true with MAs', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showIndicators: true,
        movingAverages: [
          { period: 20, color: '#3b82f6', type: 'SMA' },
        ],
      })
    );

    const indicatorsLayer = result.current.find((l) => l.id === 'indicators');
    expect(indicatorsLayer).toBeDefined();
  });

  it('should exclude indicators layer when no moving averages', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showIndicators: true,
        movingAverages: [],
      })
    );

    const indicatorsLayer = result.current.find((l) => l.id === 'indicators');
    expect(indicatorsLayer).toBeUndefined();
  });

  it('should include crosshair layer when showCrosshair is true', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showCrosshair: true,
        mousePosition: { x: 100, y: 100 },
      })
    );

    const crosshairLayer = result.current.find((l) => l.id === 'interaction');
    expect(crosshairLayer).toBeDefined();
  });

  it('should order layers by z-index', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showGrid: true,
        showIndicators: true,
        showCrosshair: true,
        movingAverages: [{ period: 20, color: '#3b82f6' }],
      })
    );

    for (let i = 1; i < result.current.length; i++) {
      expect(result.current[i].zIndex).toBeGreaterThanOrEqual(
        result.current[i - 1].zIndex
      );
    }
  });

  it('should update layers when config changes', () => {
    const { result, rerender } = renderHook(
      ({ showGrid }) =>
        useChartLayers({
          klines: mockKlines,
          viewport: mockViewport,
          theme: mockTheme,
          showGrid,
        }),
      {
        initialProps: { showGrid: true },
      }
    );

    expect(result.current.find((l) => l.id === 'grid')).toBeDefined();

    rerender({ showGrid: false });

    expect(result.current.find((l) => l.id === 'grid')).toBeUndefined();
  });

  it('should set correct update frequencies', () => {
    const { result } = renderHook(() =>
      useChartLayers({
        klines: mockKlines,
        viewport: mockViewport,
        theme: mockTheme,
        showGrid: true,
        showCrosshair: true,
      })
    );

    const gridLayer = result.current.find((l) => l.id === 'grid');
    const klinesLayer = result.current.find((l) => l.id === 'klines');
    const interactionLayer = result.current.find((l) => l.id === 'interaction');

    expect(gridLayer?.updateFrequency).toBe('static');
    expect(klinesLayer?.updateFrequency).toBe('medium');
    expect(interactionLayer?.updateFrequency).toBe('high');
  });
});
