import type { Kline, Viewport } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { renderFibonacci } from './renderFibonacci';

const FIBONACCI_LOOKBACK = 50;

const baseKline = (i: number, o: number, h: number, l: number, c: number): Kline => ({
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

/**
 * Build 50 klines with a known swing:
 *   - baseline price 150
 *   - index 10 reaches high 200 (swing high)
 *   - index 40 reaches low 100 (swing low)
 *
 * highestIndex (10) < lowestIndex (40) → direction = 'down'
 * range = 100, so for direction 'down': price = swingLow + range * level
 *   0     → 100
 *   0.236 → 123.6
 *   0.382 → 138.2
 *   0.5   → 150
 *   0.618 → 161.8
 *   0.786 → 178.6
 *   0.886 → 188.6  (HIDDEN — not drawn)
 *   1     → 200
 */
const buildSwingKlines = (): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < FIBONACCI_LOOKBACK; i += 1) {
    klines.push(baseKline(i, 150, 151, 149, 150));
  }
  klines[10] = baseKline(10, 150, 200, 149, 150);
  klines[40] = baseKline(40, 150, 151, 100, 150);
  return klines;
};

const chartColors = (): ChartThemeColors =>
  ({
    fibonacci: {
      level0: 'rgb(255, 0, 0)',
      level236: 'rgb(255, 128, 0)',
      level382: 'rgb(255, 255, 0)',
      level50: 'rgb(0, 255, 0)',
      level618: 'rgb(0, 255, 255)',
      level786: 'rgb(0, 128, 255)',
      level886: 'rgb(128, 0, 255)',
      level100: 'rgb(255, 0, 255)',
      level127: '#000',
      level138: '#000',
      level161: '#000',
      level200: '#000',
      level261: '#000',
      level300: '#000',
      level361: '#000',
      level423: '#000',
    },
  }) as unknown as ChartThemeColors;

const sampleRow = (
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  x = 10,
): { r: number; g: number; b: number; a: number } => {
  const img = ctx.getImageData(x, Math.floor(y), width, 1).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let i = 0; i < img.length; i += 4) {
    r += img[i]!;
    g += img[i + 1]!;
    b += img[i + 2]!;
    a += img[i + 3]!;
    n += 1;
  }
  return { r: r / n, g: g / n, b: b / n, a: a / n };
};

const scanAlpha = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): number => {
  const img = ctx.getImageData(0, 0, w, h).data;
  let count = 0;
  for (let i = 3; i < img.length; i += 4) {
    if (img[i]! > 0) count += 1;
  }
  return count;
};

