import type { PriceRangeDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';

const PROFIT_COLOR = 'rgba(38, 166, 154, 0.15)';
const PROFIT_BORDER = '#26A69A';
const LOSS_COLOR = 'rgba(239, 83, 80, 0.15)';
const LOSS_BORDER = '#EF5350';
const LABEL_FONT = '11px sans-serif';
const LABEL_COLOR = '#E0E0E0';

export const renderPriceRange = (
  ctx: CanvasRenderingContext2D,
  drawing: PriceRangeDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

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

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();

  ctx.fillStyle = isLong ? PROFIT_COLOR : LOSS_COLOR;
  ctx.fillRect(left, top, width, height);

  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? (isLong ? PROFIT_BORDER : LOSS_BORDER));
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;
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
  ctx.fillStyle = isLong ? PROFIT_BORDER : LOSS_BORDER;
  ctx.fillText(`${sign}${pctChange.toFixed(2)}%`, labelX, (y1 + y2) / 2 - 8);
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(`${priceDiff.toFixed(2)}`, labelX, (y1 + y2) / 2 + 8);

  ctx.restore();
};
