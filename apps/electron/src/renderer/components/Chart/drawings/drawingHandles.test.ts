import { describe, expect, it, vi } from 'vitest';
import type { CoordinateMapper, Drawing, FibonacciDrawing, HorizontalLineDrawing, LineDrawing, PencilDrawing, ChannelDrawing, LongPositionDrawing } from '@marketmind/chart-studies';
import { getHandlePoints, renderDrawingHandles, renderMagnetAnchors } from './drawingHandles';

const mapper: CoordinateMapper = {
  priceToY: (p: number) => p * -1,
  yToPrice: (y: number) => y * -1,
  indexToCenterX: (i: number) => i * 10,
};

const baseDrawing = {
  id: 'd1',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
};

describe('getHandlePoints', () => {
  it('returns 2 points for two-point drawings (line)', () => {
    const line: LineDrawing = { ...baseDrawing, type: 'line', startIndex: 1, startPrice: 100, endIndex: 5, endPrice: 200 };
    expect(getHandlePoints(line, mapper)).toEqual([
      { x: 10, y: -100 },
      { x: 50, y: -200 },
    ]);
  });

  it('returns 3 points for three-point drawings (channel)', () => {
    const channel: ChannelDrawing = {
      ...baseDrawing,
      type: 'channel',
      startIndex: 1, startPrice: 100,
      endIndex: 5, endPrice: 200,
      widthIndex: 5, widthPrice: 250,
    };
    const pts = getHandlePoints(channel, mapper);
    expect(pts).toHaveLength(3);
    expect(pts[2]).toEqual({ x: 50, y: -250 });
  });

  it('returns 2 points for fibonacci (swing low + swing high)', () => {
    const fib: FibonacciDrawing = {
      ...baseDrawing,
      type: 'fibonacci',
      swingLowIndex: 0, swingLowPrice: 50,
      swingHighIndex: 10, swingHighPrice: 150,
      direction: 'up',
      levels: [],
    };
    expect(getHandlePoints(fib, mapper)).toEqual([
      { x: 0, y: -50 },
      { x: 100, y: -150 },
    ]);
  });

  it('returns first + last point for freeform pencil', () => {
    const pencil: PencilDrawing = {
      ...baseDrawing,
      type: 'pencil',
      points: [
        { index: 0, price: 100 },
        { index: 5, price: 150 },
        { index: 10, price: 200 },
      ],
    };
    expect(getHandlePoints(pencil, mapper)).toEqual([
      { x: 0, y: -100 },
      { x: 100, y: -200 },
    ]);
  });

  it('returns single point for horizontalLine', () => {
    const hline: HorizontalLineDrawing = { ...baseDrawing, type: 'horizontalLine', index: 3, price: 75 };
    expect(getHandlePoints(hline, mapper)).toEqual([{ x: 30, y: -75 }]);
  });

  it('returns 3 stacked points for longPosition (entry / SL / TP)', () => {
    const pos: LongPositionDrawing = {
      ...baseDrawing,
      type: 'longPosition',
      entryIndex: 7,
      entryPrice: 100,
      stopLossPrice: 90,
      takeProfitPrice: 120,
    };
    expect(getHandlePoints(pos, mapper)).toEqual([
      { x: 70, y: -100 },
      { x: 70, y: -90 },
      { x: 70, y: -120 },
    ]);
  });

  it('returns empty array for empty pencil', () => {
    const pencil: PencilDrawing = { ...baseDrawing, type: 'pencil', points: [] };
    expect(getHandlePoints(pencil, mapper)).toEqual([]);
  });
});

const makeMockCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
});

