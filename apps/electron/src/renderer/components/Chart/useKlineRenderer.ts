import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawKline } from '@renderer/utils/canvas/drawingUtils';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineTrades, getKlineVolume } from '@shared/utils';
import { useCallback } from 'react';

export interface UseKlineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  rightMargin?: number;
  klineWickWidth?: number;
  hoveredKlineIndex?: number;
}

export interface UseKlineRendererReturn {
  render: () => void;
}

export const useKlineRenderer = ({
  manager,
  colors,
  enabled = true,
  rightMargin,
  klineWickWidth,
  hoveredKlineIndex,
}: UseKlineRendererProps): UseKlineRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const visibleKlines = manager.getVisibleKlines();
    const { klineWidth } = viewport;
    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;

    const allKlines = manager.getKlines();
    const avgTrades = allKlines && allKlines.length > 0
      ? allKlines.reduce((sum, k) => sum + getKlineTrades(k), 0) / allKlines.length
      : 0;
    const avgVolume = allKlines && allKlines.length > 0
      ? allKlines.reduce((sum, k) => sum + getKlineVolume(k), 0) / allKlines.length
      : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    visibleKlines.forEach((kline, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x + klineWidth < 0 || x > effectiveWidth) return;

      const klineX = x + (widthPerKline - klineWidth) / 2;

      const openY = manager.priceToY(getKlineOpen(kline));
      const closeY = manager.priceToY(getKlineClose(kline));
      const highY = manager.priceToY(getKlineHigh(kline));
      const lowY = manager.priceToY(getKlineLow(kline));

      const isHovered = hoveredKlineIndex === actualIndex;

      drawKline(
        ctx,
        klineX,
        openY,
        closeY,
        highY,
        lowY,
        klineWidth,
        klineWickWidth ?? CHART_CONFIG.KLINE_WICK_WIDTH,
        colors.bullish,
        colors.bearish,
        isHovered,
      );

      if (klineWidth >= 4 && avgTrades > 0) {
        const trades = getKlineTrades(kline);
        const volume = getKlineVolume(kline);

        const isHighActivity = trades > avgTrades * 1.5 && volume > avgVolume * 1.5;
        const isLowActivity = trades < avgTrades * 0.3 && volume < avgVolume * 0.5;

        if (isHighActivity || isLowActivity) {
          const indicatorSize = Math.min(klineWidth * 0.3, 3);
          const indicatorX = klineX + klineWidth / 2;
          const indicatorY = highY - indicatorSize - 4;

          ctx.save();
          ctx.fillStyle = isHighActivity ? '#00FF00' : '#FF1493';
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(indicatorX, indicatorY, indicatorSize, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isHighActivity ? '#00CC00' : '#CC0066';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    ctx.restore();
  }, [manager, colors, enabled, rightMargin, klineWickWidth, hoveredKlineIndex]);

  return { render };
};
