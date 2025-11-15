import type { ChartColors } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';

export interface UseVolumeRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  opacity?: number;
}

export interface UseVolumeRendererReturn {
  render: () => void;
}

export const useVolumeRenderer = ({
  manager,
  colors,
  enabled = true,
  opacity = 0.2,
}: UseVolumeRendererProps): UseVolumeRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();

    if (!ctx || !dimensions || !bounds) return;

    const visibleCandles = manager.getVisibleCandles();
    const { chartHeight, chartWidth } = dimensions;
    const { candleWidth } = viewport;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const volumeAreaHeight = chartHeight * CHART_CONFIG.VOLUME_HEIGHT_RATIO;
    const volumeBaseY = chartHeight - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x < 0 || x > chartWidth) return;

      const volumeRatio = candle.volume / bounds.maxVolume;
      const volumeHeight = volumeRatio * volumeAreaHeight;

      const isBullish = candle.close >= candle.open;
      const baseColor = isBullish ? colors.bullish : colors.bearish;
      
      const rgbMatch = baseColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const color = rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]
        ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${opacity})`
        : `rgba(120, 120, 120, ${opacity})`;

      drawRect(ctx, x, volumeBaseY - volumeHeight, candleWidth, volumeHeight, color);
    });

    ctx.restore();
  }, [manager, colors, enabled, opacity]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
