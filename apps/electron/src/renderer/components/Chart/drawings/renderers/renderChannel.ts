import type { ChannelDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

const extendToEdges = (
  sx: number, sy: number, ex: number, ey: number,
  chartWidth: number, chartHeight: number,
): [number, number, number, number] => {
  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) return [sx, sy, ex, ey];

  if (dx === 0) {
    return [sx, -10, ex, chartHeight + 10];
  }

  const slope = dy / dx;
  let lx = -10;
  let ly = sy + slope * (lx - sx);
  let rx = chartWidth + 10;
  let ry = sy + slope * (rx - sx);

  if (ly < -10) { ly = -10; lx = sx + (-10 - sy) / slope; }
  else if (ly > chartHeight + 10) { ly = chartHeight + 10; lx = sx + (chartHeight + 10 - sy) / slope; }
  if (ry < -10) { ry = -10; rx = sx + (-10 - sy) / slope; }
  else if (ry > chartHeight + 10) { ry = chartHeight + 10; rx = sx + (chartHeight + 10 - sy) / slope; }

  return [lx, ly, rx, ry];
};

export const renderChannel = (
  ctx: CanvasRenderingContext2D,
  drawing: ChannelDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);
  const wx = mapper.indexToCenterX(drawing.widthIndex);
  const wy = mapper.priceToY(drawing.widthPrice);

  const dx = x2 - x1;
  const dy = y2 - y1;

  const [l1x, l1y, r1x, r1y] = extendToEdges(x1, y1, x2, y2, chartWidth, chartHeight);
  const [l2x, l2y, r2x, r2y] = extendToEdges(wx, wy, wx + dx, wy + dy, chartWidth, chartHeight);

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  const color = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.channel);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;

  ctx.beginPath();
  ctx.moveTo(l1x, l1y);
  ctx.lineTo(r1x, r1y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(l2x, l2y);
  ctx.lineTo(r2x, r2y);
  ctx.stroke();

  let fillColor = 'rgba(171, 71, 188, 0.06)';
  const c = drawing.color ?? DRAWING_COLORS.channel;
  if (c.startsWith('#') && c.length >= 7) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    fillColor = `rgba(${r}, ${g}, ${b}, 0.06)`;
  }

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(l1x, l1y);
  ctx.lineTo(r1x, r1y);
  ctx.lineTo(r2x, r2y);
  ctx.lineTo(l2x, l2y);
  ctx.closePath();
  ctx.fill();

  const ml1x = (l1x + l2x) / 2;
  const ml1y = (l1y + l2y) / 2;
  const mr1x = (r1x + r2x) / 2;
  const mr1y = (r1y + r2y) / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = baseWidth * 0.6;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(ml1x, ml1y);
  ctx.lineTo(mr1x, mr1y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.restore();
};
