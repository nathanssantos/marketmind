import type { FibonacciProjectionData, Kline } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseFibonacciProjectionRendererProps {
  manager: CanvasManager | null;
  projectionData: FibonacciProjectionData | null;
  colors: ChartThemeColors;
  enabled: boolean;
}

const DEFAULT_LEVEL_COLOR = 'rgba(180, 180, 180, 0.7)';
const SWING_COLOR = 'rgba(180, 180, 180, 0.7)';
const SWING_POINT_COLOR = 'rgba(180, 180, 180, 0.9)';

const getLevelColor = (level: number, colors: ChartThemeColors): string => {
  const fibColors = colors.fibonacci;
  if (!fibColors) return DEFAULT_LEVEL_COLOR;

  if (level === 0) return fibColors.level0 ?? DEFAULT_LEVEL_COLOR;
  if (level === 0.236) return fibColors.level236 ?? DEFAULT_LEVEL_COLOR;
  if (level === 0.382) return fibColors.level382 ?? DEFAULT_LEVEL_COLOR;
  if (level === 0.5) return fibColors.level50 ?? DEFAULT_LEVEL_COLOR;
  if (level === 0.618) return fibColors.level618 ?? DEFAULT_LEVEL_COLOR;
  if (level === 0.786) return fibColors.level786 ?? DEFAULT_LEVEL_COLOR;
  if (level === 1) return fibColors.level100 ?? DEFAULT_LEVEL_COLOR;
  if (level === 1.27 || level === 1.272) return fibColors.level127 ?? DEFAULT_LEVEL_COLOR;
  if (level === 1.618) return fibColors.level161 ?? DEFAULT_LEVEL_COLOR;
  if (level === 2) return fibColors.level200 ?? DEFAULT_LEVEL_COLOR;

  return DEFAULT_LEVEL_COLOR;
};

const SWING_LINE_WIDTH = 2;
const SWING_LINE_DASH = [2, 4] as const;
const SWING_POINT_RADIUS = 4;
const FULL_CIRCLE = Math.PI * 2;
const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;
const LABEL_OFFSET_X = 4;
const LABEL_OFFSET_Y = 10;
const PRICE_DECIMAL_PLACES = 2;

const findIndexByTimestamp = (klines: Kline[], timestamp: number): number | null => {
  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const openTime = typeof kline.openTime === 'number' ? kline.openTime : parseInt(kline.openTime);
    const closeTime = typeof kline.closeTime === 'number' ? kline.closeTime : parseInt(kline.closeTime);
    if (timestamp >= openTime && timestamp <= closeTime) return i;
  }
  return null;
};

const drawSwingLine = (
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number
): void => {
  ctx.strokeStyle = SWING_COLOR;
  ctx.lineWidth = SWING_LINE_WIDTH;
  ctx.setLineDash([...SWING_LINE_DASH]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
};

const drawSwingPoints = (
  ctx: CanvasRenderingContext2D,
  lowX: number, lowY: number, highX: number, highY: number
): void => {
  ctx.fillStyle = SWING_POINT_COLOR;
  ctx.beginPath();
  ctx.arc(lowX, lowY, SWING_POINT_RADIUS, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(highX, highY, SWING_POINT_RADIUS, 0, FULL_CIRCLE);
  ctx.fill();
};

interface LevelDrawParams {
  ctx: CanvasRenderingContext2D;
  level: { level: number; price: number; label: string };
  y: number;
  fibStartX: number;
  priceScaleX: number;
  colors: ChartThemeColors;
}

const drawExtensionLevel = ({ ctx, level, y, fibStartX, priceScaleX, colors }: LevelDrawParams): void => {
  const color = getLevelColor(level.level, colors);

  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH;
  ctx.setLineDash([...LEVEL_DASH]);
  ctx.beginPath();
  ctx.moveTo(fibStartX, y);
  ctx.lineTo(priceScaleX, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const priceText = level.price.toFixed(PRICE_DECIMAL_PLACES);
  const labelText = `${level.label} (${priceText})`;
  ctx.fillText(labelText, fibStartX + LABEL_OFFSET_X, y - LABEL_OFFSET_Y);
};

export const useFibonacciProjectionRenderer = ({
  manager,
  projectionData,
  colors,
  enabled,
}: UseFibonacciProjectionRendererProps): { render: () => void } => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !projectionData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const priceScaleX = chartWidth;

    const { swingLow, swingHigh, levels } = projectionData;

    const klines = manager.getKlines();
    const swingLowIndex = findIndexByTimestamp(klines, swingLow.timestamp) ?? swingLow.index;
    const swingHighIndex = findIndexByTimestamp(klines, swingHigh.timestamp) ?? swingHigh.index;

    const swingLowX = manager.indexToCenterX(swingLowIndex);
    const swingLowY = manager.priceToY(swingLow.price);
    const swingHighX = manager.indexToCenterX(swingHighIndex);
    const swingHighY = manager.priceToY(swingHigh.price);

    const isUpwardLeg = swingHighIndex > swingLowIndex;
    const fibStartX = isUpwardLeg ? swingLowX : swingHighX;

    ctx.save();

    drawSwingLine(ctx, swingLowX, swingLowY, swingHighX, swingHighY);
    drawSwingPoints(ctx, swingLowX, swingLowY, swingHighX, swingHighY);

    for (const level of levels) {
      const y = manager.priceToY(level.price);
      if (y < 0 || y > chartHeight) continue;
      drawExtensionLevel({ ctx, level, y, fibStartX, priceScaleX, colors });
    }

    ctx.restore();
  }, [manager, projectionData, colors, enabled]);

  return { render };
};
