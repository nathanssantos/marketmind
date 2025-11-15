import type { ChartColors } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid, drawText } from '@renderer/utils/canvas/drawingUtils';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  horizontalLines?: number;
  verticalLines?: number;
}

export interface UseGridRendererReturn {
  render: () => void;
}

export const useGridRenderer = ({
  manager,
  colors,
  enabled = true,
  horizontalLines = 5,
  verticalLines = 10,
}: UseGridRendererProps): UseGridRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!ctx || !dimensions || !bounds) return;

    const { width, chartHeight } = dimensions;
    const { minPrice, maxPrice } = bounds;

    drawGrid(
      ctx,
      width,
      chartHeight,
      horizontalLines,
      verticalLines,
      colors.grid,
      CHART_CONFIG.GRID_LINE_WIDTH,
    );

    const padding = manager.getPadding();
    const spacing = chartHeight / (horizontalLines + 1);

    for (let i = 0; i <= horizontalLines + 1; i++) {
      const y = i * spacing;
      const price = manager.yToPrice(y);

      if (price >= minPrice && price <= maxPrice) {
        drawText(
          ctx,
          price.toFixed(2),
          width - padding + 5,
          y - 6,
          colors.grid,
          '11px monospace',
          'left',
          'top',
        );
      }
    }
  }, [manager, colors, enabled, horizontalLines, verticalLines]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
