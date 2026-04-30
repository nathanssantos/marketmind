import type { Kline, Viewport } from '@marketmind/types';
import type { IndicatorDefinition } from '@marketmind/trading-core';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderOverlayBands } from './renderOverlayBands';
import type { GenericRendererInput, IndicatorValueSeries } from './types';

const baseKline = (i: number, close: number): Kline => ({
  openTime: 1_700_000_000_000 + i * 60_000,
  closeTime: 1_700_000_000_000 + (i + 1) * 60_000,
  open: String(close),
  high: String(close),
  low: String(close),
  close: String(close),
  volume: '1000',
  quoteVolume: '0',
  trades: 10,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const makeInput = (
  values: Record<string, IndicatorValueSeries>,
  color = 'rgb(0, 220, 0)',
): GenericRendererInput => ({
  instance: {
    id: 'i-1',
    userIndicatorId: 'u-1',
    catalogType: 'bollinger',
    params: { period: 20, color, lineWidth: 2 },
    visible: true,
  },
  definition: {
    type: 'bollinger',
    name: 'Bollinger Bands',
    outputs: [
      { key: 'upper', label: 'Upper' },
      { key: 'middle', label: 'Middle' },
      { key: 'lower', label: 'Lower' },
    ],
    params: [],
    render: { kind: 'overlay-bands' },
    evaluator: { service: 'pine', scriptId: 'bollinger' },
  } as unknown as IndicatorDefinition,
  values,
});

const scanAlpha = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number => {
  const xInt = Math.max(0, Math.floor(x));
  const yInt = Math.max(0, Math.floor(y));
  const img = ctx.getImageData(xInt, yInt, Math.max(1, w), Math.max(1, h)).data;
  let count = 0;
  for (let i = 3; i < img.length; i += 4) {
    if (img[i]! > 0) count += 1;
  }
  return count;
};

const dominantChannel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): 'r' | 'g' | 'b' | null => {
  const xInt = Math.max(0, Math.floor(x));
  const yInt = Math.max(0, Math.floor(y));
  const px = ctx.getImageData(xInt, yInt, 1, 1).data;
  const r = px[0]!;
  const g = px[1]!;
  const b = px[2]!;
  const a = px[3]!;
  if (a === 0) return null;
  if (r >= g && r >= b) return 'r';
  if (g >= r && g >= b) return 'g';
  return 'b';
};

describe('renderOverlayBands', () => {
  let canvas: HTMLCanvasElement;
  let manager: CanvasManager;
  let ctx2d: CanvasRenderingContext2D;

  const CANVAS_W = 800;
  const CANVAS_H = 400;
  const KLINE_COUNT = 10;

  const viewport: Viewport = {
    start: 0,
    end: KLINE_COUNT,
    klineWidth: 60,
    klineSpacing: 8,
    width: CANVAS_W,
    height: CANVAS_H,
    priceMin: 90,
    priceMax: 120,
  };

  const klines = (): Kline[] => Array.from({ length: KLINE_COUNT }, (_, i) => baseKline(i, 105));
  const flatBand = (value: number): IndicatorValueSeries => Array.from({ length: KLINE_COUNT }, () => value);

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

  test('paints fill region between upper and lower bands', () => {
    manager.setKlines(klines());
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        middle: flatBand(105),
        lower: flatBand(95),
      }),
    );

    // The fill polygon spans the gap between upper(y=115) and lower(y=95).
    // Sample a row between those y-values inside the chart area; it should
    // have non-trivial alpha coverage from the BOLLINGER_FILL fill.
    const midY = manager.priceToY(105);
    const dims = manager.getDimensions()!;
    const fillAlpha = scanAlpha(ctx2d, dims.chartWidth / 4, midY, dims.chartWidth / 2, 1);
    expect(fillAlpha, 'fill should paint pixels between the bands').toBeGreaterThan(0);
  });

  test('returns early when upper series is missing', () => {
    manager.setKlines(klines());
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        lower: flatBand(95),
      }),
    );

    const dims = manager.getDimensions()!;
    const totalAlpha = scanAlpha(ctx2d, 0, 0, dims.chartWidth, CANVAS_H);
    expect(totalAlpha, 'no draw without upper series').toBe(0);
  });

  test('returns early when lower series is missing', () => {
    manager.setKlines(klines());
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
      }),
    );

    const dims = manager.getDimensions()!;
    const totalAlpha = scanAlpha(ctx2d, 0, 0, dims.chartWidth, CANVAS_H);
    expect(totalAlpha, 'no draw without lower series').toBe(0);
  });

  test('returns early when klines list is empty', () => {
    manager.setKlines([]);
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        lower: flatBand(95),
      }),
    );

    const totalAlpha = scanAlpha(ctx2d, 0, 0, CANVAS_W, CANVAS_H);
    expect(totalAlpha, 'no draw with empty klines').toBe(0);
  });

  test('draws additional pixels along the middle row when middle series is supplied', () => {
    manager.setKlines(klines());
    // Render WITHOUT middle: only fill + 2 boundary lines.
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        lower: flatBand(95),
      }, 'rgb(0, 100, 255)'),
    );
    const midY = manager.priceToY(105);
    const dims = manager.getDimensions()!;
    // Count pixels with red channel > 100 (the dashed middle line uses the
    // baseColor's red channel) along a horizontal strip at midY.
    const sampleX = Math.floor(dims.chartWidth / 4);
    const sampleW = Math.floor(dims.chartWidth / 2);
    const countRedish = (): number => {
      const img = ctx2d.getImageData(sampleX, Math.floor(midY), sampleW, 1).data;
      let n = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i]! > 100) n += 1;
      }
      return n;
    };
    const redWithoutMiddle = countRedish();

    // Now render WITH a middle series and a red base color — the middle
    // dashed line at y=105 will paint red pixels along midY that weren't
    // there before.
    ctx2d.clearRect(0, 0, CANVAS_W, CANVAS_H);
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        middle: flatBand(105),
        lower: flatBand(95),
      }, 'rgb(255, 0, 0)'),
    );
    const redWithMiddle = countRedish();
    expect(redWithMiddle, 'red dashes appear along the middle y').toBeGreaterThan(redWithoutMiddle);
  });

  test('uses the indicator instance color for upper/lower polylines', () => {
    manager.setKlines(klines());
    const RED = 'rgb(255, 0, 0)';
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        lower: flatBand(95),
      }, RED),
    );

    // The upper line is drawn at y = priceToY(115). Sample a few x points
    // along that y; whichever pixel is on the line should have a
    // red-dominant color signature.
    const upperY = manager.priceToY(115);
    const dims = manager.getDimensions()!;
    let redHits = 0;
    for (let x = dims.chartWidth / 4; x < dims.chartWidth * 3 / 4; x += 5) {
      // Sample a small window around upperY since the line is anti-aliased.
      for (let dy = -1; dy <= 1; dy++) {
        if (dominantChannel(ctx2d, x, upperY + dy) === 'r') {
          redHits += 1;
          break;
        }
      }
    }
    expect(redHits, 'red dominates along the upper line y').toBeGreaterThan(3);
  });

  test('paints right-axis price tags for upper + lower at the last valid value', () => {
    manager.setKlines(klines());
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        upper: flatBand(115),
        lower: flatBand(95),
      }),
    );

    const dims = manager.getDimensions()!;
    const upperY = manager.priceToY(115);
    const lowerY = manager.priceToY(95);
    const upperTag = scanAlpha(ctx2d, dims.chartWidth, upperY, CHART_CONFIG.CANVAS_PADDING_RIGHT, 3);
    const lowerTag = scanAlpha(ctx2d, dims.chartWidth, lowerY, CHART_CONFIG.CANVAS_PADDING_RIGHT, 3);
    expect(upperTag, 'upper price tag should paint pixels').toBeGreaterThan(0);
    expect(lowerTag, 'lower price tag should paint pixels').toBeGreaterThan(0);
  });

  test('honours alternate output keys (top/bottom)', () => {
    manager.setKlines(klines());
    renderOverlayBands(
      { manager, colors: {} as ChartThemeColors },
      makeInput({
        top: flatBand(115),
        bottom: flatBand(95),
      }),
    );

    // pickSeries() should resolve top→upper / bottom→lower and render the
    // bands. Without that resolution the fill region wouldn't be drawn.
    const midY = manager.priceToY(105);
    const dims = manager.getDimensions()!;
    const fillAlpha = scanAlpha(ctx2d, dims.chartWidth / 4, midY, dims.chartWidth / 2, 1);
    expect(fillAlpha, 'top/bottom keys should resolve to upper/lower').toBeGreaterThan(0);
  });
});
