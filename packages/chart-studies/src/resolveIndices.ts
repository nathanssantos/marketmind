import type { Drawing, ChannelDrawing, PitchforkDrawing, PencilDrawing, HighlighterDrawing, FibonacciDrawing, TextDrawing, HorizontalLineDrawing, VerticalLineDrawing, LongPositionDrawing, ShortPositionDrawing } from './types';

interface KlineWithTime {
  openTime: number;
}

const TWO_POINT_TYPES = new Set(['line', 'ruler', 'rectangle', 'area', 'arrow', 'ray', 'trendLine', 'priceRange', 'ellipse', 'gannFan']);
const THREE_POINT_TYPES = new Set(['channel', 'pitchfork']);
const FREEFORM_TYPES = new Set(['pencil', 'highlighter']);
const SINGLE_POINT_TYPES = new Set(['horizontalLine', 'verticalLine']);

export const resolveDrawingIndices = (drawing: Drawing, klines: KlineWithTime[]): Drawing => {
  if (klines.length === 0) return drawing;

  // Exact-match only: when `time` isn't present in the current klines
  // (e.g. pagination hasn't reached far enough yet, or hydration ran
  // mid-stream against a partial window), return the stored fallback
  // index instead of snapping silently to the nearest neighbour. A
  // snapped index becomes a sticky lie — the drawing renders at a
  // bar that has nothing to do with the user's anchor, and the user
  // sees the line "jump" relative to its original time. The renderer
  // re-runs this resolution every time the klines array shifts, so
  // dropping back to `fallbackIdx` for one frame is fine; once the
  // real bar is loaded the exact-match branch wins and the drawing
  // re-anchors to its true position.
  const timeToIdx = (time: number | undefined, fallbackIdx: number): number => {
    if (time === undefined) return fallbackIdx;
    let lo = 0;
    let hi = klines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const mt = klines[mid]?.openTime ?? 0;
      if (mt < time) lo = mid + 1;
      else if (mt > time) hi = mid - 1;
      else return mid;
    }
    return fallbackIdx;
  };

  if (TWO_POINT_TYPES.has(drawing.type)) {
    const d = drawing as Drawing & { startIndex: number; endIndex: number; startTime?: number; endTime?: number };
    if (!d.startTime && !d.endTime) return drawing;
    return { ...d, startIndex: timeToIdx(d.startTime, d.startIndex), endIndex: timeToIdx(d.endTime, d.endIndex) } as Drawing;
  }

  if (THREE_POINT_TYPES.has(drawing.type)) {
    const d = drawing as ChannelDrawing | PitchforkDrawing;
    if (!d.startTime && !d.endTime && !d.widthTime) return drawing;
    return { ...d, startIndex: timeToIdx(d.startTime, d.startIndex), endIndex: timeToIdx(d.endTime, d.endIndex), widthIndex: timeToIdx(d.widthTime, d.widthIndex) };
  }

  if (FREEFORM_TYPES.has(drawing.type)) {
    const d = drawing as PencilDrawing | HighlighterDrawing;
    if (!d.points.some(p => p.time !== undefined)) return drawing;
    return {
      ...d,
      points: d.points.map(p => {
        if (p.time === undefined) return p;
        const intPart = Math.floor(p.index);
        const frac = p.index - intPart;
        const baseIdx = timeToIdx(p.time, intPart);
        return { ...p, index: baseIdx + frac };
      }),
    };
  }

  if (SINGLE_POINT_TYPES.has(drawing.type)) {
    const d = drawing as HorizontalLineDrawing | VerticalLineDrawing;
    if (!d.time) return drawing;
    return { ...d, index: timeToIdx(d.time, d.index) };
  }

  if (drawing.type === 'fibonacci') {
    const d = drawing as FibonacciDrawing;
    if (!d.swingLowTime && !d.swingHighTime) return drawing;
    return { ...d, swingLowIndex: timeToIdx(d.swingLowTime, d.swingLowIndex), swingHighIndex: timeToIdx(d.swingHighTime, d.swingHighIndex) };
  }

  if (drawing.type === 'text') {
    const d = drawing as TextDrawing;
    if (!d.time) return drawing;
    return { ...d, index: timeToIdx(d.time, d.index) };
  }

  if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
    const d = drawing as LongPositionDrawing | ShortPositionDrawing;
    if (!d.entryTime) return drawing;
    return { ...d, entryIndex: timeToIdx(d.entryTime, d.entryIndex) };
  }

  return drawing;
};
