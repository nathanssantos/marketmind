import type { Kline, Viewport } from '@marketmind/types';
import type { IndicatorDefinition } from '@marketmind/trading-core';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderOverlayLine } from './renderOverlayLine';
import type { GenericRendererInput } from './types';

const baseKline = (
  i: number,
  close: number,
): Kline => ({
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
  values: (number | null)[],
  color = 'rgb(0, 200, 0)',
): GenericRendererInput => ({
  instance: {
    id: 'i-1',
    userIndicatorId: 'u-1',
    catalogType: 'ema',
    params: { period: 9, color, lineWidth: 2 },
    visible: true,
  },
  definition: {
    type: 'ema',
    name: 'EMA',
    outputs: [{ key: 'value', label: 'EMA' }],
    params: [],
    render: { kind: 'overlay-line' },
    evaluator: { service: 'pine', scriptId: 'ema' },
  } as unknown as IndicatorDefinition,
  values: { value: values },
});

const scanRowAlpha = (
  ctx: CanvasRenderingContext2D,
  y: number,
  xStart: number,
  xEnd: number,
): number => {
  const yInt = Math.max(0, Math.floor(y));
  const w = Math.max(1, Math.floor(xEnd - xStart));
  const img = ctx.getImageData(Math.floor(xStart), yInt, w, 3).data;
  let count = 0;
  for (let i = 3; i < img.length; i += 4) {
    if (img[i]! > 0) count += 1;
  }
  return count;
};

describe('renderOverlayLine — right-axis price tag', () => {
  let canvas: HTMLCanvasElement;
  let manager: CanvasManager;
  let ctx2d: CanvasRenderingContext2D;

  const CANVAS_W = 800;
  const CANVAS_H = 400;

  const viewport: Viewport = {
    start: 0,
    end: 10,
    klineWidth: 60,
    klineSpacing: 8,
    width: CANVAS_W,
    height: CANVAS_H,
    priceMin: 100,
    priceMax: 110,
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

  test('paints a price tag in the right-axis strip when series has values', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 100 + i));
    manager.setKlines(klines);

    const values = klines.map((_, i) => 100 + i);
    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput(values, 'rgb(0, 220, 0)'),
    );

    // Tag rectangle is drawn from chartWidth to chartWidth + CANVAS_PADDING_RIGHT
    // at y = priceToY(lastValue=109). The tag's body is colored fill, so any
    // row inside the price-scale strip near that y should have non-zero alpha.
    const lastY = manager.priceToY(109);
    const dims = manager.getDimensions()!;
    const tagAlpha = scanRowAlpha(ctx2d, lastY, dims.chartWidth, dims.chartWidth + CHART_CONFIG.CANVAS_PADDING_RIGHT);
    expect(tagAlpha, 'tag should paint pixels in the price-scale strip').toBeGreaterThan(0);
  });

  test('paints no tag when series is all-null', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 105));
    manager.setKlines(klines);

    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput([null, null, null, null, null, null, null, null, null, null], 'rgb(0, 0, 200)'),
    );

    // No values → no line, no tag. The price-scale strip should be untouched.
    const dims = manager.getDimensions()!;
    let totalAlpha = 0;
    for (let y = 0; y < CANVAS_H; y += 20) {
      totalAlpha += scanRowAlpha(ctx2d, y, dims.chartWidth, dims.chartWidth + CHART_CONFIG.CANVAS_PADDING_RIGHT);
    }
    expect(totalAlpha, 'no tag when series is empty').toBe(0);
  });

  test('tag color matches the indicator color', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 100 + i));
    manager.setKlines(klines);

    const RED = 'rgb(255, 0, 0)';
    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput(klines.map((_, i) => 100 + i), RED),
    );

    const lastY = manager.priceToY(109);
    const dims = manager.getDimensions()!;
    // Sample the middle of the price-scale strip at the tag's y
    const sampleX = dims.chartWidth + 20;
    const yInt = Math.max(0, Math.floor(lastY));
    const pixel = ctx2d.getImageData(sampleX, yInt, 1, 1).data;
    expect(pixel[0]!, 'tag fills with red channel dominant').toBeGreaterThan(pixel[1]!);
    expect(pixel[0]!).toBeGreaterThan(pixel[2]!);
  });
});
