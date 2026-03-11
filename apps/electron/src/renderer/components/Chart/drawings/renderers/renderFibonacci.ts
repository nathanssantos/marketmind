import type { FibonacciDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { getLevelColor as getFibLevelColor, FIBONACCI_DEFAULT_COLOR } from '@marketmind/fibonacci';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { formatChartPrice } from '@renderer/utils/formatters';

const SWING_LINE_WIDTH = 2;
const SWING_LINE_DASH = [2, 4] as const;
const SWING_POINT_RADIUS = 4;
const FULL_CIRCLE = Math.PI * 2;
const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;
const LABEL_FONT = '10px monospace';
const LABEL_OFFSET_X = 4;
const LABEL_OFFSET_Y = 10;
const HIDDEN_LEVELS = new Set([0.886, 1.382]);

export const renderFibonacci = (
  ctx: CanvasRenderingContext2D,
  drawing: FibonacciDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartHeight: number,
  chartWidth: number,
  themeColors?: ChartThemeColors,
): void => {
  const lowX = mapper.indexToCenterX(drawing.swingLowIndex);
  const lowY = mapper.priceToY(drawing.swingLowPrice);
  const highX = mapper.indexToCenterX(drawing.swingHighIndex);
  const highY = mapper.priceToY(drawing.swingHighPrice);

  const isUpwardLeg = drawing.swingHighIndex > drawing.swingLowIndex;
  const fibStartX = isUpwardLeg ? lowX : highX;

  ctx.save();

  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : DRAWING_COLORS.fibonacci;
  ctx.lineWidth = SWING_LINE_WIDTH;
  ctx.setLineDash([...SWING_LINE_DASH]);
  ctx.beginPath();
  ctx.moveTo(lowX, lowY);
  ctx.lineTo(highX, highY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = isSelected ? DRAWING_COLORS.selected : 'rgba(180, 180, 180, 0.9)';
  ctx.beginPath();
  ctx.arc(lowX, lowY, SWING_POINT_RADIUS, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(highX, highY, SWING_POINT_RADIUS, 0, FULL_CIRCLE);
  ctx.fill();

  for (const level of drawing.levels) {
    if (HIDDEN_LEVELS.has(level.level)) continue;
    const y = mapper.priceToY(level.price);
    if (y < 0 || y > chartHeight) continue;

    const color = themeColors
      ? getFibLevelColor(level.level, themeColors.fibonacci, FIBONACCI_DEFAULT_COLOR)
      : `hsl(${level.level * 240}, 70%, 50%)`;

    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash([...LEVEL_DASH]);
    ctx.beginPath();
    ctx.moveTo(fibStartX, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${level.label} (${formatChartPrice(level.price)})`, fibStartX + LABEL_OFFSET_X, y - LABEL_OFFSET_Y);
  }

  ctx.restore();
};
