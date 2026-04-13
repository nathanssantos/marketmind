import type { PriceRangeDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { applyDrawingStyle, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import { TRADING_COLORS } from '@shared/constants';

const LABEL_FONT = '11px sans-serif';

export const renderPriceRange = (
  ctx: CanvasRenderingContext2D,
  drawing: PriceRangeDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const width = right - left;
  const height = bottom - top;

  if (width === 0 || height === 0) return;

  const isLong = drawing.endPrice > drawing.startPrice;
  const pctChange = ((drawing.endPrice - drawing.startPrice) / drawing.startPrice) * 100;
  const priceDiff = Math.abs(drawing.endPrice - drawing.startPrice);

  ctx.save();

  ctx.fillStyle = isLong ? TRADING_COLORS.PROFIT_FILL : TRADING_COLORS.LOSS_FILL;
  ctx.fillRect(left, top, width, height);

  const defaultColor = isLong ? TRADING_COLORS.PROFIT : TRADING_COLORS.LOSS;
  applyDrawingStyle(ctx, drawing, isSelected, defaultColor);
  ctx.strokeRect(left, top, width, height);

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, y1);
  ctx.lineTo(right, y1);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = LABEL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const labelX = right + 6;
  const sign = pctChange >= 0 ? '+' : '';
  ctx.fillStyle = isLong ? TRADING_COLORS.PROFIT : TRADING_COLORS.LOSS;
  ctx.fillText(`${sign}${pctChange.toFixed(2)}%`, labelX, (y1 + y2) / 2 - 8);
  ctx.fillStyle = TRADING_COLORS.LABEL_TEXT;
  ctx.fillText(`${priceDiff.toFixed(2)}`, labelX, (y1 + y2) / 2 + 8);

  ctx.restore();
};
