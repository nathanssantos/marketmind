import type { PencilDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';

export const renderPencil = (
  ctx: CanvasRenderingContext2D,
  drawing: PencilDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  if (drawing.points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : DRAWING_COLORS.pencil;
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const first = drawing.points[0]!;
  ctx.moveTo(mapper.indexToCenterX(first.index), mapper.priceToY(first.price));

  for (let i = 1; i < drawing.points.length; i++) {
    const pt = drawing.points[i]!;
    ctx.lineTo(mapper.indexToCenterX(pt.index), mapper.priceToY(pt.price));
  }

  ctx.stroke();
  ctx.restore();
};
