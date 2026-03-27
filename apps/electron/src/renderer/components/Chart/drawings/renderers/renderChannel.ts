import type { ChannelDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, extendLineToEdges, hexToRgba, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import { FILL_OPACITY, LINE_DASHES } from '@shared/constants';

export const renderChannel = (
  ctx: CanvasRenderingContext2D,
  drawing: ChannelDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);
  const wx = mapper.indexToCenterX(drawing.widthIndex);
  const wy = mapper.priceToY(drawing.widthPrice);

  const dx = x2 - x1;
  const dy = y2 - y1;

  const [l1x, l1y, r1x, r1y] = extendLineToEdges(x1, y1, x2, y2, chartWidth, chartHeight);
  const [l2x, l2y, r2x, r2y] = extendLineToEdges(wx, wy, wx + dx, wy + dy, chartWidth, chartHeight);

  const color = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.channel);

  ctx.save();
  const baseWidth = applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.channel);

  ctx.beginPath();
  ctx.moveTo(l1x, l1y);
  ctx.lineTo(r1x, r1y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(l2x, l2y);
  ctx.lineTo(r2x, r2y);
  ctx.stroke();

  const c = drawing.color ?? DRAWING_COLORS.channel;
  ctx.fillStyle = hexToRgba(c, FILL_OPACITY.CHANNEL);
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
  ctx.setLineDash([...LINE_DASHES.STANDARD]);
  ctx.beginPath();
  ctx.moveTo(ml1x, ml1y);
  ctx.lineTo(mr1x, mr1y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.restore();
};