describe('renderFibonacci — real browser', () => {
  let canvas: HTMLCanvasElement;
  let manager: CanvasManager;
  let ctx2d: CanvasRenderingContext2D;

  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const viewport: Viewport = {
    start: 0,
    end: FIBONACCI_LOOKBACK,
    klineWidth: 15,
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
    ctx2d = canvas.getContext('2d')!;
    ctx2d.clearRect(0, 0, CANVAS_W, CANVAS_H);
  });

  afterEach(() => {
    manager.destroy();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });

  test('renders nothing when klines below lookback (50)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i += 1) klines.push(baseKline(i, 150, 155, 145, 150));
    manager.setKlines(klines);

    renderFibonacci({ manager, colors: chartColors() }, {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('draws a line at the 50% level (price 150) with the configured color', () => {
    manager.setKlines(buildSwingKlines());
    const y50 = Math.round(manager.priceToY(150));

    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    const row = sampleRow(ctx2d, y50, 200);
    expect(row.a, '50% line pixels should be painted').toBeGreaterThan(0);
    expect(row.g, 'level50 color is rgb(0,255,0)').toBeGreaterThan(row.r);
    expect(row.g).toBeGreaterThan(row.b);
  });

  test('draws all six non-hidden retracement levels', () => {
    manager.setKlines(buildSwingKlines());
    // Prices per build comment. 0.886 is hidden.
    const prices = [100, 123.6, 138.2, 150, 161.8, 178.6, 200];

    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    for (const price of prices) {
      const y = Math.round(manager.priceToY(price));
      const row = sampleRow(ctx2d, y, 200);
      expect(row.a, `line at price ${price} should be painted`).toBeGreaterThan(0);
    }
  });

  test('skips the hidden 0.886 level (price 188.6)', () => {
    manager.setKlines(buildSwingKlines());
    const yHidden = Math.round(manager.priceToY(188.6));

    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    // Sample far left (x=10..50) of chart area at the hidden Y row. Adjacent
    // level lines (0.786 → y 178.6, 1.0 → y 200) are several dozen pixels away,
    // so anti-aliasing from those should not reach this row.
    const row = sampleRow(ctx2d, yHidden, 40, 10);
    expect(row.a, '0.886 (hidden) level should not be painted').toBe(0);
  });

  test('uses the default fibonacci color when colors.fibonacci is missing', () => {
    manager.setKlines(buildSwingKlines());
    const y50 = Math.round(manager.priceToY(150));

    renderFibonacci({ manager, colors: {} as ChartThemeColors }, {} as never);

    const row = sampleRow(ctx2d, y50, 200);
    expect(row.a, 'default fibonacci color has alpha ~0.35').toBeGreaterThan(0);
    // Default color is rgba(128, 128, 128, 0.35) — roughly neutral gray.
    expect(Math.abs(row.r - row.g)).toBeLessThan(40);
    expect(Math.abs(row.g - row.b)).toBeLessThan(40);
  });

  test('draws labels inside the right margin strip', () => {
    manager.setKlines(buildSwingKlines());
    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    const dims = manager.getDimensions()!;
    const effectiveWidth = dims.chartWidth - 72; // CHART_RIGHT_MARGIN
    const y50 = Math.round(manager.priceToY(150));

    // Label is right-aligned at effectiveWidth - 4, so sample just to the left.
    const labelSwatch = ctx2d.getImageData(
      Math.max(0, effectiveWidth - 50),
      Math.max(0, y50 - 6),
      50,
      12,
    ).data;
    let painted = 0;
    for (let i = 3; i < labelSwatch.length; i += 4) {
      if (labelSwatch[i]! > 0) painted += 1;
    }
    expect(painted, 'label glyphs paint near the right edge').toBeGreaterThan(5);
  });

  test('inverts direction when swing high comes after swing low (direction up)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < FIBONACCI_LOOKBACK; i += 1) {
      klines.push(baseKline(i, 150, 151, 149, 150));
    }
    klines[10] = baseKline(10, 150, 151, 100, 150); // swing low at index 10
    klines[40] = baseKline(40, 150, 200, 149, 150); // swing high at index 40
    manager.setKlines(klines);

    // direction='up': price = swingHigh - range*level → 0 hits 200, 1 hits 100.
    const yTop = Math.round(manager.priceToY(200));
    const yBot = Math.round(manager.priceToY(100));

    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    const top = sampleRow(ctx2d, yTop, 200);
    const bot = sampleRow(ctx2d, yBot, 200);
    expect(top.a).toBeGreaterThan(0);
    expect(bot.a).toBeGreaterThan(0);
  });

  test('lines stop before the right margin (do not bleed into price axis)', () => {
    manager.setKlines(buildSwingKlines());
    const y50 = Math.round(manager.priceToY(150));
    const dims = manager.getDimensions()!;

    renderFibonacci({ manager, colors: chartColors() }, {} as never);

    // chartWidth - 40 is well inside the right margin (margin is 72).
    const rightStrip = ctx2d.getImageData(
      dims.chartWidth - 40,
      y50,
      30,
      1,
    ).data;
    let painted = 0;
    for (let i = 3; i < rightStrip.length; i += 4) {
      if (rightStrip[i]! > 0) painted += 1;
    }
    // Label glyphs may intrude slightly from the right, but the center of the
    // margin strip should have gaps.
    expect(painted).toBeLessThan(30);
  });
});
