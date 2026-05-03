import { describe, expect, it, vi } from 'vitest';
import type { CoordinateMapper, HorizontalLineDrawing } from '@marketmind/chart-studies';

vi.mock('@renderer/utils/canvas/priceTagUtils', () => ({
  drawPriceTag: vi.fn(() => ({ width: 64, height: 18 })),
}));

vi.mock('@renderer/utils/canvas/canvasHelpers', () => ({
  applyDrawingStyle: vi.fn(),
}));

import { renderHorizontalLine, renderHorizontalLineTag } from './renderHorizontalLine';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';

const mapper: CoordinateMapper = {
  priceToY: (p: number) => 1000 - p,
  yToPrice: (y: number) => 1000 - y,
  indexToCenterX: (i: number) => i * 10,
};

// Mapper that always returns an in-bounds y. Used for tests focused on
// price formatting / color / etc where the y-clamp logic isn't the
// subject — keeps the test from short-circuiting via `y < 0 || y > h`.
const alwaysInBoundsMapper: CoordinateMapper = {
  priceToY: () => 500,
  yToPrice: () => 500,
  indexToCenterX: (i: number) => i * 10,
};

const baseDrawing: HorizontalLineDrawing = {
  id: 'h1',
  type: 'horizontalLine',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
  index: 5,
  price: 250,
};

const makeMockCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  setLineDash: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
});

describe('renderHorizontalLine', () => {
  it('strokes a line from left edge (0) to chartWidth at priceToY(price)', () => {
    const ctx = makeMockCtx();
    renderHorizontalLine(ctx as unknown as CanvasRenderingContext2D, baseDrawing, mapper, false, 800);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 750); // y = 1000-250 = 750
    expect(ctx.lineTo).toHaveBeenCalledWith(800, 750);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does NOT call drawPriceTag — the tag renders separately outside the clip', () => {
    const ctx = makeMockCtx();
    renderHorizontalLine(ctx as unknown as CanvasRenderingContext2D, baseDrawing, mapper, false, 800);
    expect(drawPriceTag).not.toHaveBeenCalled();
  });

  it('renders the grip handle only when selected', () => {
    const ctx = makeMockCtx();
    renderHorizontalLine(ctx as unknown as CanvasRenderingContext2D, baseDrawing, mapper, false, 800);
    expect(ctx.arc).not.toHaveBeenCalled();

    const ctx2 = makeMockCtx();
    renderHorizontalLine(ctx2 as unknown as CanvasRenderingContext2D, baseDrawing, mapper, true, 800);
    expect(ctx2.arc).toHaveBeenCalledTimes(1);
    // Grip is at indexToCenterX(5) = 50
    expect(ctx2.arc).toHaveBeenCalledWith(50, 750, 5, 0, Math.PI * 2);
  });
});

describe('renderHorizontalLineTag', () => {
  it('calls drawPriceTag at chartWidth with price formatted', () => {
    const ctx = makeMockCtx();
    renderHorizontalLineTag(ctx as unknown as CanvasRenderingContext2D, baseDrawing, mapper, 800, 1000);
    expect(drawPriceTag).toHaveBeenCalledTimes(1);
    const args = (drawPriceTag as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(args[1]).toBe('250.0000');
    expect(args[2]).toBe(750); // y = priceToY(250) = 1000-250
    expect(args[3]).toBe(800); // x = chartWidth (tag overlays price scale)
  });

  it('skips rendering when the line is above the chart bounds', () => {
    const ctx = makeMockCtx();
    // priceToY(1500) = 1000-1500 = -500 < 0
    renderHorizontalLineTag(ctx as unknown as CanvasRenderingContext2D, { ...baseDrawing, price: 1500 }, mapper, 800, 600);
    expect(drawPriceTag).not.toHaveBeenCalled();
  });

  it('skips rendering when the line is below the chart bounds', () => {
    const ctx = makeMockCtx();
    // priceToY(0) = 1000 > 600 (chartHeight)
    renderHorizontalLineTag(ctx as unknown as CanvasRenderingContext2D, { ...baseDrawing, price: 0 }, mapper, 800, 600);
    expect(drawPriceTag).not.toHaveBeenCalled();
  });

  it('uses drawing.color when provided', () => {
    vi.clearAllMocks();
    const ctx = makeMockCtx();
    renderHorizontalLineTag(
      ctx as unknown as CanvasRenderingContext2D,
      { ...baseDrawing, color: '#abcdef' },
      alwaysInBoundsMapper,
      800,
      1000,
    );
    const fillColor = (drawPriceTag as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4];
    expect(fillColor).toBe('#abcdef');
  });

  it('formats large prices (≥1000) with 2 decimals, no thousands separator', () => {
    vi.clearAllMocks();
    const ctx = makeMockCtx();
    renderHorizontalLineTag(
      ctx as unknown as CanvasRenderingContext2D,
      { ...baseDrawing, price: 78605.6 },
      alwaysInBoundsMapper,
      800,
      1000,
    );
    const formatted = (drawPriceTag as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
    expect(formatted).toBe('78605.60');
  });

  it('formats sub-1 prices with 8 decimals', () => {
    vi.clearAllMocks();
    const ctx = makeMockCtx();
    renderHorizontalLineTag(
      ctx as unknown as CanvasRenderingContext2D,
      { ...baseDrawing, price: 0.0001234 },
      alwaysInBoundsMapper,
      800,
      1000,
    );
    const formatted = (drawPriceTag as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
    expect(formatted).toBe('0.00012340');
  });
});
