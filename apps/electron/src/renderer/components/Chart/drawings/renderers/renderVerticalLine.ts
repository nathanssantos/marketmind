import type { VerticalLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle } from '@renderer/utils/canvas/canvasHelpers';
import { LINE_DASHES } from '@shared/constants';

export const renderVerticalLine = (
  ctx: CanvasRenderingContext2D,
  drawing: VerticalLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartHeight: number,
): void => {
  const x = mapper.indexToCenterX(drawing.index);
  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.verticalLine);
  ctx.setLineDash([...LINE_DASHES.STANDARD]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, chartHeight);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};
