import type { RectangleDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';

export const renderRectangle = (
  ctx: CanvasRenderingContext2D,
  drawing: RectangleDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  ctx.save();
  ctx.fillStyle = 'rgba(156, 39, 176, 0.08)';
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : DRAWING_COLORS.rectangle;
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.strokeRect(left, top, w, h);
  ctx.restore();
};
