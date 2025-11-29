import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';
import { calculateVolumeMA, getVolumeMAPeriod } from '@renderer/utils/indicators/volume';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';

export interface UseVolumeRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  opacity?: number;
  rightMargin?: number;
  volumeHeightRatio?: number;
  hoveredCandleIndex?: number;
  timeframe?: string;
  showVolumeMA?: boolean;
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
  timeframe = '1h',
  showVolumeMA = true,
}: UseVolumeRendererProps): UseVolumeRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();
    const candles = manager.getCandles();

    if (!ctx || !dimensions || !bounds || !candles) return;

    const visibleCandles = manager.getVisibleCandles();
    const { chartHeight, chartWidth } = dimensions;
    const { candleWidth } = viewport;
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
    
    const visibleRange = viewport.end - viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;

    ctx.save();

    const volumeOverlayHeight = chartHeight * (volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO);
    const volumeBaseY = chartHeight;

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x + candleWidth < 0 || x > effectiveWidth) return;

      const barX = x + (widthPerCandle - candleWidth) / 2;

      const volumeRatio = candle.volume / bounds.maxVolume;
      const barHeight = volumeRatio * volumeOverlayHeight;

      const isBullish = candle.close >= candle.open;
      const baseColor = isBullish ? colors.bullish : colors.bearish;
      const isHovered = hoveredCandleIndex === actualIndex;
      
      const rgbMatch = baseColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const volumeOpacity = isHovered ? opacity * 2.5 : opacity;
      const color = rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]
        ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${volumeOpacity})`
        : `rgba(120, 120, 120, ${volumeOpacity})`;

      if (isHovered) {
        ctx.save();
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 6;
      }

      drawRect(ctx, barX, volumeBaseY - barHeight, candleWidth, barHeight, color);

      if (isHovered) {
        ctx.restore();
      }
    });

    if (showVolumeMA && candles.length > 0) {
      const period = getVolumeMAPeriod(timeframe);
      const volumeMA = calculateVolumeMA(candles, period);
      
      ctx.strokeStyle = colors.volume;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let hasMovedTo = false;

      visibleCandles.forEach((candle, index) => {
        const actualIndex = Math.floor(viewport.start) + index;
        const maValue = volumeMA.values[actualIndex];
        
        if (maValue === null || maValue === undefined) return;

        const x = manager.indexToX(actualIndex);
        if (x + candleWidth < 0 || x > effectiveWidth) return;

        const barX = x + (widthPerCandle - candleWidth) / 2 + candleWidth / 2;
        const volumeRatio = maValue / bounds.maxVolume;
        const y = volumeBaseY - (volumeRatio * volumeOverlayHeight);

        if (!hasMovedTo) {
          ctx.moveTo(barX, y);
          hasMovedTo = true;
        } else {
          ctx.lineTo(barX, y);
        }
      });

      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [manager, colors, enabled, opacity, rightMargin, volumeHeightRatio, hoveredCandleIndex, timeframe, showVolumeMA]);

  return { render };
};
