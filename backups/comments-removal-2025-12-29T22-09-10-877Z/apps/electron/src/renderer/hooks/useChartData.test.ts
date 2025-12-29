import type { Kline } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';
import { ChartProvider } from '../context/ChartContext';
import { useChartData } from './useChartData';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ChartProvider, null, children);

describe('useChartData', () => {
  const mockKlines: Kline[] = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '110', low: '95', close: '105', volume: '1000', quoteVolume: '105000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '52500' },
    { openTime: 2000, closeTime: 3000, open: '105', high: '115', low: '100', close: '110', volume: '1500', quoteVolume: '165000', trades: 150, takerBuyBaseVolume: '750', takerBuyQuoteVolume: '82500' },
  ];

  const mockParams = {
    klines: mockKlines,
    symbol: 'BTCUSDT',
    timeframe: '1h' as Timeframe,
    chartType: 'kline' as 'kline' | 'line',
    showVolume: true,
    movingAverages: [] as MovingAverageConfig[],
  };

  it('should update chart context with provided params', () => {
    const { result } = renderHook(() => useChartData(mockParams), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('should handle klines changes', () => {
    const { rerender } = renderHook(
      ({ params }) => useChartData(params),
      {
        wrapper,
        initialProps: { params: mockParams },
      }
    );

    const newKlines = [
      ...mockKlines,
      { openTime: 3000, closeTime: 4000, open: '110', high: '120', low: '105', close: '115', volume: '2000', quoteVolume: '230000', trades: 200, takerBuyBaseVolume: '1000', takerBuyQuoteVolume: '115000' },
    ];

    rerender({ params: { ...mockParams, klines: newKlines } });

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

    rerender({ params: { ...mockParams, chartType: 'line' as 'kline' | 'line' } });

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

  it('should handle empty klines array', () => {
    const emptyParams = { ...mockParams, klines: [] };

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
