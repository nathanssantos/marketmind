import type { ArrowDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';

const ARROWHEAD_LENGTH = 12;
const ARROWHEAD_HALF_SPREAD = 6;
const ARROWHEAD_ANGLE = Math.PI / ARROWHEAD_HALF_SPREAD;

export const renderArrow = (
  ctx: CanvasRenderingContext2D,
  drawing: ArrowDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  const color = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.arrow);

  ctx.save();
  ctx.fillStyle = color;
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.arrow);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ARROWHEAD_LENGTH * Math.cos(angle - ARROWHEAD_ANGLE), y2 - ARROWHEAD_LENGTH * Math.sin(angle - ARROWHEAD_ANGLE));
  ctx.lineTo(x2 - ARROWHEAD_LENGTH * Math.cos(angle + ARROWHEAD_ANGLE), y2 - ARROWHEAD_LENGTH * Math.sin(angle + ARROWHEAD_ANGLE));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};
