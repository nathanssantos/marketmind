import type { PencilDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, resolveDrawingIndex } from '@renderer/utils/canvas/canvasHelpers';

export const renderPencil = (
  ctx: CanvasRenderingContext2D,
  drawing: PencilDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  if (drawing.points.length < 2) return;

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.pencil);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const xAt = (p: { index: number; time?: number }) =>
    mapper.indexToCenterX(resolveDrawingIndex(p.index, p.time, mapper));

  const first = drawing.points[0]!;
  const x0 = xAt(first);
  const y0 = mapper.priceToY(first.price);
  ctx.moveTo(x0, y0);

  for (let i = 1; i < drawing.points.length - 1; i++) {
    const cur = drawing.points[i]!;
    const next = drawing.points[i + 1]!;
    const cx = xAt(cur);
    const cy = mapper.priceToY(cur.price);
    const nx = xAt(next);
    const ny = mapper.priceToY(next.price);
    ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }

  const last = drawing.points[drawing.points.length - 1]!;
  ctx.lineTo(xAt(last), mapper.priceToY(last.price));

  ctx.stroke();
  ctx.restore();
};
