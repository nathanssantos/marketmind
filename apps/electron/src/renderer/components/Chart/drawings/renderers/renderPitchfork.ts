import type { PitchforkDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle, extendLineToEdges, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';

export const renderPitchfork = (
  ctx: CanvasRenderingContext2D,
  drawing: PitchforkDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);
  const x3 = mapper.indexToCenterX(drawing.widthIndex);
  const y3 = mapper.priceToY(drawing.widthPrice);

  const mx = (x2 + x3) / 2;
  const my = (y2 + y3) / 2;

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.pitchfork);

  const [ml1x, ml1y, mr1x, mr1y] = extendLineToEdges(x1, y1, mx, my, chartWidth, chartHeight);
  ctx.beginPath();
  ctx.moveTo(ml1x, ml1y);
  ctx.lineTo(mr1x, mr1y);
  ctx.stroke();

  const mdx = mx - x1;
  const mdy = my - y1;

  const [pl1x, pl1y, pr1x, pr1y] = extendLineToEdges(x2, y2, x2 + mdx, y2 + mdy, chartWidth, chartHeight);
  ctx.beginPath();
  ctx.moveTo(pl1x, pl1y);
  ctx.lineTo(pr1x, pr1y);
  ctx.stroke();

  const [pl2x, pl2y, pr2x, pr2y] = extendLineToEdges(x3, y3, x3 + mdx, y3 + mdy, chartWidth, chartHeight);
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
