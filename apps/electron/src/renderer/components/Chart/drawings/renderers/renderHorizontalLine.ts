import type { HorizontalLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

export const renderHorizontalLine = (
  ctx: CanvasRenderingContext2D,
  drawing: HorizontalLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
): void => {
  const y = mapper.priceToY(drawing.price);
  const gripX = mapper.indexToCenterX(drawing.index);

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.horizontalLine);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (isSelected) {
    ctx.fillStyle = DRAWING_COLORS.handle;
    ctx.strokeStyle = DRAWING_COLORS.handleStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gripX, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
};
