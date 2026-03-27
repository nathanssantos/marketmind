import type { EllipseDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, hexToRgba, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import { FILL_OPACITY } from '@shared/constants';

export const renderEllipse = (
  ctx: CanvasRenderingContext2D,
  drawing: EllipseDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;

  if (rx === 0 || ry === 0) return;

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.ellipse);

  const color = drawing.color ?? DRAWING_COLORS.ellipse;
  ctx.fillStyle = hexToRgba(color, FILL_OPACITY.ELLIPSE);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};
