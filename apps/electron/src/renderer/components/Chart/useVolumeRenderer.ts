import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';
import { calculateVolumeMA, getVolumeMAPeriod } from '@renderer/utils/indicators/volume';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineBuyPressure, getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
import { useCallback } from 'react';

export interface UseVolumeRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  opacity?: number;
  volumeHeightRatio?: number;
  hoveredKlineIndex?: number;
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
  opacity = 0.3,
  volumeHeightRatio,
  hoveredKlineIndex,
  timeframe = '1h',
  showVolumeMA = true,
}: UseVolumeRendererProps): UseVolumeRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !bounds || !klines) return;

    const visibleKlines = manager.getVisibleKlines();
    const { chartHeight, chartWidth } = dimensions;
    const { klineWidth } = viewport;

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = chartWidth / visibleRange;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const volumeOverlayHeight = chartHeight * (volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO);
    const volumeBaseY = chartHeight;
    const lastKlineIndex = klines.length - 1;

    visibleKlines.forEach((kline, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x + klineWidth < 0 || x > chartWidth) return;

      const barX = x + (widthPerKline - klineWidth) / 2;

      const volumeRatio = getKlineVolume(kline) / bounds.maxVolume;
      const barHeight = volumeRatio * volumeOverlayHeight;

      const isBullish = getKlineClose(kline) >= getKlineOpen(kline);
      const baseColor = isBullish ? colors.bullish : colors.bearish;
      const isHovered = hoveredKlineIndex === actualIndex;
      const isLastKline = actualIndex === lastKlineIndex;

      const buyPressure = getKlineBuyPressure(kline);
      const hasTakerData = parseFloat(kline.takerBuyBaseVolume) > 0;

      let finalColor: string;
      const volumeOpacity = isHovered ? opacity * 2.5 : opacity;

      const rgbMatch = baseColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const fallbackColor = rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]
        ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${volumeOpacity})`
        : `rgba(120, 120, 120, ${volumeOpacity})`;

      if (!hasTakerData) {
        finalColor = fallbackColor;
      } else if (buyPressure > 0.55) {
        const intensity = Math.min((buyPressure - 0.55) / 0.45, 1);
        const greenIntensity = Math.floor(100 + intensity * 155);
        finalColor = `rgba(34, ${greenIntensity}, 84, ${volumeOpacity})`;
      } else if (buyPressure < 0.45) {
        const intensity = Math.min((0.45 - buyPressure) / 0.45, 1);
        const redIntensity = Math.floor(100 + intensity * 155);
        finalColor = `rgba(${redIntensity}, 34, 34, ${volumeOpacity})`;
      } else {
        finalColor = fallbackColor;
      }

      if (isHovered) {
        ctx.save();
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 6;
      }

      drawRect(ctx, barX, volumeBaseY - barHeight, klineWidth, barHeight, finalColor);

      if (isHovered) {
        ctx.restore();
      }

      if (isLastKline) {
        const now = Date.now();
        const klineOpenTime = kline.openTime;
        const klineCloseTime = kline.closeTime;
        const totalDuration = klineCloseTime - klineOpenTime;
        const elapsedTime = now - klineOpenTime;

        if (totalDuration > 0 && elapsedTime > 0 && elapsedTime < totalDuration) {
          const timeProgress = elapsedTime / totalDuration;
          const currentVolume = getKlineVolume(kline);
          const projectedVolume = currentVolume / timeProgress;
          const projectedRatio = projectedVolume / bounds.maxVolume;
          const projectedHeight = Math.min(projectedRatio * volumeOverlayHeight, volumeOverlayHeight);

          if (projectedHeight > barHeight) {
            let projectionColor: string;
            const projectionFallback = rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]
              ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${opacity * 0.8})`
              : `rgba(120, 120, 120, ${opacity * 0.8})`;

            if (!hasTakerData) {
              projectionColor = projectionFallback;
            } else if (buyPressure > 0.55) {
              const intensity = Math.min((buyPressure - 0.55) / 0.45, 1);
              const greenIntensity = Math.floor(100 + intensity * 155);
              projectionColor = `rgba(34, ${greenIntensity}, 84, ${opacity * 0.8})`;
            } else if (buyPressure < 0.45) {
              const intensity = Math.min((0.45 - buyPressure) / 0.45, 1);
              const redIntensity = Math.floor(100 + intensity * 155);
              projectionColor = `rgba(${redIntensity}, 34, 34, ${opacity * 0.8})`;
            } else {
              projectionColor = projectionFallback;
            }

            ctx.save();
            ctx.setLineDash([4, 2]);
            ctx.strokeStyle = projectionColor;
            ctx.lineWidth = 2;

            const lineOffset = 1;
            const topY = volumeBaseY - projectedHeight;
            const leftX = barX + lineOffset;
            const rightX = barX + klineWidth - lineOffset;

            ctx.beginPath();
            ctx.moveTo(leftX, topY);
            ctx.lineTo(rightX, topY);
            ctx.moveTo(rightX, topY);
            ctx.lineTo(rightX, volumeBaseY - barHeight);
            ctx.moveTo(leftX, topY);
            ctx.lineTo(leftX, volumeBaseY - barHeight);
            ctx.stroke();

            ctx.restore();
          }
        }
      }
    });

    if (showVolumeMA && klines.length > 0) {
      const period = getVolumeMAPeriod(timeframe);
      const volumeMA = calculateVolumeMA(klines, period);

      ctx.strokeStyle = colors.volume;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let hasMovedTo = false;

      visibleKlines.forEach((_, index) => {
        const actualIndex = Math.floor(viewport.start) + index;
        const maValue = volumeMA.values[actualIndex];

        if (maValue === null || maValue === undefined) return;

        const x = manager.indexToX(actualIndex);
        if (x + klineWidth < 0 || x > chartWidth) return;

        const barX = x + (widthPerKline - klineWidth) / 2 + klineWidth / 2;
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
  }, [manager, colors, enabled, opacity, volumeHeightRatio, hoveredKlineIndex, timeframe, showVolumeMA]);

  return { render };
};
