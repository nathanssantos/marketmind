import type { RulerDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { applyDrawingStyle, mapTwoPointCoords } from '@renderer/utils/canvas/canvasHelpers';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { formatChartPrice } from '@renderer/utils/formatters';
import { LINE_DASHES } from '@shared/constants';

const LABEL_FONT = '11px monospace';
const LABEL_BG_COLOR = 'rgba(0, 0, 0, 0.7)';
const LABEL_PADDING = 4;
const LABEL_HEIGHT = 16;

export const renderRuler = (
  ctx: CanvasRenderingContext2D,
  drawing: RulerDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  colors: { bullish: string; bearish: string },
  themeColors?: ChartThemeColors,
): void => {
  const { x1, y1, x2, y2 } = mapTwoPointCoords(drawing, mapper);

  const isPositive = drawing.endPrice >= drawing.startPrice;
  const defaultColor = isPositive ? colors.bullish : colors.bearish;

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, defaultColor);
  ctx.setLineDash([...LINE_DASHES.RULER]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const priceChange = drawing.endPrice - drawing.startPrice;
  const percentChange = drawing.startPrice === 0 ? 0 : (priceChange / drawing.startPrice) * 100;
  const klineCount = Math.abs(drawing.endIndex - drawing.startIndex);

  ctx.setLineDash([]);
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const sign = priceChange >= 0 ? '+' : '';
  const label = `${klineCount} bars  ${sign}${formatChartPrice(priceChange)} (${sign}${percentChange.toFixed(2)}%)`;

  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = themeColors?.drawing?.labelBg ?? LABEL_BG_COLOR;
  ctx.fillRect(midX - LABEL_PADDING, midY - LABEL_HEIGHT - LABEL_PADDING, textWidth + LABEL_PADDING * 2, LABEL_HEIGHT + LABEL_PADDING);
  ctx.fillStyle = isPositive ? colors.bullish : colors.bearish;
  ctx.fillText(label, midX, midY - LABEL_PADDING);

  ctx.restore();
};
