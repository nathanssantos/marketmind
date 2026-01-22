import { describe, expect, it, vi } from 'vitest';
import { createIndicatorLayer, getIndicatorRenderOrder } from './IndicatorLayer';
import type { ChartColors } from '@renderer/hooks/useChartColors';

const createMockManager = () => ({
  getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 750, chartHeight: 550 })),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
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

describe('IndicatorLayer', () => {
  it('should create a layer with render function', () => {
    const manager = createMockManager();
    const renderFunctions = {};

    const layer = createIndicatorLayer({
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions,
      showStochastic: false,
      showRSI: false,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    });

    expect(layer.render).toBeDefined();
    expect(layer.shouldRerender).toBeDefined();
  });

  it('should call render functions when render is called', () => {
    const manager = createMockManager();
    const mockRenderMA = vi.fn();
    const mockRenderRSI = vi.fn();
    const renderFunctions = {
      renderMovingAverages: mockRenderMA,
      renderRSI: mockRenderRSI,
    };

    const layer = createIndicatorLayer({
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions,
      showStochastic: false,
      showRSI: true,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    });

    layer.render();

    expect(mockRenderMA).toHaveBeenCalled();
    expect(mockRenderRSI).toHaveBeenCalled();
  });

  it('should detect rerender needed when activeIndicators change', () => {
    const manager = createMockManager();
    const renderFunctions = {};

    const layer = createIndicatorLayer({
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: ['RSI'],
      renderFunctions,
      showStochastic: false,
      showRSI: true,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    });

    const prev = {
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: ['RSI'],
      renderFunctions,
      showStochastic: false,
      showRSI: true,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    };
    const next = {
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: ['RSI', 'MACD'],
      renderFunctions,
      showStochastic: false,
      showRSI: true,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    };

    expect(layer.shouldRerender(prev, next)).toBe(true);
  });

  it('should detect rerender needed when showStochastic changes', () => {
    const manager = createMockManager();
    const renderFunctions = {};

    const layer = createIndicatorLayer({
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions,
      showStochastic: false,
      showRSI: false,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    });

    const prev = {
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions,
      showStochastic: false,
      showRSI: false,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    };
    const next = {
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions,
      showStochastic: true,
      showRSI: false,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    };

    expect(layer.shouldRerender(prev, next)).toBe(true);
  });

  it('should handle empty render functions', () => {
    const manager = createMockManager();

    const layer = createIndicatorLayer({
      manager: manager as never,
      colors: mockColors,
      movingAverages: [],
      activeIndicators: [],
      renderFunctions: {},
      showStochastic: false,
      showRSI: false,
      showBollingerBands: false,
      showATR: false,
      showVWAP: false,
      showFibonacciProjection: false,
    });

    expect(() => layer.render()).not.toThrow();
  });
});

describe('getIndicatorRenderOrder', () => {
  it('should return overlay and panel indicators', () => {
    const order = getIndicatorRenderOrder();

    expect(order.overlays).toBeDefined();
    expect(order.panels).toBeDefined();
    expect(order.overlays.length).toBeGreaterThan(0);
    expect(order.panels.length).toBeGreaterThan(0);
  });

  it('should include renderMovingAverages in overlays', () => {
    const order = getIndicatorRenderOrder();
    expect(order.overlays).toContain('renderMovingAverages');
  });

  it('should include renderRSI in panels', () => {
    const order = getIndicatorRenderOrder();
    expect(order.panels).toContain('renderRSI');
  });
});
