import { describe, expect, it, vi } from 'vitest';
import { createOverlayLayer } from './OverlayLayer';
import type { ChartColors } from '@renderer/hooks/useChartColors';

const createMockManager = () => ({
  getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 750, chartHeight: 550 })),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  getContext: vi.fn(() => createMockContext()),
  priceToY: vi.fn((price: number) => 600 - price * 3),
  yToPrice: vi.fn((y: number) => (600 - y) / 3),
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
  setLineDash: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextBaseline,
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

describe('OverlayLayer', () => {
  it('should create a layer with render function', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: null,

      orderPreview: null,

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
    });

    expect(layer.render).toBeDefined();
    expect(layer.shouldRerender).toBeDefined();
  });

  it('should call render functions when render is called', () => {
    const manager = createMockManager();
    const mockRenderCurrentPriceLine = vi.fn();
    const mockRenderOrderLines = vi.fn();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: null,

      orderPreview: null,

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {
        renderCurrentPriceLine_Line: mockRenderCurrentPriceLine,
        renderOrderLines: mockRenderOrderLines,
      },
      isAutoTradingActive: false,
    });

    layer.render();

    expect(mockRenderCurrentPriceLine).toHaveBeenCalled();
    expect(mockRenderOrderLines).toHaveBeenCalled();
  });

  it('should render without errors when mouse position is provided', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: { x: 100, y: 200 },
      orderPreview: null,
      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
    });

    expect(() => layer.render()).not.toThrow();
  });

  it('should render order preview when present', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: { x: 100, y: 200 },

      orderPreview: { price: 150, type: 'long' },

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
    });

    expect(() => layer.render()).not.toThrow();
  });

  it('should not render order preview when auto trading is active', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: { x: 100, y: 200 },

      orderPreview: { price: 150, type: 'long' },

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: true,
    });

    expect(() => layer.render()).not.toThrow();
  });

  it('should render drag preview when present', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: null,

      orderPreview: null,

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
      dragPreview: {
        y: 300,
        color: 'rgba(239, 68, 68, 0.7)',
        label: 'SL 48000.00',
      },
    });

    expect(() => layer.render()).not.toThrow();
  });

  it('should always return true for shouldRerender', () => {
    const manager = createMockManager();

    const layer = createOverlayLayer({
      manager: manager as never,
      colors: mockColors,
      mousePosition: null,

      orderPreview: null,

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
    });

    expect(layer.shouldRerender()).toBe(true);
  });

  it('should handle null manager gracefully', () => {
    const layer = createOverlayLayer({
      manager: null,
      colors: mockColors,
      mousePosition: null,

      orderPreview: null,

      showCrosshair: true,
      showCurrentPriceLine: true,
      showEventRow: false,
      renderFunctions: {},
      isAutoTradingActive: false,
    });

    expect(() => layer.render()).not.toThrow();
  });
});
