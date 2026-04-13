import type { HorizontalLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle } from '@renderer/utils/canvas/canvasHelpers';
import { LINE_DASHES } from '@shared/constants';

export const renderHorizontalLine = (
  ctx: CanvasRenderingContext2D,
  drawing: HorizontalLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
): void => {
  const y = mapper.priceToY(drawing.price);
  const gripX = mapper.indexToCenterX(drawing.index);

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.horizontalLine);
  ctx.setLineDash([...LINE_DASHES.STANDARD]);
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
