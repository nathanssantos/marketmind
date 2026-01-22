import { describe, expect, it, vi } from 'vitest';
import { createDataLayer } from './DataLayer';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import type { Kline } from '@marketmind/types';

const createMockManager = () => ({
  getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 750, chartHeight: 550 })),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  getBounds: vi.fn(() => ({ maxIndex: 1000, minPrice: 100, maxPrice: 200, maxVolume: 1000 })),
  indexToX: vi.fn((index: number) => index * 10),
  priceToY: vi.fn((price: number) => 600 - price * 3),
});

const createMockContext = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  closePath: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  lineJoin: 'round' as CanvasLineJoin,
  globalAlpha: 1,
});

const mockColors: ChartColors = {
  background: '#1e222d',
  grid: '#2b3139',
  text: '#d1d4dc',
  textSecondary: '#787b86',
  bullish: '#26a69a',
  bearish: '#ef5350',
  volume: '#787b86',
  crosshair: '#9598a1',
  highlighted: '#ffeb3b',
  line: '#2962ff',
  watermark: '#787b86',
  currentPrice: '#ffffff',
};

const createMockKlines = (count: number): Kline[] => {
  return Array.from({ length: count }, (_, i) => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    openTime: Date.now() + i * 3600000,
    closeTime: Date.now() + (i + 1) * 3600000,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 100,
    quoteVolume: 100000 + i * 10000,
    trades: 100,
    takerBuyBaseVolume: 500,
    takerBuyQuoteVolume: 50000,
  }));
};

describe('DataLayer', () => {
  it('should create a layer with render function', () => {
    const manager = createMockManager();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'kline',
      showVolume: true,
    });

    expect(layer.render).toBeDefined();
    expect(layer.shouldRerender).toBeDefined();
  });

  it('should render klines when chartType is kline', () => {
    const manager = createMockManager();
    const ctx = createMockContext();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'kline',
      showVolume: false,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
  });

  it('should render line chart when chartType is line', () => {
    const manager = createMockManager();
    const ctx = createMockContext();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'line',
      showVolume: false,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.createLinearGradient).toHaveBeenCalled();
  });

  it('should render volume when showVolume is true', () => {
    const manager = createMockManager();
    const ctx = createMockContext();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'kline',
      showVolume: true,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('should use highlighted color for highlighted candles', () => {
    const manager = createMockManager();
    const ctx = createMockContext();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };
    const highlightedCandles = new Set([2, 5]);

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'kline',
      showVolume: false,
      highlightedCandles,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.save).toHaveBeenCalled();
  });

  it('should detect rerender needed when klines change', () => {
    const manager = createMockManager();
    const klines1 = createMockKlines(10);
    const klines2 = createMockKlines(15);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines: klines1,
      viewport,
      chartType: 'kline',
      showVolume: true,
    });

    const prev = { manager: manager as never, colors: mockColors, klines: klines1, viewport, chartType: 'kline' as const, showVolume: true };
    const next = { manager: manager as never, colors: mockColors, klines: klines2, viewport, chartType: 'kline' as const, showVolume: true };

    expect(layer.shouldRerender(prev, next)).toBe(true);
  });

  it('should detect rerender needed when viewport changes', () => {
    const manager = createMockManager();
    const klines = createMockKlines(10);
    const viewport1 = { start: 0, end: 10, klineWidth: 10 };
    const viewport2 = { start: 5, end: 15, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines,
      viewport: viewport1,
      chartType: 'kline',
      showVolume: true,
    });

    const prev = { manager: manager as never, colors: mockColors, klines, viewport: viewport1, chartType: 'kline' as const, showVolume: true };
    const next = { manager: manager as never, colors: mockColors, klines, viewport: viewport2, chartType: 'kline' as const, showVolume: true };

    expect(layer.shouldRerender(prev, next)).toBe(true);
  });

  it('should handle null manager gracefully', () => {
    const ctx = createMockContext();
    const klines = createMockKlines(10);
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: null,
      colors: mockColors,
      klines,
      viewport,
      chartType: 'kline',
      showVolume: true,
    });

    expect(() => layer.render(ctx as unknown as CanvasRenderingContext2D)).not.toThrow();
  });

  it('should handle empty klines array', () => {
    const manager = createMockManager();
    const ctx = createMockContext();
    const viewport = { start: 0, end: 10, klineWidth: 10 };

    const layer = createDataLayer({
      manager: manager as never,
      colors: mockColors,
      klines: [],
      viewport,
      chartType: 'kline',
      showVolume: true,
    });

    expect(() => layer.render(ctx as unknown as CanvasRenderingContext2D)).not.toThrow();
  });
});
