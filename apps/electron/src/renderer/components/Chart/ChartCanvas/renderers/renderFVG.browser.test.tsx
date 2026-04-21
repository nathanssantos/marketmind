import type { Kline, Viewport } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { renderFVG } from './renderFVG';

const FVG_COLORS = {
  bullish: 'rgb(0, 200, 0)',
  bearish: 'rgb(200, 0, 0)',
  bullishBorder: 'rgb(0, 150, 0)',
  bearishBorder: 'rgb(150, 0, 0)',
} as const;

const baseKline = (
  overrides: Partial<Kline> & Pick<Kline, 'open' | 'high' | 'low' | 'close'>,
  openTime: number,
): Kline => ({
  openTime,
  closeTime: openTime + 60_000,
  volume: '1000',
  quoteVolume: '0',
  trades: 10,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
  ...overrides,
});

const makeKline = (i: number, o: number, h: number, l: number, c: number): Kline =>
  baseKline(
    {
      open: String(o),
      high: String(h),
      low: String(l),
      close: String(c),
    },
    1_700_000_000_000 + i * 60_000,
  );

const chartColors = (): ChartThemeColors =>
  ({
    fvg: { ...FVG_COLORS },
  }) as unknown as ChartThemeColors;

const makeCtx = (manager: CanvasManager) => ({
  manager,
  colors: chartColors(),
});

