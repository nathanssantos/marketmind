import type { Kline, Viewport } from '@marketmind/types';
import type { IndicatorDefinition } from '@marketmind/trading-core';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderOverlayLine } from './renderOverlayLine';
import { clearPriceTagBuffer, drainPriceTagBuffer } from '../../utils/priceTagBuffer';
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
    clearPriceTagBuffer(manager);
  });

  afterEach(() => {
    manager.destroy();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });

  test('queues a price tag for the last valid value', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 100 + i));
    manager.setKlines(klines);

    const values = klines.map((_, i) => 100 + i);
    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput(values, 'rgb(0, 220, 0)'),
    );

    const queued = drainPriceTagBuffer(manager);
    expect(queued).toHaveLength(1);
    expect(queued[0]!.priceText).toBe('109.00');
    expect(queued[0]!.y).toBe(manager.priceToY(109));
  });

  test('queues no tag when series is all-null', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 105));
    manager.setKlines(klines);

    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput([null, null, null, null, null, null, null, null, null, null], 'rgb(0, 0, 200)'),
    );

    expect(drainPriceTagBuffer(manager)).toHaveLength(0);
  });

  test('queued tag uses the indicator color', () => {
    const klines: Kline[] = Array.from({ length: 10 }, (_, i) => baseKline(i, 100 + i));
    manager.setKlines(klines);

    const RED = 'rgb(255, 0, 0)';
    renderOverlayLine(
      { manager, colors: {} as ChartThemeColors },
      makeInput(klines.map((_, i) => 100 + i), RED),
    );

    const queued = drainPriceTagBuffer(manager);
    expect(queued).toHaveLength(1);
    expect(queued[0]!.fillColor).toBe(RED);
    // ctx2d is referenced to keep the canvas alive; pixel sampling is no
    // longer needed because the tag is queued, not drawn directly here.
    expect(ctx2d).toBeDefined();
  });
});
