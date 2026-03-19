import type { LineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

export const renderLine = (
  ctx: CanvasRenderingContext2D,
  drawing: LineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.line);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
};
