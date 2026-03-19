import type { RectangleDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

const hexToFillColor = (hex: string): string => {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.08)`;
  }
  return 'rgba(156, 39, 176, 0.08)';
};

export const renderRectangle = (
  ctx: CanvasRenderingContext2D,
  drawing: RectangleDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  const strokeColor = drawing.color ?? DRAWING_COLORS.rectangle;
  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.fillStyle = hexToFillColor(strokeColor);
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : strokeColor;
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth - 0.5;
  ctx.strokeRect(left, top, w, h);
  ctx.restore();
};
