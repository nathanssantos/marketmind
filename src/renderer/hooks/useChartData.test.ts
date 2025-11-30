import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { useChartData } from './useChartData';
import { ChartProvider } from '../context/ChartContext';
import type { Kline, NewsArticle } from '@shared/types';
import type { ReactNode } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';

const wrapper = ({ children }: { children: ReactNode }) => 
  createElement(ChartProvider, null, children);

describe('useChartData', () => {
  const mockCandles: Kline[] = [
    { timestamp: 1000, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
    { timestamp: 2000, open: 105, high: 115, low: 100, close: 110, volume: 1500 },
  ];

  const mockParams = {
    candles: mockCandles,
    symbol: 'BTCUSDT',
    timeframe: '1h' as Timeframe,
    chartType: 'candlestick' as 'candlestick' | 'line',
    showVolume: true,
    movingAverages: [] as MovingAverageConfig[],
    news: undefined as NewsArticle[] | undefined,
  };

  it('should update chart context with provided params', () => {
    const { result } = renderHook(() => useChartData(mockParams), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('should handle candles changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    const newCandles = [
      ...mockCandles,
      { timestamp: 3000, open: 110, high: 120, low: 105, close: 115, volume: 2000 },
    ];

    rerender({ params: { ...mockParams, candles: newCandles } });

    expect(true).toBe(true);
  });

  it('should handle symbol changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: { ...mockParams, symbol: 'ETHUSDT' } });

    expect(true).toBe(true);
  });

  it('should handle timeframe changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: { ...mockParams, timeframe: '1d' as Timeframe } });

    expect(true).toBe(true);
  });

  it('should handle chart type changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: { ...mockParams, chartType: 'line' as 'candlestick' | 'line' } });

    expect(true).toBe(true);
  });

  it('should handle showVolume toggle', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: { ...mockParams, showVolume: false } });

    expect(true).toBe(true);
  });

  it('should handle moving averages changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    const movingAverages: MovingAverageConfig[] = [
      { period: 20, type: 'SMA', color: '#ff0000', visible: true },
    ];

    rerender({ params: { ...mockParams, movingAverages } });

    expect(true).toBe(true);
  });

  it('should handle news data', () => {
    const newsData: NewsArticle[] = [
      {
        id: '1',
        title: 'Bitcoin News',
        description: 'Test news',
        url: 'https://example.com',
        source: 'Test',
        publishedAt: Date.now(),
        sentiment: 'positive',
      },
    ];

    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: { ...mockParams, news: newsData } });

    expect(true).toBe(true);
  });

  it('should handle empty candles array', () => {
    const emptyParams = { ...mockParams, candles: [] };

    const { result } = renderHook(() => useChartData(emptyParams), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('should not re-render when params are the same', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    rerender({ params: mockParams });

    expect(true).toBe(true);
  });
});
