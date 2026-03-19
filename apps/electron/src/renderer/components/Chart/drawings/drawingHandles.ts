import type { Drawing, CoordinateMapper } from '@marketmind/chart-studies';
import { HANDLE_RADIUS, DRAWING_COLORS } from '@marketmind/chart-studies';

const FULL_CIRCLE = Math.PI * 2;

interface HandlePoint {
  x: number;
  y: number;
}

const getHandlePoints = (drawing: Drawing, mapper: CoordinateMapper): HandlePoint[] => {
  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'arrow':
    case 'rectangle':
    case 'area':
      return [
        { x: mapper.indexToCenterX(drawing.startIndex), y: mapper.priceToY(drawing.startPrice) },
        { x: mapper.indexToCenterX(drawing.endIndex), y: mapper.priceToY(drawing.endPrice) },
      ];
    case 'fibonacci':
      return [
        { x: mapper.indexToCenterX(drawing.swingLowIndex), y: mapper.priceToY(drawing.swingLowPrice) },
        { x: mapper.indexToCenterX(drawing.swingHighIndex), y: mapper.priceToY(drawing.swingHighPrice) },
      ];
    case 'pencil': {
      if (drawing.points.length === 0) return [];
      const first = drawing.points[0]!;
      const last = drawing.points[drawing.points.length - 1]!;
      return [
        { x: mapper.indexToCenterX(first.index), y: mapper.priceToY(first.price) },
        { x: mapper.indexToCenterX(last.index), y: mapper.priceToY(last.price) },
      ];
    }
    case 'text':
      return [{ x: mapper.indexToCenterX(drawing.index), y: mapper.priceToY(drawing.price) }];
  }
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
