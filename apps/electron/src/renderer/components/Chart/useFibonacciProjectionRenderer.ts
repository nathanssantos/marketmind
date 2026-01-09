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
  '2': 'rgba(33, 150, 243, 0.9)',
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

    const swingLowX = manager.indexToCenterX(swingLow.index);
    const swingLowY = manager.priceToY(swingLow.price);
    const swingHighX = manager.indexToCenterX(swingHigh.index);
    const swingHighY = manager.priceToY(swingHigh.price);

    ctx.save();

    ctx.strokeStyle = 'rgba(180, 180, 180, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(swingLowX, swingLowY);
    ctx.lineTo(swingHighX, swingHighY);
    ctx.stroke();
    ctx.setLineDash([]);

    const circleRadius = 4;
    ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
    ctx.beginPath();
    ctx.arc(swingLowX, swingLowY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(swingHighX, swingHighY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    for (const level of levels) {
      const y = manager.priceToY(level.price);

      if (y < 0 || y > chartHeight) continue;

      const levelKey = String(level.level);
      const color = EXTENSION_COLORS[levelKey] ?? 'rgba(128, 128, 128, 0.5)';
      const isPrimary = level.level === 2;

      ctx.fillStyle = color;
      ctx.font = isPrimary ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const priceText = level.price.toFixed(2);
      const labelText = `${level.label} (${priceText})`;
      const textWidth = ctx.measureText(labelText).width;
      const lineStartX = effectiveWidth - textWidth - 12;

      ctx.strokeStyle = color;
      ctx.lineWidth = isPrimary ? 2 : 1;
      ctx.setLineDash(isPrimary ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(lineStartX, y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillText(labelText, effectiveWidth - 4, y - 10);
    }

    ctx.restore();
  }, [manager, projectionData, enabled, colors]);

  return { render };
};
