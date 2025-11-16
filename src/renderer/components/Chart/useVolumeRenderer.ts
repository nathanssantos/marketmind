import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';
import { CHART_CONFIG } from '@shared/constants';
import type { ChartColors } from '@shared/types';
import { useCallback, useEffect } from 'react';

export interface UseVolumeRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  opacity?: number;
  rightMargin?: number;
  volumeHeightRatio?: number;
  hoveredCandleIndex?: number;
}

export interface UseVolumeRendererReturn {
  render: () => void;
}

export const useVolumeRenderer = ({
  manager,
  colors,
  enabled = true,
  opacity = 0.2,
  rightMargin,
  volumeHeightRatio,
  hoveredCandleIndex,
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
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    // Render volume within the main chart area (bottom 25%)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    const volumeOverlayHeight = chartHeight * (volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO);
    const volumeBaseY = chartHeight;

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x < 0 || x > effectiveWidth) return;

      const volumeRatio = candle.volume / bounds.maxVolume;
      const barHeight = volumeRatio * volumeOverlayHeight;

      const isBullish = candle.close >= candle.open;
      const baseColor = isBullish ? colors.bullish : colors.bearish;
      const isHovered = hoveredCandleIndex === actualIndex;
      
      const rgbMatch = baseColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const volumeOpacity = isHovered ? opacity * 2.5 : opacity;
      const color = rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]
        ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${volumeOpacity})`
        : `rgba(120, 120, 120, ${volumeOpacity})`;

      if (isHovered) {
        ctx.save();
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 6;
      }

      drawRect(ctx, x, volumeBaseY - barHeight, candleWidth, barHeight, color);

      if (isHovered) {
        ctx.restore();
      }
    });

    ctx.restore();
  }, [manager, colors, enabled, opacity, rightMargin, volumeHeightRatio, hoveredCandleIndex, manager?.getCandles()]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
