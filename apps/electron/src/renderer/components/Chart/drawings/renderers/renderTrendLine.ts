import type { TrendLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

export const renderTrendLine = (
  ctx: CanvasRenderingContext2D,
  drawing: TrendLineDrawing,
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

  let lx: number, ly: number, rx: number, ry: number;
  if (dx === 0 && dy === 0) {
    lx = x1; ly = y1; rx = x2; ry = y2;
  } else if (dx === 0) {
    lx = x1; ly = -10; rx = x2; ry = chartHeight + 10;
  } else {
    const slope = dy / dx;
    lx = -10;
    ly = y1 + slope * (lx - x1);
    rx = chartWidth + 10;
    ry = y1 + slope * (rx - x1);
  }

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.trendLine);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.restore();
};
