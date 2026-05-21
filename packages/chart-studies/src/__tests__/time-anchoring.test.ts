import { describe, it, expect } from 'vitest';
import { resolveDrawingIndex } from '../resolveIndex';
import { hitTestDrawing } from '../hit-testing';
import { resolveDrawingIndices } from '../resolveIndices';
import type { CoordinateMapper, LineDrawing } from '../types';

interface MapperKline { openTime: number }

const BAR_PX = 10;
const ORIGIN_X = 5; // indexToCenterX is `i * BAR_PX + ORIGIN_X` so bar `i` sits at `i*10 + 5`

// Mapper that mimics the real CanvasManager: viewport is anchored to
// array index (not absolute time), so when klines shift the same on-screen
// position corresponds to a different array index. Drawings anchored by
// `*Time` must re-resolve to the new index, otherwise they drift.
const mapperFor = (klines: MapperKline[]): CoordinateMapper => {
  const timeToIdx = (t: number): number => {
    for (let i = 0; i < klines.length; i++) if (klines[i]!.openTime === t) return i;
    return -1;
  };
  return {
    priceToY: (p: number) => 1000 - p,
    yToPrice: (y: number) => 1000 - y,
    indexToX: (i: number) => i * BAR_PX,
    xToIndex: (x: number) => Math.floor(x / BAR_PX),
    indexToCenterX: (i: number) => i * BAR_PX + ORIGIN_X,
    timeToIndex: timeToIdx,
    getKlineTime: (i: number) => klines[i]?.openTime,
  };
};

const klinesFrom = (firstTime: number, count: number, step = 60_000): MapperKline[] =>
  Array.from({ length: count }, (_, i) => ({ openTime: firstTime + i * step }));

const baseDrawing = {
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
};

describe('resolveDrawingIndex (per-frame anchor resolver)', () => {
  it('prefers time-resolved index over the stored index when both are present', () => {
    // Saved when array started at T0. Stored index=5 reflected T0+5*step.
    const T0 = 1_700_000_000_000;
    const storedTime = T0 + 5 * 60_000;

    // Reloaded array starts at T0 - 3 bars. The same `time` now lives at index 8.
    const klines = klinesFrom(T0 - 3 * 60_000, 50);
    const mapper = mapperFor(klines);

    expect(resolveDrawingIndex(5, storedTime, mapper)).toBe(8);
  });

  it('falls back to stored index when the stored time is not in the loaded klines', () => {
    // Drawing made on an old bar that hasn't paginated in yet.
    const T0 = 1_700_000_000_000;
    const klines = klinesFrom(T0, 10);
    const mapper = mapperFor(klines);

    const farPastTime = T0 - 1_000_000_000;
    expect(resolveDrawingIndex(42, farPastTime, mapper)).toBe(42);
  });

  it('falls back to stored index when storedTime is undefined (legacy drawing)', () => {
    const klines = klinesFrom(1_700_000_000_000, 10);
    const mapper = mapperFor(klines);
    expect(resolveDrawingIndex(3, undefined, mapper)).toBe(3);
  });

  it('falls back to stored index when mapper has no klines yet', () => {
    const mapper = mapperFor([]);
    expect(resolveDrawingIndex(7, 1_700_000_000_000, mapper)).toBe(7);
  });
});

describe('hit-testing follows the time-resolved position after array shift', () => {
  // Reproduces the "drawing shifts a bit when I switch tabs / reload" bug:
  // a line saved against array [k0..k49] but rehydrated against [k-3..k46]
  // (older bars prepended). With time-anchoring the line stays at its
  // original timestamp, so the click target moves WITH the rendered line
  // instead of staying glued to the stale stored index.
  const T0 = 1_700_000_000_000;
  const startTime = T0 + 5 * 60_000;
  const endTime = T0 + 15 * 60_000;

  const line: LineDrawing = {
    ...baseDrawing,
    id: 'line-1',
    type: 'line',
    startIndex: 5, startPrice: 500, // saved values
    endIndex: 15, endPrice: 700,
    startTime, endTime,
  };

  it('original window: hit-test lands on the stored-index position', () => {
    const klines = klinesFrom(T0, 50);
    const mapper = mapperFor(klines);
    // Bar 5 sits at x = 5*10 + 5 = 55. Click directly on it.
    const result = hitTestDrawing(55, 1000 - 500, line, mapper, false);
    expect(result?.drawingId).toBe('line-1');
  });

  it('after pagination prepends 3 bars: hit-test follows time, not index', () => {
    const klines = klinesFrom(T0 - 3 * 60_000, 53);
    const mapper = mapperFor(klines);
    // The line's startTime now lives at index 8, so the on-screen X is
    // 8*10 + 5 = 85. The stored startIndex (5) would put it at x=55 —
    // clicking there must NOT hit the line; clicking at 85 must.
    expect(hitTestDrawing(55, 1000 - 500, line, mapper, false)).toBeNull();
    expect(hitTestDrawing(85, 1000 - 500, line, mapper, false)?.drawingId).toBe('line-1');
  });
});

describe('resolveDrawingIndices (bulk-resolve)', () => {
  // The bulk-resolve in useDrawingsRenderer used to snap silently to bar 0
  // or N-1 when the stored time was out of range. That snap was the visible
  // "drift" — the drawing would appear at a wrong bar instead of staying
  // hidden until its bar paginates in. Now it falls back to the stored
  // index, which the renderer's per-frame `resolveDrawingIndex` then keeps
  // intact while time is out of range.
  it('returns the stored index when the time is older than every loaded kline', () => {
    const T0 = 1_700_000_000_000;
    const klines = klinesFrom(T0, 10);
    const farPast = T0 - 100 * 60_000;

    const drawing: LineDrawing = {
      ...baseDrawing,
      id: 'old-line', type: 'line',
      startIndex: 99, startPrice: 100, // sentinel that proves we kept the stored idx
      endIndex: 100, endPrice: 200,
      startTime: farPast, endTime: farPast + 60_000,
    };

    const resolved = resolveDrawingIndices(drawing, klines) as LineDrawing;
    expect(resolved.startIndex).toBe(99);
    expect(resolved.endIndex).toBe(100);
  });

  it('resolves correctly when the stored time IS present (exact match)', () => {
    const T0 = 1_700_000_000_000;
    const klines = klinesFrom(T0, 30);
    const drawing: LineDrawing = {
      ...baseDrawing,
      id: 'line', type: 'line',
      startIndex: 0, startPrice: 100,
      endIndex: 0, endPrice: 200,
      startTime: T0 + 7 * 60_000,
      endTime: T0 + 12 * 60_000,
    };

    const resolved = resolveDrawingIndices(drawing, klines) as LineDrawing;
    expect(resolved.startIndex).toBe(7);
    expect(resolved.endIndex).toBe(12);
  });
});
