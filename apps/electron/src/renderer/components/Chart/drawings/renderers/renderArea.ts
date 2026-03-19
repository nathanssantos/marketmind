import type { AreaDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { formatChartPrice } from '@renderer/utils/formatters';

const LABEL_FONT = '11px monospace';
const LABEL_BG_COLOR = 'rgba(0, 0, 0, 0.7)';
const AREA_FILL_COLOR = 'rgba(100, 116, 139, 0.1)';
const LABEL_PADDING = 4;
const LABEL_HEIGHT = 18;
const LABEL_OFFSET_Y = 20;
const LABEL_TEXT_OFFSET_Y = 18;
const BORDER_DASH = [4, 4] as const;
const BORDER_WIDTH = 1;

export const renderArea = (
  ctx: CanvasRenderingContext2D,
  drawing: AreaDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  colors: { crosshair: string; bullish: string; bearish: string },
): void => {
  const x1 = mapper.indexToCenterX(drawing.startIndex);
  const y1 = mapper.priceToY(drawing.startPrice);
  const x2 = mapper.indexToCenterX(drawing.endIndex);
  const y2 = mapper.priceToY(drawing.endPrice);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  ctx.save();

  ctx.fillStyle = AREA_FILL_COLOR;
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? colors.crosshair);
  ctx.lineWidth = drawing.lineWidth ?? BORDER_WIDTH;
  ctx.setLineDash([...BORDER_DASH]);
  ctx.strokeRect(left, top, w, h);

  const priceChange = drawing.endPrice - drawing.startPrice;
  const percentChange = drawing.startPrice === 0 ? 0 : (priceChange / drawing.startPrice) * 100;
  const klineCount = Math.abs(drawing.endIndex - drawing.startIndex);
  const isPositive = priceChange >= 0;

  ctx.setLineDash([]);
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const sign = priceChange >= 0 ? '+' : '';
  const label = `${klineCount} bars  ${sign}${formatChartPrice(priceChange)} (${sign}${percentChange.toFixed(2)}%)`;

  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = LABEL_BG_COLOR;
  ctx.fillRect(left, top - LABEL_OFFSET_Y, textWidth + LABEL_PADDING * 2, LABEL_HEIGHT);
  ctx.fillStyle = isPositive ? colors.bullish : colors.bearish;
  ctx.fillText(label, left + LABEL_PADDING, top - LABEL_TEXT_OFFSET_Y);

  ctx.restore();
};
