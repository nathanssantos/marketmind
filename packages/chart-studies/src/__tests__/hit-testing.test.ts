import { describe, it, expect } from 'vitest';
import {
  pointToLineDistance,
  pointInRect,
  pointNearRectBorder,
  pointNearPath,
  pointNearHandle,
  hitTestDrawing,
  hitTestDrawings,
} from '../hit-testing';
import type { Drawing, CoordinateMapper, LineDrawing, RectangleDrawing, PencilDrawing, FibonacciDrawing, TrendLineDrawing, VerticalLineDrawing, EllipseDrawing, PitchforkDrawing, GannFanDrawing, HighlighterDrawing } from '../types';

const createMapper = (): CoordinateMapper => ({
  priceToY: (price: number) => 1000 - price,
  yToPrice: (y: number) => 1000 - y,
  indexToX: (index: number) => index * 10,
  xToIndex: (x: number) => Math.floor(x / 10),
  indexToCenterX: (index: number) => index * 10 + 5,
});

const baseDrawing = {
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visible: true,
  locked: false,
  zIndex: 0,
};

describe('pointToLineDistance', () => {
  it('returns 0 for point on line', () => {
    expect(pointToLineDistance(5, 5, 0, 0, 10, 10)).toBeCloseTo(0, 5);
  });

  it('returns correct distance for perpendicular point', () => {
    const dist = pointToLineDistance(5, 0, 0, 5, 10, 5);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('returns distance to nearest endpoint when projection falls outside segment', () => {
    const dist = pointToLineDistance(-5, 0, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('handles zero-length segment', () => {
    const dist = pointToLineDistance(3, 4, 0, 0, 0, 0);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('returns correct distance for horizontal line', () => {
    const dist = pointToLineDistance(5, 3, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(3, 5);
  });

  it('returns correct distance for vertical line', () => {
    const dist = pointToLineDistance(3, 5, 0, 0, 0, 10);
    expect(dist).toBeCloseTo(3, 5);
  });
});

describe('pointInRect', () => {
  it('returns true for point inside', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(pointInRect(0, 5, 0, 0, 10, 10)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInRect(15, 5, 0, 0, 10, 10)).toBe(false);
  });

  it('handles inverted coordinates', () => {
    expect(pointInRect(5, 5, 10, 10, 0, 0)).toBe(true);
  });
});

describe('pointNearRectBorder', () => {
  it('returns true near top edge', () => {
    expect(pointNearRectBorder(50, 2, 0, 0, 100, 100, 5)).toBe(true);
  });

  it('returns false far from edges', () => {
    expect(pointNearRectBorder(50, 50, 0, 0, 100, 100, 5)).toBe(false);
  });

  it('returns true near corner', () => {
    expect(pointNearRectBorder(1, 1, 0, 0, 100, 100, 5)).toBe(true);
  });
});

describe('pointNearPath', () => {
  it('returns true for point near path segment', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(pointNearPath(50, 3, points, 5)).toBe(true);
  });

  it('returns false for point far from path', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(pointNearPath(50, 20, points, 5)).toBe(false);
  });

  it('handles empty path', () => {
    expect(pointNearPath(0, 0, [], 5)).toBe(false);
  });

  it('handles single point path', () => {
    expect(pointNearPath(0, 0, [{ x: 0, y: 0 }], 5)).toBe(false);
  });
});

describe('pointNearHandle', () => {
  it('returns true for point at handle center', () => {
    expect(pointNearHandle(10, 10, 10, 10)).toBe(true);
  });

  it('returns true for point within radius', () => {
    expect(pointNearHandle(12, 10, 10, 10, 5)).toBe(true);
  });

  it('returns false for point outside radius', () => {
    expect(pointNearHandle(20, 10, 10, 10, 5)).toBe(false);
  });
});

describe('hitTestDrawing', () => {
  const mapper = createMapper();

  it('returns null for invisible drawing', () => {
    const drawing: LineDrawing = {
      ...baseDrawing, id: '1', type: 'line',
      startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 200, visible: false,
    };
    expect(hitTestDrawing(50, 850, drawing, mapper, false)).toBeNull();
  });

  it('detects line drawing hit', () => {
    const drawing: LineDrawing = {
      ...baseDrawing, id: '1', type: 'line',
      startIndex: 0, startPrice: 500, endIndex: 10, endPrice: 500,
    };
    const result = hitTestDrawing(55, 500, drawing, mapper, false);
    expect(result).not.toBeNull();
    expect(result!.drawingId).toBe('1');
  });

  it('detects rectangle drawing body hit', () => {
    const drawing: RectangleDrawing = {
      ...baseDrawing, id: '2', type: 'rectangle',
      startIndex: 0, startPrice: 600, endIndex: 10, endPrice: 400,
    };
    const result = hitTestDrawing(55, 500, drawing, mapper, false);
    expect(result).not.toBeNull();
    expect(result!.handleType).toBe('body');
  });

  it('detects handle hit on selected drawing', () => {
    const drawing: LineDrawing = {
      ...baseDrawing, id: '3', type: 'line',
      startIndex: 5, startPrice: 500, endIndex: 15, endPrice: 500,
    };
    const startX = mapper.indexToCenterX(5);
    const startY = mapper.priceToY(500);
    const result = hitTestDrawing(startX, startY, drawing, mapper, true);
    expect(result).not.toBeNull();
    expect(result!.handleType).toBe('start');
  });

  it('detects pencil drawing hit', () => {
    const drawing: PencilDrawing = {
      ...baseDrawing, id: '4', type: 'pencil',
      points: [
        { index: 0, price: 500 },
        { index: 5, price: 600 },
        { index: 10, price: 500 },
      ],
    };
    const midX = mapper.indexToCenterX(2);
    const midY = mapper.priceToY(540);
    const result = hitTestDrawing(midX, midY, drawing, mapper, false);
    expect(result).not.toBeNull();
  });

  it('detects fibonacci swing line hit', () => {
    const drawing: FibonacciDrawing = {
      ...baseDrawing, id: '5', type: 'fibonacci',
      swingLowIndex: 0, swingLowPrice: 400,
      swingHighIndex: 10, swingHighPrice: 600,
      direction: 'up', levels: [],
    };
    const midX = mapper.indexToCenterX(5);
    const midY = mapper.priceToY(500);
    const result = hitTestDrawing(midX, midY, drawing, mapper, false);
    expect(result).not.toBeNull();
  });
});

describe('hitTestDrawings', () => {
  const mapper = createMapper();

  it('returns null when no drawings hit', () => {
    const drawings: Drawing[] = [{
      ...baseDrawing, id: '1', type: 'line',
      startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 100,
    }];
    expect(hitTestDrawings(500, 500, drawings, mapper, null)).toBeNull();
  });

  it('prioritizes handle hits over body hits', () => {
    const drawing: LineDrawing = {
      ...baseDrawing, id: '1', type: 'line',
      startIndex: 5, startPrice: 500, endIndex: 15, endPrice: 500,
    };
    const startX = mapper.indexToCenterX(5);
    const startY = mapper.priceToY(500);
    const result = hitTestDrawings(startX, startY, [drawing], mapper, '1');
    expect(result).not.toBeNull();
    expect(result!.handleType).toBe('start');
  });

  it('returns closest drawing when multiple hit', () => {
    const line1: LineDrawing = {
      ...baseDrawing, id: '1', type: 'line', zIndex: 0,
      startIndex: 0, startPrice: 500, endIndex: 20, endPrice: 500,
    };
    const line2: LineDrawing = {
      ...baseDrawing, id: '2', type: 'line', zIndex: 1,
      startIndex: 0, startPrice: 506, endIndex: 20, endPrice: 506,
    };
    const result = hitTestDrawings(55, 501, [line1, line2], mapper, null);
    expect(result).not.toBeNull();
    expect(result!.drawingId).toBe('1');
  });
});

describe('hitTestDrawing - new types', () => {
  const mapper = createMapper();

  it('detects trendLine hit (infinite line)', () => {
    const drawing: TrendLineDrawing = {
      ...baseDrawing, id: 't1', type: 'trendLine',
      startIndex: 0, startPrice: 500, endIndex: 10, endPrice: 500,
    };
    const result = hitTestDrawing(55, 500, drawing, mapper, false);
    expect(result).not.toBeNull();
    expect(result!.drawingId).toBe('t1');
  });

  it('detects trendLine hit beyond segment endpoints', () => {
    const drawing: TrendLineDrawing = {
      ...baseDrawing, id: 't2', type: 'trendLine',
      startIndex: 5, startPrice: 500, endIndex: 10, endPrice: 500,
    };
    const result = hitTestDrawing(155, 500, drawing, mapper, false);
    expect(result).not.toBeNull();
  });

  it('detects verticalLine hit', () => {
    const drawing: VerticalLineDrawing = {
      ...baseDrawing, id: 'v1', type: 'verticalLine',
      index: 10, price: 500,
    };
    const x = mapper.indexToCenterX(10);
    const result = hitTestDrawing(x + 2, 300, drawing, mapper, false);
    expect(result).not.toBeNull();
    expect(result!.drawingId).toBe('v1');
  });

  it('misses verticalLine when far away', () => {
    const drawing: VerticalLineDrawing = {
      ...baseDrawing, id: 'v2', type: 'verticalLine',
      index: 10, price: 500,
    };
    const result = hitTestDrawing(200, 300, drawing, mapper, false);
    expect(result).toBeNull();
  });

  it('detects ellipse body hit', () => {
    const drawing: EllipseDrawing = {
      ...baseDrawing, id: 'e1', type: 'ellipse',
      startIndex: 0, startPrice: 600, endIndex: 10, endPrice: 400,
    };
    const result = hitTestDrawing(55, 500, drawing, mapper, false);
    expect(result).not.toBeNull();
    expect(result!.handleType).toBe('body');
  });

  it('detects highlighter hit', () => {
    const drawing: HighlighterDrawing = {
      ...baseDrawing, id: 'h1', type: 'highlighter',
      points: [{ index: 0, price: 500 }, { index: 5, price: 600 }, { index: 10, price: 500 }],
    };
    const midX = mapper.indexToCenterX(2);
    const midY = mapper.priceToY(540);
    const result = hitTestDrawing(midX, midY, drawing, mapper, false);
    expect(result).not.toBeNull();
  });

  it('detects pitchfork median line hit', () => {
    const drawing: PitchforkDrawing = {
      ...baseDrawing, id: 'p1', type: 'pitchfork',
      startIndex: 0, startPrice: 500,
      endIndex: 10, endPrice: 400,
      widthIndex: 10, widthPrice: 600,
    };
    const mx = mapper.indexToCenterX(5);
    const my = mapper.priceToY(500);
    const result = hitTestDrawing(mx, my, drawing, mapper, false);
    expect(result).not.toBeNull();
  });

  it('detects gannFan 1x1 line hit', () => {
    const drawing: GannFanDrawing = {
      ...baseDrawing, id: 'g1', type: 'gannFan',
      startIndex: 0, startPrice: 500, endIndex: 10, endPrice: 600,
    };
    const ox = mapper.indexToCenterX(0);
    const oy = mapper.priceToY(500);
    const rx = mapper.indexToCenterX(10);
    const ry = mapper.priceToY(600);
    const midX = (ox + rx) / 2;
    const midY = (oy + ry) / 2;
    const result = hitTestDrawing(midX, midY, drawing, mapper, false);
    expect(result).not.toBeNull();
  });
});
