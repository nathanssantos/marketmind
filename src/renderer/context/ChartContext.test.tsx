import { act, renderHook } from '@testing-library/react';
import type { Kline } from '@shared/types';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ChartProvider, useChartContext } from './ChartContext';

describe('ChartContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChartProvider>{children}</ChartProvider>
  );

  it('should provide chart context', () => {
    const { result } = renderHook(() => useChartContext(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.chartData).toBeNull();
    expect(result.current.setChartData).toBeDefined();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useChartContext());
    }).toThrow('useChartContext must be used within ChartProvider');
  });

  it('should update chart data', () => {
    const { result } = renderHook(() => useChartContext(), { wrapper });

    const testData = {
      candles: [
        {
          timestamp: Date.now(),
          open: 100,
          high: 110,
          low: 90,
          close: 105,
          volume: 1000,
        } as Candle,
      ],
      symbol: 'BTCUSDT',
      timeframe: '1h' as const,
      chartType: 'candlestick' as const,
      showVolume: true,
      movingAverages: [],
    };

    act(() => {
      result.current.setChartData(testData);
    });

    expect(result.current.chartData).toEqual(testData);
  });

  it('should maintain state across renders', () => {
    const { result, rerender } = renderHook(() => useChartContext(), { wrapper });

    const testData = {
      candles: [],
      symbol: 'ETHUSDT',
      timeframe: '4h' as const,
      chartType: 'line' as const,
      showVolume: false,
      movingAverages: [],
    };

    act(() => {
      result.current.setChartData(testData);
    });

    rerender();

    expect(result.current.chartData).toEqual(testData);
  });
});
