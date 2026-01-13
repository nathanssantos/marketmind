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

const SECONDARY_LEVELS = [0.236, 0.382, 0.786];
const DEFAULT_LEVEL_COLOR = 'rgba(180, 180, 180, 0.7)';
const SECONDARY_LEVEL_COLOR = 'rgba(120, 120, 120, 0.4)';
const LEVEL_618_COLOR = 'rgba(255, 167, 38, 0.8)';
const LEVEL_127_COLOR = 'rgba(66, 165, 245, 0.8)';
const LEVEL_161_COLOR = 'rgba(255, 167, 38, 0.8)';
const LINE_WIDTH = 1;
const LEVEL_DASH = [4, 4] as const;

const getLevelColor = (level: number): string => {
  if (level === 0.618) return LEVEL_618_COLOR;
  if (level === 1.272) return LEVEL_127_COLOR;
  if (level === 1.618) return LEVEL_161_COLOR;
  if (SECONDARY_LEVELS.includes(level)) return SECONDARY_LEVEL_COLOR;
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
