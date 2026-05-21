import type { Drawing, CoordinateMapper, ChannelDrawing, PitchforkDrawing, PencilDrawing, HighlighterDrawing } from '@marketmind/chart-studies';
import { HANDLE_RADIUS, DRAWING_COLORS, resolveDrawingIndex } from '@marketmind/chart-studies';

const xAt = (
  mapper: CoordinateMapper,
  index: number,
  time: number | undefined,
): number => mapper.indexToCenterX(resolveDrawingIndex(index, time, mapper));

const FULL_CIRCLE = Math.PI * 2;
const MAGNET_ANCHOR_RADIUS = 4;

export interface HandlePoint {
  x: number;
  y: number;
  /**
   * Source kline index for this handle, copied straight from the
   * drawing field that owns it (e.g. `startIndex` for line-start,
   * `swingLowIndex` for fib, `entryIndex` for position). The magnet
   * uses this directly instead of reverse-mapping `x` back through
   * `xToIndex` — the inverse adds a +0.5 bar offset that turns an
   * exact integer index like `10` into `10.5`, so a snap "to" an
   * existing endpoint would actually land half a bar off. Preserving
   * the source value lets two drawings stack on the same magnet
   * target with identical anchor coordinates.
   */
  index: number;
  price: number;
  time?: number;
}

const TWO_POINT_HANDLE_TYPES = new Set(['line', 'ruler', 'arrow', 'rectangle', 'area', 'ray', 'trendLine', 'priceRange', 'ellipse', 'gannFan']);
const THREE_POINT_HANDLE_TYPES = new Set(['channel', 'pitchfork']);
const FREEFORM_HANDLE_TYPES = new Set(['pencil', 'highlighter']);
const SINGLE_POINT_HANDLE_TYPES = new Set(['text', 'horizontalLine', 'verticalLine']);

/**
 * Returns canvas-space coordinates for every interaction handle on the
 * drawing — corners, endpoints, freeform polyline ends, etc. Stable
 * order: same handle index always represents the same logical anchor
 * across drag updates and renders. Exported so other features (magnet
 * anchor render, hit-test debug overlays, future alert anchors) can
 * reuse the same geometry without redefining the per-type switch.
 */
export const getHandlePoints = (drawing: Drawing, mapper: CoordinateMapper): HandlePoint[] => {
  if (TWO_POINT_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as Drawing & { startIndex: number; startPrice: number; endIndex: number; endPrice: number; startTime?: number; endTime?: number };
    return [
      { x: xAt(mapper, d.startIndex, d.startTime), y: mapper.priceToY(d.startPrice), index: d.startIndex, price: d.startPrice, time: d.startTime },
      { x: xAt(mapper, d.endIndex, d.endTime), y: mapper.priceToY(d.endPrice), index: d.endIndex, price: d.endPrice, time: d.endTime },
    ];
  }

  if (THREE_POINT_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as ChannelDrawing | PitchforkDrawing;
    return [
      { x: xAt(mapper, d.startIndex, d.startTime), y: mapper.priceToY(d.startPrice), index: d.startIndex, price: d.startPrice, time: d.startTime },
      { x: xAt(mapper, d.endIndex, d.endTime), y: mapper.priceToY(d.endPrice), index: d.endIndex, price: d.endPrice, time: d.endTime },
      { x: xAt(mapper, d.widthIndex, d.widthTime), y: mapper.priceToY(d.widthPrice), index: d.widthIndex, price: d.widthPrice, time: d.widthTime },
    ];
  }

  if (drawing.type === 'fibonacci') {
    const d = drawing;
    return [
      { x: xAt(mapper, d.swingLowIndex, d.swingLowTime), y: mapper.priceToY(d.swingLowPrice), index: d.swingLowIndex, price: d.swingLowPrice, time: d.swingLowTime },
      { x: xAt(mapper, d.swingHighIndex, d.swingHighTime), y: mapper.priceToY(d.swingHighPrice), index: d.swingHighIndex, price: d.swingHighPrice, time: d.swingHighTime },
    ];
  }

  if (FREEFORM_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as PencilDrawing | HighlighterDrawing;
    if (d.points.length === 0) return [];
    const first = d.points[0]!;
    const last = d.points[d.points.length - 1]!;
    return [
      { x: xAt(mapper, first.index, first.time), y: mapper.priceToY(first.price), index: first.index, price: first.price, time: first.time },
      { x: xAt(mapper, last.index, last.time), y: mapper.priceToY(last.price), index: last.index, price: last.price, time: last.time },
    ];
  }

  if (SINGLE_POINT_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as Drawing & { index: number; price: number; time?: number };
    return [{ x: xAt(mapper, d.index, d.time), y: mapper.priceToY(d.price), index: d.index, price: d.price, time: d.time }];
  }

  if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
    const d = drawing;
    const x = xAt(mapper, d.entryIndex, d.entryTime);
    return [
      { x, y: mapper.priceToY(d.entryPrice), index: d.entryIndex, price: d.entryPrice, time: d.entryTime },
      { x, y: mapper.priceToY(d.stopLossPrice), index: d.entryIndex, price: d.stopLossPrice, time: d.entryTime },
      { x, y: mapper.priceToY(d.takeProfitPrice), index: d.entryIndex, price: d.takeProfitPrice, time: d.entryTime },
    ];
  }

  return [];
};

export const renderDrawingHandles = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  mapper: CoordinateMapper,
): void => {
  const points = getHandlePoints(drawing, mapper);

  ctx.save();
  for (const pt of points) {
    ctx.fillStyle = DRAWING_COLORS.handle;
    ctx.strokeStyle = DRAWING_COLORS.handleStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, HANDLE_RADIUS, 0, FULL_CIRCLE);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Renders accent dots at every drawing handle to flag them as
 * magnet-snap anchors when the magnet feature is on. Visually distinct
 * from the regular selection handles (smaller, lower-opacity gold) so
 * the user can tell at a glance "this point is where my next click
 * will snap when magnet is active". Caller is responsible for
 * checking `magnetEnabled` — this function always renders.
 */
export const renderMagnetAnchors = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  mapper: CoordinateMapper,
): void => {
  const points = getHandlePoints(drawing, mapper);
  if (points.length === 0) return;

  ctx.save();
  ctx.fillStyle = DRAWING_COLORS.magnetAnchor ?? 'rgba(255, 196, 0, 0.85)';
  ctx.strokeStyle = DRAWING_COLORS.magnetAnchorStroke ?? 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, MAGNET_ANCHOR_RADIUS, 0, FULL_CIRCLE);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};