describe('renderDrawingHandles', () => {
  it('draws one circle per handle for two-point line', () => {
    const ctx = makeMockCtx();
    const line: LineDrawing = { ...baseDrawing, type: 'line', startIndex: 1, startPrice: 100, endIndex: 5, endPrice: 200 };
    renderDrawingHandles(ctx as unknown as CanvasRenderingContext2D, line, mapper);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });

  it('draws one circle for horizontal line', () => {
    const ctx = makeMockCtx();
    const hline: HorizontalLineDrawing = { ...baseDrawing, type: 'horizontalLine', index: 3, price: 75 };
    renderDrawingHandles(ctx as unknown as CanvasRenderingContext2D, hline, mapper);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });
});

describe('renderMagnetAnchors', () => {
  it('renders a smaller dot at every handle position', () => {
    const ctx = makeMockCtx();
    const line: LineDrawing = { ...baseDrawing, type: 'line', startIndex: 1, startPrice: 100, endIndex: 5, endPrice: 200 };
    renderMagnetAnchors(ctx as unknown as CanvasRenderingContext2D, line, mapper);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    // Anchor radius is 4 px (smaller than HANDLE_RADIUS=5)
    const arcCalls = ctx.arc.mock.calls as Array<[number, number, number, number, number]>;
    expect(arcCalls[0]?.[2]).toBe(4);
    expect(arcCalls[1]?.[2]).toBe(4);
  });

  it('uses gold/yellow accent color for magnet anchors', () => {
    const ctx = makeMockCtx();
    const line: LineDrawing = { ...baseDrawing, type: 'line', startIndex: 1, startPrice: 100, endIndex: 5, endPrice: 200 };
    renderMagnetAnchors(ctx as unknown as CanvasRenderingContext2D, line, mapper);
    expect(ctx.fillStyle).toMatch(/255,\s*196,\s*0/);
  });

  it('no-ops when the drawing has no handles', () => {
    const ctx = makeMockCtx();
    const empty: PencilDrawing = { ...baseDrawing, type: 'pencil', points: [] };
    renderMagnetAnchors(ctx as unknown as CanvasRenderingContext2D, empty, mapper);
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('renders 3 anchors for a long position (entry + SL + TP)', () => {
    const ctx = makeMockCtx();
    const pos: LongPositionDrawing = {
      ...baseDrawing,
      type: 'longPosition',
      entryIndex: 7,
      entryPrice: 100,
      stopLossPrice: 90,
      takeProfitPrice: 120,
    };
    renderMagnetAnchors(ctx as unknown as CanvasRenderingContext2D, pos, mapper);
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  it('always restores ctx state', () => {
    const ctx = makeMockCtx();
    const line: LineDrawing = { ...baseDrawing, type: 'line', startIndex: 1, startPrice: 100, endIndex: 5, endPrice: 200 };
    renderMagnetAnchors(ctx as unknown as CanvasRenderingContext2D, line, mapper);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});

describe('getHandlePoints — coverage of every handle category', () => {
  const cases: Array<[string, Drawing, number]> = [
    ['line', { ...baseDrawing, type: 'line', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as LineDrawing, 2],
    ['ruler', { ...baseDrawing, type: 'ruler', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['rectangle', { ...baseDrawing, type: 'rectangle', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['ellipse', { ...baseDrawing, type: 'ellipse', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['ray', { ...baseDrawing, type: 'ray', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['trendLine', { ...baseDrawing, type: 'trendLine', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['priceRange', { ...baseDrawing, type: 'priceRange', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['gannFan', { ...baseDrawing, type: 'gannFan', startIndex: 0, startPrice: 0, endIndex: 1, endPrice: 1 } as Drawing, 2],
    ['horizontalLine', { ...baseDrawing, type: 'horizontalLine', index: 0, price: 0 } as Drawing, 1],
    ['verticalLine', { ...baseDrawing, type: 'verticalLine', index: 0, price: 0 } as Drawing, 1],
  ];

  for (const [label, drawing, count] of cases) {
    it(`returns ${count} point(s) for ${label}`, () => {
      expect(getHandlePoints(drawing, mapper)).toHaveLength(count);
    });
  }
});
