import type { RayDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import { CANVAS_EDGE_PADDING } from '@shared/constants';

export const renderRay = (
  ctx: CanvasRenderingContext2D,
  drawing: RayDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  const dx = x2 - x1;
  const dy = y2 - y1;

  let extX: number;
  let extY: number;

  if (dx === 0 && dy === 0) {
    extX = x2;
    extY = y2;
  } else if (dx === 0) {
    extX = x2;
    extY = dy > 0 ? chartHeight + CANVAS_EDGE_PADDING : -CANVAS_EDGE_PADDING;
  } else {
    const slope = dy / dx;
    if (dx > 0) {
      extX = chartWidth + CANVAS_EDGE_PADDING;
      extY = y2 + slope * (extX - x2);
    } else {
      extX = -CANVAS_EDGE_PADDING;
      extY = y2 + slope * (extX - x2);
    }

    if (extY < -CANVAS_EDGE_PADDING) {
      extY = -CANVAS_EDGE_PADDING;
      extX = x2 + (-CANVAS_EDGE_PADDING - y2) / slope;
    } else if (extY > chartHeight + CANVAS_EDGE_PADDING) {
      extY = chartHeight + CANVAS_EDGE_PADDING;
      extX = x2 + (chartHeight + CANVAS_EDGE_PADDING - y2) / slope;
    }
  }

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.ray);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(extX, extY);
  ctx.stroke();
  ctx.restore();
};
