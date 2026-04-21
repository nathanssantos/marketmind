import type { Kline, Viewport } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CanvasManager } from './CanvasManager';
import { calculateBounds, type Dimensions } from './coordinateSystem';
import {
  applyBoundsTransform,
  calculateInitialView,
  calculateKlineWidth,
  getMaxViewportEnd,
  panViewport,
  panVerticalOffset,
  zoomVerticalScale,
  zoomViewport,
} from './ViewportNavigator';

const mkKline = (i: number, o: number, h: number, l: number, c: number): Kline => ({
  openTime: 1_700_000_000_000 + i * 60_000,
  closeTime: 1_700_000_000_000 + i * 60_000 + 60_000,
  open: String(o),
  high: String(h),
  low: String(l),
  close: String(c),
  volume: '1000',
  quoteVolume: '0',
  trades: 10,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const buildKlines = (n: number): Kline[] => {
  const out: Kline[] = [];
  for (let i = 0; i < n; i += 1) {
    const base = 100 + (i % 10);
    out.push(mkKline(i, base, base + 2, base - 2, base + 1));
  }
  return out;
};

describe('ViewportNavigator — real browser', () => {
  let canvas: HTMLCanvasElement;
  let manager: CanvasManager;
  const CANVAS_W = 1000;
  const CANVAS_H = 600;
  const viewport: Viewport = {
    start: 0,
    end: 100,
    klineWidth: 8,
    klineSpacing: 2,
    width: CANVAS_W,
    height: CANVAS_H,
    priceMin: 0,
    priceMax: 0,
  };

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    document.body.appendChild(canvas);
    manager = new CanvasManager(canvas, viewport, 40);
  });

  afterEach(() => {
    manager.destroy();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });

  describe('priceToY / yToPrice round-trip through real CanvasManager', () => {
    test('round-trips a price within range (losses < 1e-6)', () => {
      manager.setKlines(buildKlines(100));
      const y = manager.priceToY(105);
      const back = manager.yToPrice(y);
      expect(Math.abs(back - 105)).toBeLessThan(1e-6);
    });

    test('priceToY of minPrice ≠ priceToY of maxPrice (non-collapsed axis)', () => {
      manager.setKlines(buildKlines(100));
      const bounds = manager.getBounds()!;
      expect(bounds.minPrice).toBeLessThan(bounds.maxPrice);
      const yMin = manager.priceToY(bounds.minPrice);
      const yMax = manager.priceToY(bounds.maxPrice);
      expect(yMin).not.toBe(yMax);
      expect(yMin).toBeGreaterThan(yMax); // lower price → larger y (non-flipped)
    });

    test('flipped axis inverts the direction of the price/Y mapping', () => {
      manager.setKlines(buildKlines(100));
      const before = manager.priceToY(110);
      manager.setFlipped(true);
      const after = manager.priceToY(110);
      expect(after).not.toBe(before);
    });
  });

  describe('indexToX / xToIndex round-trip', () => {
    test('x at indexToX(i) maps back to i', () => {
      manager.setKlines(buildKlines(100));
      const x = manager.indexToX(42);
      const back = manager.xToIndex(x);
      expect(Math.abs(back - 42)).toBeLessThan(1e-6);
    });

    test('pixels per kline scales with viewport range', () => {
      manager.setKlines(buildKlines(100));
      const narrowX0 = manager.indexToX(0);
      const narrowX1 = manager.indexToX(1);
      const narrowPxPerKline = narrowX1 - narrowX0;
      manager.setViewport({ ...viewport, start: 0, end: 50 });
      const wideX0 = manager.indexToX(0);
      const wideX1 = manager.indexToX(1);
      const widePxPerKline = wideX1 - wideX0;
      expect(widePxPerKline).toBeCloseTo(narrowPxPerKline * 2, 3);
    });
  });

  describe('panViewport', () => {
    test('panning right by half the chart width shifts start/end by half the visible range', () => {
      const klines = buildKlines(500);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();
      const panned = panViewport(v, dims, klines, -dims.chartWidth / 2);
      const range = v.end - v.start;
      expect(panned.start).toBeCloseTo(v.start + range / 2, 3);
      expect(panned.end).toBeCloseTo(v.end + range / 2, 3);
    });

    test('panning past the end is clamped by clampViewport', () => {
      const klines = buildKlines(100);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();
      const panned = panViewport(v, dims, klines, -10_000);
      const maxEnd = getMaxViewportEnd(klines, v);
      expect(panned.end).toBeLessThanOrEqual(maxEnd);
    });

    test('panning to the left is clamped so start stays at 0', () => {
      const klines = buildKlines(100);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();
      const panned = panViewport(v, dims, klines, 10_000);
      expect(panned.start).toBe(0);
    });
  });

  describe('zoomViewport', () => {
    test('zooming in around a centerX preserves the kline under that pixel', () => {
      const klines = buildKlines(500);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();

      const centerX = dims.chartWidth * 0.25; // somewhere in the left quarter
      const widthPerKline = dims.chartWidth / (v.end - v.start);
      const klineUnderPixel = v.start + centerX / widthPerKline;

      const zoomedIn = zoomViewport(
        { viewport: v, priceOffset: 0, priceScale: 1 },
        dims,
        klines,
        1,
        centerX,
      );

      const zoomedWidthPerKline = dims.chartWidth / (zoomedIn.end - zoomedIn.start);
      const klineUnderPixelAfter = zoomedIn.start + centerX / zoomedWidthPerKline;
      expect(klineUnderPixelAfter).toBeCloseTo(klineUnderPixel, 3);
      expect(zoomedIn.end - zoomedIn.start).toBeLessThan(v.end - v.start);
    });

    test('zooming in without centerX keeps the midpoint stable', () => {
      const klines = buildKlines(500);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();
      const midBefore = (v.start + v.end) / 2;
      const zoomed = zoomViewport(
        { viewport: v, priceOffset: 0, priceScale: 1 },
        dims,
        klines,
        1,
      );
      const midAfter = (zoomed.start + zoomed.end) / 2;
      expect(midAfter).toBeCloseTo(midBefore, 3);
      expect(zoomed.end - zoomed.start).toBeLessThan(v.end - v.start);
    });

    test('zooming out expands the visible range', () => {
      const klines = buildKlines(500);
      manager.setKlines(klines);
      const dims = manager.getDimensions()!;
      const v = manager.getViewport();
      const zoomed = zoomViewport(
        { viewport: v, priceOffset: 0, priceScale: 1 },
        dims,
        klines,
        -1,
      );
      expect(zoomed.end - zoomed.start).toBeGreaterThan(v.end - v.start);
    });
  });

  describe('calculateKlineWidth', () => {
    test('width per kline * 0.8 is the computed draw width (above the min floor)', () => {
      const v: Viewport = { ...viewport, start: 0, end: 100 };
      const width = calculateKlineWidth(v, 1000);
      expect(width).toBeCloseTo((1000 / 100) * 0.8, 5);
    });

    test('never drops below MIN_KLINE_WIDTH', () => {
      const v: Viewport = { ...viewport, start: 0, end: 10_000 };
      const width = calculateKlineWidth(v, 100);
      expect(width).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateInitialView', () => {
    test('anchors start to the tail of klines (end minus INITIAL_KLINES_VISIBLE)', () => {
      const klines = buildKlines(500);
      const next = calculateInitialView(klines, viewport);
      expect(next.start).toBe(500 - 60);
      expect(next.end).toBeGreaterThan(500); // includes some future space
    });

    test('for short kline arrays, start is clamped to 0', () => {
      const klines = buildKlines(30);
      const next = calculateInitialView(klines, viewport);
      expect(next.start).toBe(0);
      expect(next.end).toBeGreaterThan(30);
    });
  });

  describe('applyBoundsTransform', () => {
    test('priceOffset shifts both min and max equally', () => {
      const base = { minPrice: 100, maxPrice: 200, minVolume: 0, maxVolume: 1 };
      const shifted = applyBoundsTransform(base, 25, 1);
      expect(shifted.minPrice).toBe(125);
      expect(shifted.maxPrice).toBe(225);
    });

    test('priceScale expands the range around the midpoint', () => {
      const base = { minPrice: 100, maxPrice: 200, minVolume: 0, maxVolume: 1 };
      const scaled = applyBoundsTransform(base, 0, 2);
      expect(scaled.minPrice).toBe(50);
      expect(scaled.maxPrice).toBe(250);
    });
  });

  describe('panVerticalOffset', () => {
    test('drag down by chartHeight shifts offset by the full visible price range', () => {
      const klines = buildKlines(100);
      const dims: Dimensions = { width: 1000, height: 600, chartWidth: 1000, chartHeight: 500, volumeHeight: 100 };
      const v = { ...viewport, start: 0, end: 100 };
      const bounds = calculateBounds(klines, v);
      const range = bounds.maxPrice - bounds.minPrice;
      const next = panVerticalOffset(0, dims.chartHeight, dims.chartHeight, klines, v, 1);
      expect(next).toBeCloseTo(range, 3);
    });

    test('empty klines returns the current offset unchanged', () => {
      const dims: Dimensions = { width: 1000, height: 600, chartWidth: 1000, chartHeight: 500, volumeHeight: 100 };
      const result = panVerticalOffset(7, 100, dims.chartHeight, [], viewport, 1);
      expect(result).toBe(7);
    });
  });

  describe('zoomVerticalScale', () => {
    test('positive deltaY increases the scale', () => {
      const scale = zoomVerticalScale(1, 50, 500);
      expect(scale).toBeGreaterThan(1);
    });

    test('negative deltaY decreases the scale, clamped to 0.1', () => {
      const scale = zoomVerticalScale(0.1, -10_000, 500);
      expect(scale).toBe(0.1);
    });

    test('absurdly large deltaY is clamped to 10', () => {
      const scale = zoomVerticalScale(1, 1_000_000, 500);
      expect(scale).toBe(10);
    });
  });
});
