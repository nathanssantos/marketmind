import type { PitchforkDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

const extendLine = (
  sx: number, sy: number, ex: number, ey: number,
  chartWidth: number, chartHeight: number,
): [number, number, number, number] => {
  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) return [sx, sy, ex, ey];
  if (dx === 0) return [sx, -10, ex, chartHeight + 10];

  const slope = dy / dx;
  const lx = -10;
  const ly = sy + slope * (lx - sx);
  const rx = chartWidth + 10;
  const ry = sy + slope * (rx - sx);

  return [lx, ly, rx, ry];
};

export const renderPitchfork = (
  ctx: CanvasRenderingContext2D,
  drawing: PitchforkDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);
  const x3 = mapper.indexToCenterX(drawing.widthIndex);
  const y3 = mapper.priceToY(drawing.widthPrice);

  const mx = (x2 + x3) / 2;
  const my = (y2 + y3) / 2;

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  const color = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.pitchfork);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;

  const [ml1x, ml1y, mr1x, mr1y] = extendLine(x1, y1, mx, my, chartWidth, chartHeight);
  ctx.beginPath();
  ctx.moveTo(ml1x, ml1y);
  ctx.lineTo(mr1x, mr1y);
  ctx.stroke();

  const mdx = mx - x1;
  const mdy = my - y1;

  const [pl1x, pl1y, pr1x, pr1y] = extendLine(x2, y2, x2 + mdx, y2 + mdy, chartWidth, chartHeight);
  ctx.beginPath();
  ctx.moveTo(pl1x, pl1y);
  ctx.lineTo(pr1x, pr1y);
  ctx.stroke();

  const [pl2x, pl2y, pr2x, pr2y] = extendLine(x3, y3, x3 + mdx, y3 + mdy, chartWidth, chartHeight);
  ctx.beginPath();
  ctx.moveTo(pl2x, pl2y);
  ctx.lineTo(pr2x, pr2y);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x3, y3);
  ctx.stroke();

  ctx.restore();
};
