import type { LineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';

export const renderLine = (
  ctx: CanvasRenderingContext2D,
  drawing: LineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.line);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
};
