import { describe, expect, it, vi } from 'vitest';
import { createBackgroundLayer } from './BackgroundLayer';
import type { ChartColors } from '@renderer/hooks/useChartColors';

const createMockManager = () => ({
  getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 750, chartHeight: 550 })),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  getBounds: vi.fn(() => ({ maxIndex: 1000, minPrice: 100, maxPrice: 200, maxVolume: 1000 })),
});

const createMockContext = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextBaseline,
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

describe('BackgroundLayer', () => {
  it('should create a layer with render function', () => {
    const manager = createMockManager();
    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: true,
    });

    expect(layer.render).toBeDefined();
    expect(layer.shouldRerender).toBeDefined();
  });

  it('should render grid when showGrid is true', () => {
    const manager = createMockManager();
    const ctx = createMockContext();

    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: true,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
  });

  it('should not render grid when showGrid is false', () => {
    const manager = createMockManager();
    const ctx = createMockContext();

    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: false,
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('should render watermark when symbol is provided', () => {
    const manager = createMockManager();
    const ctx = createMockContext();

    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: true,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      timeframe: '1h',
    });

    layer.render(ctx as unknown as CanvasRenderingContext2D);

    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('should detect rerender needed when showGrid changes', () => {
    const manager = createMockManager();
    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: true,
    });

    const prev = { manager: manager as never, colors: mockColors, showGrid: true };
    const next = { manager: manager as never, colors: mockColors, showGrid: false };

    expect(layer.shouldRerender(prev, next)).toBe(true);
  });

  it('should not detect rerender when props are unchanged', () => {
    const manager = createMockManager();
    const layer = createBackgroundLayer({
      manager: manager as never,
      colors: mockColors,
      showGrid: true,
    });

    const prev = { manager: manager as never, colors: mockColors, showGrid: true };
    const next = { manager: manager as never, colors: mockColors, showGrid: true };

    expect(layer.shouldRerender(prev, next)).toBe(false);
  });

  it('should handle null manager gracefully', () => {
    const ctx = createMockContext();

    const layer = createBackgroundLayer({
      manager: null,
      colors: mockColors,
      showGrid: true,
    });

    expect(() => layer.render(ctx as unknown as CanvasRenderingContext2D)).not.toThrow();
  });
});
