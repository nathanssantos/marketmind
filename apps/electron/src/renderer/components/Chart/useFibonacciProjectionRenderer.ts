import type { FibonacciProjectionData } from '@marketmind/types';
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
  '2': 'rgba(33, 150, 243, 0.7)',
  '2.618': 'rgba(156, 39, 176, 0.6)',
  '3.618': 'rgba(255, 152, 0, 0.5)',
  '4.236': 'rgba(244, 67, 54, 0.4)',
};

const drawDiamond = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string,
  strokeColor: string
): void => {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

export const useFibonacciProjectionRenderer = ({
  manager,
  projectionData,
  colors,
  enabled,
}: UseFibonacciProjectionRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !projectionData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - 72;

    const { swingLow, swingHigh, levels } = projectionData;

    const swingLowX = manager.indexToX(swingLow.index);
    const swingLowY = manager.priceToY(swingLow.price);
    const swingHighX = manager.indexToX(swingHigh.index);
    const swingHighY = manager.priceToY(swingHigh.price);

    ctx.save();

    ctx.strokeStyle = colors.grid ?? 'rgba(128, 128, 128, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(swingLowX, swingLowY);
    ctx.lineTo(swingHighX, swingHighY);
    ctx.stroke();
    ctx.setLineDash([]);

    const swingLowColor = colors.bullish ?? 'rgba(34, 197, 94, 0.9)';
    const swingHighColor = colors.bearish ?? 'rgba(239, 68, 68, 0.9)';

    if (swingLowY >= 0 && swingLowY <= chartHeight) {
      drawDiamond(ctx, swingLowX, swingLowY, 6, swingLowColor, 'rgba(255, 255, 255, 0.8)');
    }

    if (swingHighY >= 0 && swingHighY <= chartHeight) {
      drawDiamond(ctx, swingHighX, swingHighY, 6, swingHighColor, 'rgba(255, 255, 255, 0.8)');
    }

    for (const level of levels) {
      const y = manager.priceToY(level.price);

      if (y < 0 || y > chartHeight) continue;

      const levelKey = String(level.level);
      const color = EXTENSION_COLORS[levelKey] ?? 'rgba(128, 128, 128, 0.5)';
      const isPrimary = level.level === 1.618;

      ctx.strokeStyle = color;
      ctx.lineWidth = isPrimary ? 2 : 1;
      ctx.setLineDash(isPrimary ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.max(swingHighX, 0), y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = isPrimary ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const priceText = level.price.toFixed(2);
      const labelText = `${level.label} (${priceText})`;
      ctx.fillText(labelText, effectiveWidth - 4, y);
    }

    ctx.restore();
  }, [manager, projectionData, enabled, colors]);

  return { render };
};
