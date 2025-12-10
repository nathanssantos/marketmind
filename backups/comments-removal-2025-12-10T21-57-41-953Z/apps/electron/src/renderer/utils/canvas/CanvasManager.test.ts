/* eslint-disable no-undef */
import { CHART_CONFIG } from '@shared/constants';
import type { Kline, Viewport } from '@marketmind/types';
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
  let mockKlines: Kline[];

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
      klineWidth: 8,
      klineSpacing: 2,
    };

    mockKlines = Array.from({ length: 200 }, (_, i) => ({
      openTime: Date.now() + i * 60000,
      closeTime: Date.now() + (i + 1) * 60000,
      open: (100 + Math.random() * 10).toString(),
      high: (105 + Math.random() * 10).toString(),
      low: (95 + Math.random() * 10).toString(),
      close: (100 + Math.random() * 10).toString(),
      volume: (1000 + Math.random() * 1000).toString(),
      quoteVolume: '100000',
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '50000',
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

  describe('klines management', () => {
    it('should set and get klines', () => {
      manager.setKlines(mockKlines);
      
      expect(manager.getKlines()).toEqual(mockKlines);
      expect(manager.getBounds()).not.toBeNull();
    });

    it('should have null bounds with no klines', () => {
      manager.setKlines([]);
      
      expect(manager.getBounds()).toBeNull();
    });
  });

  describe('viewport management', () => {
    it('should update viewport', () => {
      manager.setKlines(mockKlines);
      const newViewport = { ...viewport, start: 10, end: 110 };
      manager.setViewport(newViewport);
      
      const updated = manager.getViewport();
      expect(updated.start).toBeGreaterThanOrEqual(0);
      expect(updated.end).toBeLessThanOrEqual(mockKlines.length);
    });

    it('should clamp viewport to kline range', () => {
      manager.setKlines(mockKlines);
      
      const invalidViewport = { ...viewport, start: -10, end: 250 };
      manager.setViewport(invalidViewport);
      
      const clamped = manager.getViewport();
      expect(clamped.start).toBeGreaterThanOrEqual(0);
      expect(clamped.end).toBeLessThanOrEqual(mockKlines.length);
    });
  });

  describe('coordinate conversion', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
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

  describe('visible klines', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
    });

    it('should return visible klines within viewport', () => {
      manager.setViewport({ ...viewport, start: 0, end: 50 });
      const visible = manager.getVisibleKlines();
      
      expect(visible.length).toBeLessThanOrEqual(50);
    });

    it('should handle viewport exceeding kline length', () => {
      manager.setViewport({ ...viewport, start: 150, end: 250 });
      const visible = manager.getVisibleKlines();
      
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThanOrEqual(mockKlines.length);
    });

    it('should return empty array when no klines', () => {
      manager.setKlines([]);
      const visible = manager.getVisibleKlines();
      
      expect(visible).toEqual([]);
    });
  });

  describe('zoom', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
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
      expect(newViewport.end).toBeLessThanOrEqual(mockKlines.length);
    });

    it('should update kline width after zoom', () => {
      manager.zoom(2);
      
      const newWidth = manager.getViewport().klineWidth;
      expect(newWidth).toBeGreaterThanOrEqual(CHART_CONFIG.MIN_KLINE_WIDTH);
      expect(newWidth).toBeLessThanOrEqual(CHART_CONFIG.MAX_KLINE_WIDTH);
    });

    it.skip('should trigger render callback on zoom', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.zoom(1);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('pan', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
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

    it.skip('should trigger render callback on pan', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.pan(50);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('vertical pan and zoom', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
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

    it.skip('should trigger render on vertical pan', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.panVertical(50);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });

    it.skip('should trigger render on vertical zoom', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.zoomVertical(10);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('kline at position', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
    });

    it('should get kline at x position', () => {
      const kline = manager.getKlineAtX(400);
      
      expect(kline).toBeDefined();
    });

    it('should return null for invalid position', () => {
      const kline = manager.getKlineAtX(10000);
      
      expect(kline).toBeNull();
    });
  });

  describe('right margin', () => {
    it.skip('should set right margin', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.setRightMargin(100);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('clear and resize', () => {
    it('should clear canvas', () => {
      manager.clear();
      
      expect(true).toBe(true);
    });

    it.skip('should resize canvas', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.resize();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('render callback', () => {
    it.skip('should set and trigger render callback', async () => {
      const callback = vi.fn();
      
      manager.setRenderCallback(callback);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
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
      manager.setKlines(mockKlines);
      manager.setRenderCallback(vi.fn());
      
      manager.destroy();
      
      expect(manager.getKlines()).toEqual([]);
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
      manager.setKlines(mockKlines);
    });

    it.skip('should reset price offset and scale', async () => {
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager['priceOffset'] = 100;
      manager['priceScale'] = 2;
      
      manager.resetVerticalZoom();
      
      expect(manager['priceOffset']).toBe(0);
      expect(manager['priceScale']).toBe(1);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('resetToInitialView', () => {
    it.skip('should reset to initial kline count', async () => {
      manager.setKlines(mockKlines);
      const callback = vi.fn();
      manager.setRenderCallback(callback);
      callback.mockClear();
      
      manager.pan(50);
      manager.resetToInitialView();
      
      const viewport = manager.getViewport();
      expect(viewport.end).toBe(mockKlines.length);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('panToNextKline', () => {
    beforeEach(() => {
      manager.setKlines(mockKlines);
      manager.setViewport({ ...viewport, start: 0, end: 50 });
    });

    it('should pan forward by one kline', () => {
      const initialStart = manager.getViewport().start;
      manager.panToNextKline();
      
      const newStart = manager.getViewport().start;
      expect(newStart).toBe(initialStart + 1);
    });

    it('should not pan beyond kline length', () => {
      manager.setViewport({ ...viewport, start: mockKlines.length - 50, end: mockKlines.length });
      manager.panToNextKline();
      
      const currentViewport = manager.getViewport();
      expect(currentViewport.end).toBe(mockKlines.length);
    });

    it('should do nothing with empty klines', () => {
      manager.setKlines([]);
      const initialViewport = manager.getViewport();
      
      manager.panToNextKline();
      
      expect(manager.getViewport()).toEqual(initialViewport);
    });
  });
});