const sampleCell = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w = 2,
  h = 2,
): { r: number; g: number; b: number; a: number } => {
  const img = ctx.getImageData(Math.floor(x), Math.floor(y), w, h).data;
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

const scanAlpha = (ctx: CanvasRenderingContext2D, w: number, h: number): number => {
  const img = ctx.getImageData(0, 0, w, h).data;
  let count = 0;
  for (let i = 3; i < img.length; i += 4) {
    if (img[i]! > 0) count += 1;
  }
  return count;
};

describe('renderFVG — real browser', () => {
  let canvas: HTMLCanvasElement;
  let manager: CanvasManager;
  let ctx2d: CanvasRenderingContext2D;

  const CANVAS_W = 800;
  const CANVAS_H = 600;

  const viewport: Viewport = {
    start: 0,
    end: 20,
    klineWidth: 20,
    klineSpacing: 4,
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

  test('renders nothing when klines are empty', () => {
    manager.setKlines([]);
    renderFVG(makeCtx(manager), {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('renders nothing when klines length < 3', () => {
    manager.setKlines([
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 102, 99, 101),
    ]);
    renderFVG(makeCtx(manager), {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('renders nothing when no gap exists (continuous candles)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i += 1) {
      klines.push(makeKline(i, 100, 102, 98, 100));
    }
    manager.setKlines(klines);
    renderFVG(makeCtx(manager), {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('paints a bullish FVG rectangle in the gap region using bullish color', () => {
    // k1[i=3].high = 100, k3[i=5].low = 120 → bullish gap low=100, high=120 at index 4
    const klines: Kline[] = [
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 101, 99, 100),
      makeKline(2, 100, 101, 99, 100),
      makeKline(3, 100, 100, 99, 100),
      makeKline(4, 110, 111, 109, 110),
      makeKline(5, 120, 121, 120, 121),
      makeKline(6, 121, 122, 120, 121),
      makeKline(7, 121, 122, 120, 121),
      makeKline(8, 121, 122, 120, 121),
      makeKline(9, 121, 122, 120, 121),
    ];
    manager.setKlines(klines);

    const gapStartX = manager.indexToX(4);
    const gapTopY = manager.priceToY(120);
    const gapBottomY = manager.priceToY(100);

    renderFVG(makeCtx(manager), {} as never);

    expect(gapStartX).toBeGreaterThan(0);
    expect(gapBottomY).toBeGreaterThan(gapTopY);

    const midX = gapStartX + 20;
    const midY = (gapTopY + gapBottomY) / 2;
    const inside = sampleCell(ctx2d, midX, midY);
    expect(inside.a, 'gap rectangle should be painted').toBeGreaterThan(0);
    expect(inside.g, 'bullish fill uses green channel').toBeGreaterThan(inside.r);
    expect(inside.g).toBeGreaterThan(inside.b);

    const outside = sampleCell(ctx2d, gapStartX - 10, midY);
    expect(outside.a, 'left of gap start should be clear').toBe(0);
  });

  test('paints a bearish FVG rectangle using bearish color', () => {
    // k1[i=3].low = 120, k3[i=5].high = 100 → bearish gap low=100, high=120 at index 4
    const klines: Kline[] = [
      makeKline(0, 125, 126, 124, 125),
      makeKline(1, 125, 126, 124, 125),
      makeKline(2, 125, 126, 124, 125),
      makeKline(3, 125, 125, 120, 122),
      makeKline(4, 115, 116, 114, 115),
      makeKline(5, 100, 100, 99, 100),
      makeKline(6, 100, 101, 99, 100),
      makeKline(7, 100, 101, 99, 100),
      makeKline(8, 100, 101, 99, 100),
      makeKline(9, 100, 101, 99, 100),
    ];
    manager.setKlines(klines);

    const gapStartX = manager.indexToX(4);
    const gapTopY = manager.priceToY(120);
    const gapBottomY = manager.priceToY(100);

    renderFVG(makeCtx(manager), {} as never);

    const inside = sampleCell(ctx2d, gapStartX + 20, (gapTopY + gapBottomY) / 2);
    expect(inside.a).toBeGreaterThan(0);
    expect(inside.r, 'bearish fill uses red channel').toBeGreaterThan(inside.g);
    expect(inside.r).toBeGreaterThan(inside.b);
  });

  test('skips a filled gap', () => {
    // Bullish gap at index 4 (low=100, high=120), then kline[9].low drops to 95 filling it
    const klines: Kline[] = [
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 101, 99, 100),
      makeKline(2, 100, 101, 99, 100),
      makeKline(3, 100, 100, 99, 100),
      makeKline(4, 110, 111, 109, 110),
      makeKline(5, 120, 121, 120, 121),
      makeKline(6, 121, 122, 120, 121),
      makeKline(7, 121, 122, 120, 121),
      makeKline(8, 121, 122, 120, 121),
      makeKline(9, 121, 121, 95, 100),
    ];
    manager.setKlines(klines);

    renderFVG(makeCtx(manager), {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('gap rectangle extends to effectiveWidth (chartWidth - right margin)', () => {
    const klines: Kline[] = [
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 101, 99, 100),
      makeKline(2, 100, 101, 99, 100),
      makeKline(3, 100, 100, 99, 100),
      makeKline(4, 110, 111, 109, 110),
      makeKline(5, 120, 121, 120, 121),
      makeKline(6, 121, 122, 120, 121),
      makeKline(7, 121, 122, 120, 121),
    ];
    manager.setKlines(klines);

    const gapMidY = (manager.priceToY(120) + manager.priceToY(100)) / 2;

    renderFVG(makeCtx(manager), {} as never);

    const dims = manager.getDimensions()!;
    const leftOfMargin = sampleCell(ctx2d, dims.chartWidth - 90, gapMidY);
    expect(leftOfMargin.a, 'just left of the right margin should still be painted').toBeGreaterThan(0);

    const inMargin = sampleCell(ctx2d, dims.chartWidth - 20, gapMidY);
    expect(inMargin.a, 'inside right margin should remain clear').toBe(0);
  });

  test('skips gaps more than 50 bars beyond the visible end (future-cull)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 200; i += 1) {
      klines.push(makeKline(i, 100, 101, 99, 100));
    }
    // Inject a bullish gap at index ~190 (far ahead of viewport end=100+50)
    klines[188] = makeKline(188, 100, 100, 99, 100);
    klines[189] = makeKline(189, 110, 111, 109, 110);
    klines[190] = makeKline(190, 120, 121, 120, 121);
    manager.setKlines(klines);
    manager.setViewport({
      start: 50,
      end: 100,
      klineWidth: 10,
      klineSpacing: 2,
      width: CANVAS_W,
      height: CANVAS_H,
      priceMin: 0,
      priceMax: 0,
    });

    renderFVG(makeCtx(manager), {} as never);
    expect(scanAlpha(ctx2d, CANVAS_W, CANVAS_H)).toBe(0);
  });

  test('falls back to default bullish color when colors.fvg is missing', () => {
    const klines: Kline[] = [
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 101, 99, 100),
      makeKline(2, 100, 101, 99, 100),
      makeKline(3, 100, 100, 99, 100),
      makeKline(4, 110, 111, 109, 110),
      makeKline(5, 120, 121, 120, 121),
    ];
    manager.setKlines(klines);

    const midX = manager.indexToX(4) + 20;
    const midY = (manager.priceToY(120) + manager.priceToY(100)) / 2;

    renderFVG({ manager, colors: {} as ChartThemeColors }, {} as never);

    const inside = sampleCell(ctx2d, midX, midY);
    expect(inside.a).toBeGreaterThan(0);
    expect(inside.g).toBeGreaterThan(inside.r);
  });

  test('respects clip to chart area when viewport is panned', () => {
    const klines: Kline[] = [
      makeKline(0, 100, 101, 99, 100),
      makeKline(1, 100, 101, 99, 100),
      makeKline(2, 100, 101, 99, 100),
      makeKline(3, 100, 100, 99, 100),
      makeKline(4, 110, 111, 109, 110),
      makeKline(5, 120, 121, 120, 121),
      makeKline(6, 121, 122, 120, 121),
      makeKline(7, 121, 122, 120, 121),
      makeKline(8, 121, 122, 120, 121),
      makeKline(9, 121, 122, 120, 121),
    ];
    manager.setKlines(klines);
    // Pan so the gap starts off-screen to the left — renderer clamps startX to 0
    manager.setViewport({
      start: 7,
      end: 10,
      klineWidth: 80,
      klineSpacing: 20,
      width: CANVAS_W,
      height: CANVAS_H,
      priceMin: 0,
      priceMax: 0,
    });

    renderFVG(makeCtx(manager), {} as never);

    // Left edge pixel should be painted because startX was clamped to 0
    const gapMidY = (manager.priceToY(120) + manager.priceToY(100)) / 2;
    const leftEdge = sampleCell(ctx2d, 2, gapMidY);
    expect(leftEdge.a, 'gap extended to left edge after clamping').toBeGreaterThan(0);
  });
});
