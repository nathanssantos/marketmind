import type { RayDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

export const renderRay = (
  ctx: CanvasRenderingContext2D,
  drawing: RayDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

  const dx = x2 - x1;
  const dy = y2 - y1;

  let extX = x2;
  let extY = y2;

  if (dx === 0 && dy === 0) {
    extX = x2;
    extY = y2;
  } else if (dx === 0) {
    extX = x2;
    extY = dy > 0 ? chartHeight + 10 : -10;
  } else {
    const slope = dy / dx;
    if (dx > 0) {
      extX = chartWidth + 10;
      extY = y2 + slope * (extX - x2);
    } else {
      extX = -10;
      extY = y2 + slope * (extX - x2);
    }

    if (extY < -10) {
      extY = -10;
      extX = x2 + (-10 - y2) / slope;
    } else if (extY > chartHeight + 10) {
      extY = chartHeight + 10;
      extX = x2 + (chartHeight + 10 - y2) / slope;
    }
  }

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.ray);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(extX, extY);
  ctx.stroke();
  ctx.restore();
};
