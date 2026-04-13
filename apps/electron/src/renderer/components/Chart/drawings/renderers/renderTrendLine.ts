import type { TrendLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, extendLineToEdges, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';

export const renderTrendLine = (
  ctx: CanvasRenderingContext2D,
  drawing: TrendLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);
  const [lx, ly, rx, ry] = extendLineToEdges(x1, y1, x2, y2, chartWidth, chartHeight);

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.trendLine);
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.restore();
};
