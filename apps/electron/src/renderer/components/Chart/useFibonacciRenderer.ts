import type { FibonacciResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseFibonacciRendererProps {
  manager: CanvasManager | null;
  fibonacciData: FibonacciResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useFibonacciRenderer = ({
  manager,
  fibonacciData,
  colors,
  enabled = true,
}: UseFibonacciRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !fibonacciData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - 72;

    ctx.save();

    const fibColors = [
      'rgba(128, 128, 128, 0.5)',
      'rgba(128, 128, 128, 0.5)',
      'rgba(128, 128, 128, 0.5)',
      colors.fibonacci?.level127 ?? 'rgba(244, 67, 54, 0.3)',
      colors.fibonacci?.level161 ?? 'rgba(244, 67, 54, 0.3)',
      colors.fibonacci?.level200 ?? 'rgba(244, 67, 54, 0.3)',
    ];

    for (let i = 0; i < fibonacciData.levels.length; i++) {
      const level = fibonacciData.levels[i];
      if (!level) continue;

      const y = manager.priceToY(level.price);

      if (y < 0 || y > chartHeight) continue;

      ctx.strokeStyle = fibColors[i] ?? 'rgba(128, 128, 128, 0.5)';
      ctx.lineWidth = level.level === 0.5 || level.level === 0.618 ? 1.5 : 1;
      ctx.setLineDash(level.level > 1 ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();

      ctx.fillStyle = fibColors[i] ?? 'rgba(128, 128, 128, 0.8)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(level.label, effectiveWidth - 4, y);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }, [manager, fibonacciData, enabled, colors]);

  return { render };
};
