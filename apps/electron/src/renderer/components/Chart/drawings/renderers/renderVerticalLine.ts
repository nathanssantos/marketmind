import type { VerticalLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

export const renderVerticalLine = (
  ctx: CanvasRenderingContext2D,
  drawing: VerticalLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartHeight: number,
): void => {
  const x = mapper.indexToCenterX(drawing.index);
  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.verticalLine);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, chartHeight);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};
