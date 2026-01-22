import type { HighlightedCandle } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawCandleLabel, drawKline } from '@renderer/utils/canvas/drawingUtils';
import { ACTIVITY_COLORS, CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineTrades, getKlineVolume } from '@shared/utils';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

export interface UseKlineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  klineWickWidth?: number;
  hoveredKlineIndex?: number;
  highlightedCandlesRef?: MutableRefObject<HighlightedCandle[]>;
}

export interface UseKlineRendererReturn {
  render: () => void;
}

const HIGHLIGHT_LABEL_COLORS = {
  trigger: INDICATOR_COLORS.HIGHLIGHT_TRIGGER,
  confirmation: INDICATOR_COLORS.HIGHLIGHT_CONFIRMATION,
  reference: INDICATOR_COLORS.HIGHLIGHT_REFERENCE,
  context: INDICATOR_COLORS.HIGHLIGHT_CONTEXT,
};

export const useKlineRenderer = ({
  manager,
  colors,
  enabled = true,
  klineWickWidth,
  hoveredKlineIndex,
  highlightedCandlesRef,
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

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = chartWidth / visibleRange;

    const allKlines = manager.getKlines();
    const avgTrades = allKlines && allKlines.length > 0
      ? allKlines.reduce((sum, k) => sum + getKlineTrades(k), 0) / allKlines.length
      : 0;
    const avgVolume = allKlines && allKlines.length > 0
      ? allKlines.reduce((sum, k) => sum + getKlineVolume(k), 0) / allKlines.length
      : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const highlightedCandles = highlightedCandlesRef?.current ?? [];
    const highlightedIndicesMap = new Map(
      highlightedCandles.map((c) => [c.index, c])
    );

    visibleKlines.forEach((kline, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x + klineWidth < 0 || x > chartWidth) return;

      const klineX = x + (widthPerKline - klineWidth) / 2;

      const openY = manager.priceToY(getKlineOpen(kline));
      const closeY = manager.priceToY(getKlineClose(kline));
      const highY = manager.priceToY(getKlineHigh(kline));
      const lowY = manager.priceToY(getKlineLow(kline));

      const highlightedCandle = highlightedIndicesMap.get(actualIndex);
      const isHovered = hoveredKlineIndex === actualIndex || !!highlightedCandle;

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

      if (highlightedCandle && klineWidth >= 4) {
        const labelColor = HIGHLIGHT_LABEL_COLORS[highlightedCandle.role] ?? HIGHLIGHT_LABEL_COLORS.context;
        const labelText = highlightedCandle.offset.toString();
        const labelX = klineX + klineWidth / 2;
        drawCandleLabel(ctx, labelX, highY, labelText, labelColor);
      }

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
          ctx.fillStyle = isHighActivity ? ACTIVITY_COLORS.HIGH_ACTIVITY : ACTIVITY_COLORS.LOW_ACTIVITY;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(indicatorX, indicatorY, indicatorSize, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isHighActivity ? ACTIVITY_COLORS.HIGH_ACTIVITY_STROKE : ACTIVITY_COLORS.LOW_ACTIVITY_STROKE;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    ctx.restore();
  }, [manager, colors, enabled, klineWickWidth, hoveredKlineIndex]);

  return { render };
};
