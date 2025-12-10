import type { Trade } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTradeVisualization } from './useTradeVisualization';

describe('useTradeVisualization', () => {
  const viewport = {
    start: 0,
    end: 100,
    minPrice: 50000,
    maxPrice: 60000,
  };

  const canvasWidth = 800;
  const canvasHeight = 600;

  const sampleTrades: Trade[] = [
    {
      id: '1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.1,
      entryPrice: 55000,
      entryTime: 50,
      exitPrice: 56000,
      exitTime: 60,
      stopLoss: 54000,
      takeProfit: 57000,
      status: 'CLOSED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.1,
      entryPrice: 56000,
      entryTime: 70,
      exitPrice: 55000,
      exitTime: 80,
      stopLoss: 55000,
      takeProfit: 58000,
      status: 'CLOSED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('should generate markers for all trades', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.markers.length).toBeGreaterThan(0);
  });

  it('should create entry markers', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    const entryMarkers = result.current.markers.filter((m) => m.type === 'entry');
    expect(entryMarkers.length).toBe(2);
  });

  it('should create exit markers', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    const exitMarkers = result.current.markers.filter((m) => m.type === 'exit');
    expect(exitMarkers.length).toBe(2);
  });

  it('should create stop loss markers when enabled', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
        showStopLoss: true,
      })
    );

    const slMarkers = result.current.markers.filter((m) => m.type === 'stopLoss');
    expect(slMarkers.length).toBe(2);
  });

  it('should not create stop loss markers when disabled', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
        showStopLoss: false,
      })
    );

    const slMarkers = result.current.markers.filter((m) => m.type === 'stopLoss');
    expect(slMarkers.length).toBe(0);
  });

  it('should create take profit markers when enabled', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
        showTakeProfit: true,
      })
    );

    const tpMarkers = result.current.markers.filter((m) => m.type === 'takeProfit');
    expect(tpMarkers.length).toBe(2);
  });

  it('should not create take profit markers when disabled', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
        showTakeProfit: false,
      })
    );

    const tpMarkers = result.current.markers.filter((m) => m.type === 'takeProfit');
    expect(tpMarkers.length).toBe(0);
  });

  it('should calculate profit correctly', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    const exitMarker = result.current.markers.find((m) => m.type === 'exit');
    expect(exitMarker?.profit).toBeDefined();
    expect(exitMarker?.profitPercent).toBeDefined();
  });

  it('should count profitable trades', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.profitableCount).toBe(1);
  });

  it('should count losing trades', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.losingCount).toBe(1);
  });

  it('should calculate total profit', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.totalProfit).toBe(0);
  });

  it('should filter visible markers by viewport', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.visibleMarkers.length).toBeLessThanOrEqual(
      result.current.markers.length
    );
  });

  it('should handle empty trades array', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: [],
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    expect(result.current.markers.length).toBe(0);
    expect(result.current.profitableCount).toBe(0);
    expect(result.current.losingCount).toBe(0);
    expect(result.current.totalProfit).toBe(0);
  });

  it('should calculate marker positions correctly', () => {
    const { result } = renderHook(() =>
      useTradeVisualization({
        trades: sampleTrades,
        viewport,
        canvasWidth,
        canvasHeight,
      })
    );

    const marker = result.current.markers[0];
    expect(marker.x).toBeGreaterThanOrEqual(0);
    expect(marker.x).toBeLessThanOrEqual(canvasWidth);
    expect(marker.y).toBeGreaterThanOrEqual(0);
    expect(marker.y).toBeLessThanOrEqual(canvasHeight);
  });

  it('should recalculate when viewport changes', () => {
    const { result, rerender } = renderHook(
      ({ viewport }) =>
        useTradeVisualization({
          trades: sampleTrades,
          viewport,
          canvasWidth,
          canvasHeight,
        }),
      { initialProps: { viewport } }
    );

    const initialMarkers = result.current.markers;

    rerender({
      viewport: { ...viewport, start: 10, end: 90 },
    });

    expect(result.current.markers).not.toBe(initialMarkers);
  });
});
