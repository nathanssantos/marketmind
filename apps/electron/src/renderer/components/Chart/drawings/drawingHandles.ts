import type { Drawing, CoordinateMapper, ChannelDrawing, PitchforkDrawing, PencilDrawing, HighlighterDrawing } from '@marketmind/chart-studies';
import { HANDLE_RADIUS, DRAWING_COLORS } from '@marketmind/chart-studies';

const FULL_CIRCLE = Math.PI * 2;
const MAGNET_ANCHOR_RADIUS = 4;

export interface HandlePoint {
  x: number;
  y: number;
}

const TWO_POINT_HANDLE_TYPES = new Set(['line', 'ruler', 'arrow', 'rectangle', 'area', 'ray', 'trendLine', 'priceRange', 'ellipse', 'gannFan']);
const THREE_POINT_HANDLE_TYPES = new Set(['channel', 'pitchfork']);
const FREEFORM_HANDLE_TYPES = new Set(['pencil', 'highlighter']);
const SINGLE_POINT_HANDLE_TYPES = new Set(['text', 'horizontalLine', 'verticalLine', 'anchoredVwap']);

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
    const d = drawing as Drawing & { startIndex: number; startPrice: number; endIndex: number; endPrice: number };
    return [
      { x: mapper.indexToCenterX(d.startIndex), y: mapper.priceToY(d.startPrice) },
      { x: mapper.indexToCenterX(d.endIndex), y: mapper.priceToY(d.endPrice) },
    ];
  }

  if (THREE_POINT_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as ChannelDrawing | PitchforkDrawing;
    return [
      { x: mapper.indexToCenterX(d.startIndex), y: mapper.priceToY(d.startPrice) },
      { x: mapper.indexToCenterX(d.endIndex), y: mapper.priceToY(d.endPrice) },
      { x: mapper.indexToCenterX(d.widthIndex), y: mapper.priceToY(d.widthPrice) },
    ];
  }

  if (drawing.type === 'fibonacci') {
    const d = drawing;
    return [
      { x: mapper.indexToCenterX(d.swingLowIndex), y: mapper.priceToY(d.swingLowPrice) },
      { x: mapper.indexToCenterX(d.swingHighIndex), y: mapper.priceToY(d.swingHighPrice) },
    ];
  }

  if (FREEFORM_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as PencilDrawing | HighlighterDrawing;
    if (d.points.length === 0) return [];
    const first = d.points[0]!;
    const last = d.points[d.points.length - 1]!;
    return [
      { x: mapper.indexToCenterX(first.index), y: mapper.priceToY(first.price) },
      { x: mapper.indexToCenterX(last.index), y: mapper.priceToY(last.price) },
    ];
  }

  if (SINGLE_POINT_HANDLE_TYPES.has(drawing.type)) {
    const d = drawing as Drawing & { index: number; price: number };
    return [{ x: mapper.indexToCenterX(d.index), y: mapper.priceToY(d.price) }];
  }

  if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
    const d = drawing;
    const x = mapper.indexToCenterX(d.entryIndex);
    return [
      { x, y: mapper.priceToY(d.entryPrice) },
      { x, y: mapper.priceToY(d.stopLossPrice) },
      { x, y: mapper.priceToY(d.takeProfitPrice) },
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
