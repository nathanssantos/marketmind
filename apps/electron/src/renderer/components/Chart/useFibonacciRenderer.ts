import type { FibonacciResult } from '@marketmind/indicators';
import { getLevelColor as getFibonacciLevelColor, FIBONACCI_DEFAULT_COLOR } from '@marketmind/fibonacci';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';

interface UseFibonacciRendererProps {
  manager: CanvasManager | null;
  fibonacciData: FibonacciResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;
const HIDDEN_LEVELS = new Set([0.886, 1.382]);

const getLevelColor = (level: number, colors: ChartThemeColors): string => {
  return getFibonacciLevelColor(level, colors.fibonacci, FIBONACCI_DEFAULT_COLOR);
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
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    for (const level of fibonacciData.levels) {
      if (!level || HIDDEN_LEVELS.has(level.level)) continue;

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
