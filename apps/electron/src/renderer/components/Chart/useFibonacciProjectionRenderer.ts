import type { FibonacciProjectionData } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseFibonacciProjectionRendererProps {
  manager: CanvasManager | null;
  projectionData: FibonacciProjectionData | null;
  colors: ChartThemeColors;
  enabled: boolean;
}

const EXTENSION_COLORS: Record<string, string> = {
  '1.272': 'rgba(255, 193, 7, 0.8)',
  '1.618': 'rgba(76, 175, 80, 0.9)',
  '2': 'rgba(33, 150, 243, 0.9)',
};

const SWING_LINE_WIDTH = 2;
const SWING_LINE_DASH_ON = 2;
const SWING_LINE_DASH_OFF = 4;
const SWING_LINE_DASH = [SWING_LINE_DASH_ON, SWING_LINE_DASH_OFF] as const;
const SWING_POINT_RADIUS = 4;
const FULL_CIRCLE_MULTIPLIER = 2;
const FULL_CIRCLE = Math.PI * FULL_CIRCLE_MULTIPLIER;
const PRIMARY_LEVEL = 2;
const PRIMARY_LINE_WIDTH = 2;
const SECONDARY_LINE_WIDTH = 1;
const LEVEL_DASH = [SWING_LINE_DASH_OFF, SWING_LINE_DASH_OFF] as const;
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
  ctx.strokeStyle = 'rgba(180, 180, 180, 0.7)';
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
  ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
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
}

const drawExtensionLevel = ({ ctx, level, y, fibStartX, priceScaleX }: LevelDrawParams): void => {
  const levelKey = String(level.level);
  const color = EXTENSION_COLORS[levelKey] ?? 'rgba(128, 128, 128, 0.5)';
  const isPrimary = level.level === PRIMARY_LEVEL;

  ctx.strokeStyle = color;
  ctx.lineWidth = isPrimary ? PRIMARY_LINE_WIDTH : SECONDARY_LINE_WIDTH;
  ctx.setLineDash(isPrimary ? [] : [...LEVEL_DASH]);
  ctx.beginPath();
  ctx.moveTo(fibStartX, y);
  ctx.lineTo(priceScaleX, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  ctx.font = isPrimary ? 'bold 11px monospace' : '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const priceText = level.price.toFixed(PRICE_DECIMAL_PLACES);
  const labelText = `${level.label} (${priceText})`;
  ctx.fillText(labelText, fibStartX + LABEL_OFFSET_X, y - LABEL_OFFSET_Y);
};

export const useFibonacciProjectionRenderer = ({
  manager,
  projectionData,
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
      drawExtensionLevel({ ctx, level, y, fibStartX, priceScaleX });
    }

    ctx.restore();
  }, [manager, projectionData, enabled]);

  return { render };
};
