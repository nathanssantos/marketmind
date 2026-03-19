import { HIT_THRESHOLD, HANDLE_HIT_RADIUS, PENCIL_HIT_THRESHOLD } from './constants';
import type { Drawing, CoordinateMapper, DrawingHandle } from './types';

export const pointToLineDistance = (
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;
  let xx: number, yy: number;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const pointInRect = (
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): boolean => {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
};

export const pointNearRectBorder = (
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
  threshold: number = HIT_THRESHOLD,
): boolean => {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (px < minX - threshold || px > maxX + threshold || py < minY - threshold || py > maxY + threshold) return false;

  const nearTop = Math.abs(py - minY) <= threshold && px >= minX - threshold && px <= maxX + threshold;
  const nearBottom = Math.abs(py - maxY) <= threshold && px >= minX - threshold && px <= maxX + threshold;
  const nearLeft = Math.abs(px - minX) <= threshold && py >= minY - threshold && py <= maxY + threshold;
  const nearRight = Math.abs(px - maxX) <= threshold && py >= minY - threshold && py <= maxY + threshold;

  return nearTop || nearBottom || nearLeft || nearRight;
};

export const pointNearPath = (
  px: number, py: number,
  points: Array<{ x: number; y: number }>,
  threshold: number = PENCIL_HIT_THRESHOLD,
): boolean => {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;
    if (pointToLineDistance(px, py, p1.x, p1.y, p2.x, p2.y) <= threshold) return true;
  }
  return false;
};

export const pointNearHandle = (
  px: number, py: number,
  hx: number, hy: number,
  radius: number = HANDLE_HIT_RADIUS,
): boolean => {
  const dx = px - hx;
  const dy = py - hy;
  return dx * dx + dy * dy <= radius * radius;
};

const getHandlesForDrawing = (drawing: Drawing, mapper: CoordinateMapper): DrawingHandle[] => {
  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'arrow':
    case 'rectangle':
    case 'area': {
      const sx = mapper.indexToCenterX(drawing.startIndex);
      const sy = mapper.priceToY(drawing.startPrice);
      const ex = mapper.indexToCenterX(drawing.endIndex);
      const ey = mapper.priceToY(drawing.endPrice);
      return [
        { drawingId: drawing.id, handleType: 'start', x: sx, y: sy },
        { drawingId: drawing.id, handleType: 'end', x: ex, y: ey },
      ];
    }
    case 'fibonacci': {
      const lowX = mapper.indexToCenterX(drawing.swingLowIndex);
      const lowY = mapper.priceToY(drawing.swingLowPrice);
      const highX = mapper.indexToCenterX(drawing.swingHighIndex);
      const highY = mapper.priceToY(drawing.swingHighPrice);
      return [
        { drawingId: drawing.id, handleType: 'swingLow', x: lowX, y: lowY },
        { drawingId: drawing.id, handleType: 'swingHigh', x: highX, y: highY },
      ];
    }
    case 'pencil': {
      if (drawing.points.length === 0) return [];
      const first = drawing.points[0]!;
      const last = drawing.points[drawing.points.length - 1]!;
      return [
        { drawingId: drawing.id, handleType: 'start', x: mapper.indexToCenterX(first.index), y: mapper.priceToY(first.price) },
        { drawingId: drawing.id, handleType: 'end', x: mapper.indexToCenterX(last.index), y: mapper.priceToY(last.price) },
      ];
    }
    case 'text': {
      const tx = mapper.indexToCenterX(drawing.index);
      const ty = mapper.priceToY(drawing.price);
      return [{ drawingId: drawing.id, handleType: 'start', x: tx, y: ty }];
    }
  }
};

export interface HitTestResult {
  drawingId: string;
  handleType: DrawingHandle['handleType'] | null;
  distance: number;
}

export const hitTestDrawing = (
  px: number, py: number,
  drawing: Drawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): HitTestResult | null => {
  if (!drawing.visible) return null;

  if (isSelected) {
    const handles = getHandlesForDrawing(drawing, mapper);
    for (const handle of handles) {
      if (pointNearHandle(px, py, handle.x, handle.y)) {
        return { drawingId: drawing.id, handleType: handle.handleType, distance: 0 };
      }
    }
  }

  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'arrow': {
      const sx = mapper.indexToCenterX(drawing.startIndex);
      const sy = mapper.priceToY(drawing.startPrice);
      const ex = mapper.indexToCenterX(drawing.endIndex);
      const ey = mapper.priceToY(drawing.endPrice);
      const dist = pointToLineDistance(px, py, sx, sy, ex, ey);
      if (dist <= HIT_THRESHOLD) return { drawingId: drawing.id, handleType: null, distance: dist };
      break;
    }
    case 'rectangle':
    case 'area': {
      const sx = mapper.indexToCenterX(drawing.startIndex);
      const sy = mapper.priceToY(drawing.startPrice);
      const ex = mapper.indexToCenterX(drawing.endIndex);
      const ey = mapper.priceToY(drawing.endPrice);
      if (pointInRect(px, py, sx, sy, ex, ey)) return { drawingId: drawing.id, handleType: 'body', distance: 0 };
      if (pointNearRectBorder(px, py, sx, sy, ex, ey)) return { drawingId: drawing.id, handleType: null, distance: 0 };
      break;
    }
    case 'pencil': {
      const screenPoints = drawing.points.map(p => ({
        x: mapper.indexToCenterX(p.index),
        y: mapper.priceToY(p.price),
      }));
      if (pointNearPath(px, py, screenPoints)) return { drawingId: drawing.id, handleType: null, distance: 0 };
      break;
    }
    case 'fibonacci': {
      const lowX = mapper.indexToCenterX(drawing.swingLowIndex);
      const lowY = mapper.priceToY(drawing.swingLowPrice);
      const highX = mapper.indexToCenterX(drawing.swingHighIndex);
      const highY = mapper.priceToY(drawing.swingHighPrice);
      const dist = pointToLineDistance(px, py, lowX, lowY, highX, highY);
      if (dist <= HIT_THRESHOLD) return { drawingId: drawing.id, handleType: null, distance: dist };

      for (const level of drawing.levels) {
        const y = mapper.priceToY(level.price);
        if (Math.abs(py - y) <= HIT_THRESHOLD) {
          const minLevelX = Math.min(lowX, highX);
          const maxLevelX = Math.max(lowX, highX);
          if (px >= minLevelX - 20 && px <= maxLevelX + 200) {
            return { drawingId: drawing.id, handleType: null, distance: Math.abs(py - y) };
          }
        }
      }
      break;
    }
    case 'text': {
      const tx = mapper.indexToCenterX(drawing.index);
      const ty = mapper.priceToY(drawing.price);
      const w = drawing.text.length * drawing.fontSize * 0.6;
      const h = drawing.fontSize * 1.2;
      if (pointInRect(px, py, tx, ty - h, tx + w, ty)) return { drawingId: drawing.id, handleType: 'body', distance: 0 };
      break;
    }
  }

  return null;
};

export const hitTestDrawings = (
  px: number, py: number,
  drawings: Drawing[],
  mapper: CoordinateMapper,
  selectedId: string | null,
): HitTestResult | null => {
  let bestResult: HitTestResult | null = null;

  const sorted = [...drawings].sort((a, b) => b.zIndex - a.zIndex);

  for (const drawing of sorted) {
    const result = hitTestDrawing(px, py, drawing, mapper, drawing.id === selectedId);
    if (!result) continue;

    if (result.handleType !== null && result.handleType !== 'body') return result;

    if (!bestResult || result.distance < bestResult.distance) {
      bestResult = result;
    }
  }

  return bestResult;
};
