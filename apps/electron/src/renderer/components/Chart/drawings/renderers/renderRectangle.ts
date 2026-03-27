import type { RectangleDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import { hexToRgba, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import { FILL_OPACITY } from '@shared/constants';

export const renderRectangle = (
  ctx: CanvasRenderingContext2D,
  drawing: RectangleDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  const strokeColor = drawing.color ?? DRAWING_COLORS.rectangle;
  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.fillStyle = hexToRgba(strokeColor, FILL_OPACITY.RECTANGLE);
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : strokeColor;
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth - 0.5;
  ctx.strokeRect(left, top, w, h);
  ctx.restore();
};
