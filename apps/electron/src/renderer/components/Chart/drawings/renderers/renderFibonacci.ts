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
const GOLDEN_LEVEL = 1.618;
const GOLDEN_COLOR = 'rgba(255, 215, 0, 0.8)';
const KEY_LEVEL_COLOR = 'rgba(180, 180, 180, 0.55)';
const KEY_LEVELS = new Set([0, 0.5, 1]);
const BUY_ZONE_COLOR = 'rgba(34, 197, 94, 0.08)';
const DANGER_ZONE_COLOR = 'rgba(239, 68, 68, 0.08)';
const BUY_ZONE_TOP = 0.382;
const BUY_ZONE_BOTTOM = 0.236;
const DANGER_ZONE_TOP = 0.236;
const DANGER_ZONE_BOTTOM = 0;

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

  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.fibonacci);
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

  const zonePrices: Record<number, number> = {};
  for (const level of drawing.levels) {
    if (level.level === BUY_ZONE_TOP || level.level === BUY_ZONE_BOTTOM || level.level === DANGER_ZONE_BOTTOM)
      zonePrices[level.level] = mapper.priceToY(level.price);
  }

  const drawZone = (topLevel: number, bottomLevel: number, color: string) => {
    const topY = zonePrices[topLevel];
    const bottomY = zonePrices[bottomLevel];
    if (topY === undefined || bottomY === undefined) return;
    const y1 = Math.min(topY, bottomY);
    const y2 = Math.max(topY, bottomY);
    if (y2 > 0 && y1 < chartHeight) {
      ctx.fillStyle = color;
      ctx.fillRect(fibStartX, y1, chartWidth - fibStartX, y2 - y1);
    }
  };

  drawZone(BUY_ZONE_TOP, BUY_ZONE_BOTTOM, BUY_ZONE_COLOR);
  drawZone(DANGER_ZONE_TOP, DANGER_ZONE_BOTTOM, DANGER_ZONE_COLOR);

  for (const level of drawing.levels) {
    if (HIDDEN_LEVELS.has(level.level)) continue;
    const y = mapper.priceToY(level.price);
    if (y < 0 || y > chartHeight) continue;

    const isGolden = level.level === GOLDEN_LEVEL;

    const color = isGolden
      ? GOLDEN_COLOR
      : KEY_LEVELS.has(level.level)
        ? KEY_LEVEL_COLOR
        : themeColors
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
