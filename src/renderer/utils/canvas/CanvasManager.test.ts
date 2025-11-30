/* eslint-disable no-undef */
import { CHART_CONFIG } from '@shared/constants';
import type { Kline, Viewport } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasManager } from './CanvasManager';

vi.mock('./drawingUtils', () => ({
  clearCanvas: vi.fn(),
  setupCanvas: vi.fn((_canvas: HTMLCanvasElement) => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'top' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;
    
    return ctx;
  }),
}));

describe('CanvasManager', () => {
  let canvas: HTMLCanvasElement;
  let viewport: Viewport;
  let manager: CanvasManager;
  let mockCandles: Kline[];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600 }),
      writable: true,
    });
    
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600 }),
      writable: true,
    });
    parent.appendChild(canvas);

    viewport = {
      start: 0,
      end: 100,
      candleWidth: 8,
      candleSpacing: 2,
    };

    mockCandles = Array.from({ length: 200 }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: 100 + Math.random() * 10,
      high: 105 + Math.random() * 10,
      low: 95 + Math.random() * 10,
      close: 100 + Math.random() * 10,
      volume: 1000 + Math.random() * 1000,
    }));

    manager = new CanvasManager(canvas, viewport);
  });

  describe('initialization', () => {
    it('should initialize with canvas and viewport', () => {
      expect(manager.getViewport()).toEqual(viewport);
      expect(manager.getContext()).not.toBeNull();
    });

    it('should have dimensions after initialization', () => {
      const dimensions = manager.getDimensions();
      
      expect(dimensions).not.toBeNull();
      expect(dimensions?.width).toBe(800);
      expect(dimensions?.height).toBe(600);
    });
  });

  describe('candles management', () => {
    it('should set and get candles', () => {
      manager.setCandles(mockCandles);
      
      expect(manager.getCandles()).toEqual(mockCandles);
      expect(manager.getBounds()).not.toBeNull();
    });

    it('should have null bounds with no candles', () => {
      manager.setCandles([]);
      
      expect(manager.getBounds()).toBeNull();
    });
  });

  describe('viewport management', () => {
    it('should update viewport', () => {
      manager.setCandles(mockCandles);
      const newViewport = { ...viewport, start: 10, end: 110 };
      manager.setViewport(newViewport);
      
      const updated = manager.getViewport();
      expect(updated.start).toBeGreaterThanOrEqual(0);
      expect(updated.end).toBeLessThanOrEqual(mockCandles.length);
    });

    it('should clamp viewport to candle range', () => {
      manager.setCandles(mockCandles);
      
      const invalidViewport = { ...viewport, start: -10, end: 250 };
      manager.setViewport(invalidViewport);
      
      const clamped = manager.getViewport();
      expect(clamped.start).toBeGreaterThanOrEqual(0);
      expect(clamped.end).toBeLessThanOrEqual(mockCandles.length);
    });
  });

  describe('coordinate conversion', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should convert price to y coordinate', () => {
      const y = manager.priceToY(100);
      
      expect(typeof y).toBe('number');
    });

    it('should convert y to price', () => {
      const price = manager.yToPrice(300);
      
      expect(typeof price).toBe('number');
    });

    it('should convert volume to height', () => {
      const height = manager.volumeToHeight(1000);
      
      expect(typeof height).toBe('number');
      expect(height).toBeGreaterThanOrEqual(0);
    });

    it('should convert index to x coordinate', () => {
      const x = manager.indexToX(50);
      
      expect(typeof x).toBe('number');
    });

    it('should convert x to index', () => {
      const index = manager.xToIndex(400);
      
      expect(typeof index).toBe('number');
    });

    it('should handle coordinate conversion with no dimensions', () => {
      const emptyManager = new CanvasManager(canvas, viewport);
      
      expect(emptyManager.priceToY(100)).toBe(0);
      expect(emptyManager.yToPrice(100)).toBe(0);
      expect(emptyManager.volumeToHeight(1000)).toBe(0);
      expect(typeof emptyManager.indexToX(50)).toBe('number');
      expect(typeof emptyManager.xToIndex(400)).toBe('number');
    });
  });

  describe('visible candles', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should return visible candles within viewport', () => {
      manager.setViewport({ ...viewport, start: 0, end: 50 });
      const visible = manager.getVisibleCandles();
      
      expect(visible.length).toBeLessThanOrEqual(50);
    });

    it('should handle viewport exceeding candle length', () => {
      manager.setViewport({ ...viewport, start: 150, end: 250 });
      const visible = manager.getVisibleCandles();
      
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThanOrEqual(mockCandles.length);
    });

    it('should return empty array when no candles', () => {
      manager.setCandles([]);
      const visible = manager.getVisibleCandles();
      
      expect(visible).toEqual([]);
    });
  });

  describe('zoom', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should zoom in when delta is positive', () => {
      const initialRange = viewport.end - viewport.start;
      manager.zoom(1);
      
      const newRange = manager.getViewport().end - manager.getViewport().start;
      expect(newRange).toBeLessThan(initialRange);
    });

    it('should zoom out when delta is negative', () => {
      const initialRange = viewport.end - viewport.start;
      manager.zoom(-1);
      
      const newRange = manager.getViewport().end - manager.getViewport().start;
      expect(newRange).toBeGreaterThan(initialRange);
    });

    it('should zoom around center point', () => {
      manager.zoom(1, 400);
      
      const newViewport = manager.getViewport();
      expect(newViewport.start).toBeGreaterThanOrEqual(0);
      expect(newViewport.end).toBeLessThanOrEqual(mockCandles.length);
    });

    it('should update candle width after zoom', () => {
      manager.zoom(2);
      
      const newWidth = manager.getViewport().candleWidth;
      expect(newWidth).toBeGreaterThanOrEqual(CHART_CONFIG.MIN_CANDLE_WIDTH);
      expect(newWidth).toBeLessThanOrEqual(CHART_CONFIG.MAX_CANDLE_WIDTH);
    });

    it('should trigger render callback on zoom', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.zoom(1);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('pan', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should pan left when deltaX is positive', () => {
      manager.setViewport({ ...viewport, start: 50, end: 150 });
      const initialStart = manager.getViewport().start;
      manager.pan(10);
      
      const newStart = manager.getViewport().start;
      expect(newStart).not.toBe(initialStart);
    });

    it('should pan right when deltaX is negative', () => {
      manager.setViewport({ ...viewport, start: 50, end: 150 });
      const initialStart = manager.getViewport().start;
      manager.pan(-10);
      
      const newStart = manager.getViewport().start;
      expect(newStart).not.toBe(initialStart);
    });

    it('should clamp pan to valid range', () => {
      manager.pan(10000);
      
      expect(manager.getViewport().start).toBeGreaterThanOrEqual(0);
    });

    it('should trigger render callback on pan', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.pan(50);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('vertical pan and zoom', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should pan vertically', () => {
      const initialBounds = manager.getBounds();
      manager.panVertical(50);
      
      const newBounds = manager.getBounds();
      expect(newBounds?.minPrice).not.toBe(initialBounds?.minPrice);
    });

    it('should zoom vertically', () => {
      manager.zoomVertical(10);
      
      expect(manager.getBounds()).not.toBeNull();
    });

    it('should clamp vertical zoom scale', () => {
      manager.zoomVertical(1000);
      manager.zoomVertical(-1000);
      
      expect(manager.getBounds()).not.toBeNull();
    });

    it('should trigger render on vertical pan', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.panVertical(50);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });

    it('should trigger render on vertical zoom', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.zoomVertical(10);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('candle at position', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should get candle at x position', () => {
      const candle = manager.getCandleAtX(400);
      
      expect(candle).toBeDefined();
    });

    it('should return null for invalid position', () => {
      const candle = manager.getCandleAtX(10000);
      
      expect(candle).toBeNull();
    });
  });

  describe('right margin', () => {
    it('should set right margin', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.setRightMargin(100);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('clear and resize', () => {
    it('should clear canvas', () => {
      manager.clear();
      
      expect(true).toBe(true);
    });

    it('should resize canvas', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.resize();
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('render callback', () => {
    it('should set and trigger render callback', async () => {
      const callback = vi.fn();
      
      manager.setRenderCallback(callback);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });

    it('should clear render callback', () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.setRenderCallback(null);
      manager.zoom(1);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getPadding', () => {
    it('should return padding value', () => {
      expect(manager.getPadding()).toBe(40);
    });

    it('should use custom padding', () => {
      const customManager = new CanvasManager(canvas, viewport, 50);
      
      expect(customManager.getPadding()).toBe(50);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      manager.setCandles(mockCandles);
      manager.setRenderCallback(vi.fn());
      
      manager.destroy();
      
      expect(manager.getCandles()).toEqual([]);
      expect(manager.getBounds()).toBeNull();
      expect(manager.getDimensions()).toBeNull();
    });

    it('should cancel animation frame if running', () => {
      const spy = vi.spyOn(global, 'cancelAnimationFrame');
      manager['animationFrameId'] = 123;
      manager['isAnimating'] = true;
      
      manager.destroy();
      
      expect(spy).toHaveBeenCalledWith(123);
      expect(manager['animationFrameId']).toBeNull();
      expect(manager['isAnimating']).toBe(false);
      
      spy.mockRestore();
    });
  });

  describe('resetVerticalZoom', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
    });

    it('should reset price offset and scale', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager['priceOffset'] = 100;
      manager['priceScale'] = 2;
      
      manager.resetVerticalZoom();
      
      expect(manager['priceOffset']).toBe(0);
      expect(manager['priceScale']).toBe(1);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('resetToInitialView', () => {
    it('should reset to initial candle count', async () => {
      manager.setCandles(mockCandles);
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.pan(50);
      manager.resetToInitialView();
      
      const viewport = manager.getViewport();
      expect(viewport.end).toBe(mockCandles.length);
      
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('panToNextCandle', () => {
    beforeEach(() => {
      manager.setCandles(mockCandles);
      manager.setViewport({ ...viewport, start: 0, end: 50 });
    });

    it('should pan forward by one candle', () => {
      const initialStart = manager.getViewport().start;
      manager.panToNextCandle();
      
      const newStart = manager.getViewport().start;
      expect(newStart).toBe(initialStart + 1);
    });

    it('should not pan beyond candle length', () => {
      manager.setViewport({ ...viewport, start: mockCandles.length - 50, end: mockCandles.length });
      manager.panToNextCandle();
      
      const currentViewport = manager.getViewport();
      expect(currentViewport.end).toBe(mockCandles.length);
    });

    it('should do nothing with empty candles', () => {
      manager.setCandles([]);
      const initialViewport = manager.getViewport();
      
      manager.panToNextCandle();
      
      expect(manager.getViewport()).toEqual(initialViewport);
    });
  });
});
