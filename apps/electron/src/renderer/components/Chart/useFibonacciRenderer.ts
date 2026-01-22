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

const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;
const DEFAULT_LEVEL_COLOR = 'rgba(180, 180, 180, 0.7)';

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

    for (const level of fibonacciData.levels) {
      if (!level) continue;

      const y = manager.priceToY(level.price);

      if (y < 0 || y > chartHeight) continue;

      const color = getLevelColor(level.level, colors);
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH;
      ctx.setLineDash([...LEVEL_DASH]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
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
