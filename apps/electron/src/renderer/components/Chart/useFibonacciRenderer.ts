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

const SECONDARY_LEVELS = [0.236, 0.382, 0.618, 0.786];
const PRIMARY_LEVEL_COLOR = 'rgba(180, 180, 180, 0.7)';
const SECONDARY_LEVEL_COLOR = 'rgba(120, 120, 120, 0.4)';
const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;

const getLevelColor = (level: number): string => {
  if (SECONDARY_LEVELS.includes(level)) return SECONDARY_LEVEL_COLOR;
  return PRIMARY_LEVEL_COLOR;
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

      const color = getLevelColor(level.level);
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
