import type { HighlightedCandle, Kline } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawCandleLabel } from '@renderer/utils/canvas/drawingUtils';
import { ACTIVITY_COLORS, CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineTrades, getKlineVolume } from '@shared/utils';
import type { MutableRefObject } from 'react';
import { useCallback, useRef } from 'react';

interface AvgCache {
  klines: Kline[];
  length: number;
  avgTrades: number;
  avgVolume: number;
}

export interface UseKlineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  showActivityIndicator?: boolean;
  klineWickWidth?: number;
  hoveredKlineIndexRef?: MutableRefObject<number | undefined>;
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
  showActivityIndicator = true,
  klineWickWidth,
  hoveredKlineIndexRef,
  highlightedCandlesRef,
}: UseKlineRendererProps): UseKlineRendererReturn => {
  const avgCacheRef = useRef<AvgCache | null>(null);

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

    const allKlines = manager.getKlines() ?? [];
    let avgTrades = 0;
    let avgVolume = 0;
    if (allKlines.length > 0) {
      const cache = avgCacheRef.current;
      if (cache?.klines === allKlines && cache.length === allKlines.length) {
        avgTrades = cache.avgTrades;
        avgVolume = cache.avgVolume;
      } else {
        let sumT = 0;
        let sumV = 0;
        for (let i = 0; i < allKlines.length; i++) {
          const k = allKlines[i]!;
          sumT += getKlineTrades(k);
          sumV += getKlineVolume(k);
        }
        avgTrades = sumT / allKlines.length;
        avgVolume = sumV / allKlines.length;
        avgCacheRef.current = { klines: allKlines, length: allKlines.length, avgTrades, avgVolume };
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const highlightedCandles = highlightedCandlesRef?.current ?? [];
    const highlightedIndicesMap = highlightedCandles.length > 0
      ? new Map(highlightedCandles.map((c) => [c.index, c]))
      : null;

    const baseWickWidth = klineWickWidth ?? CHART_CONFIG.KLINE_WICK_WIDTH;
    const scaledWickWidth = klineWidth > 100
      ? Math.max(baseWickWidth, Math.round(klineWidth / 30))
      : baseWickWidth;

    interface KlineDraw {
      klineX: number;
      bodyTop: number;
      bodyHeight: number;
      wickX: number;
      wickTop: number;
      wickBottom: number;
      bodyY: number;
      isBullish: boolean;
      isHovered: boolean;
      actualIndex: number;
      visualTopY: number;
      kline: Kline;
    }

    const bullishDraws: KlineDraw[] = [];
    const bearishDraws: KlineDraw[] = [];
    const highlightedDraws: KlineDraw[] = [];

    for (let i = 0; i < visibleKlines.length; i++) {
      const kline = visibleKlines[i]!;
      const actualIndex = Math.floor(viewport.start) + i;
      const x = manager.indexToX(actualIndex);
      if (x + klineWidth < 0 || x > chartWidth) continue;

      const klineX = x + (widthPerKline - klineWidth) / 2;
      const open = getKlineOpen(kline);
      const close = getKlineClose(kline);
      const openY = manager.priceToY(open);
      const closeY = manager.priceToY(close);
      const highY = manager.priceToY(getKlineHigh(kline));
      const lowY = manager.priceToY(getKlineLow(kline));
      const isBullish = close >= open;
      const visualTopY = Math.min(highY, lowY);

      const highlighted = highlightedIndicesMap?.get(actualIndex);
      const hoveredIdx = hoveredKlineIndexRef?.current;
      const isHovered = hoveredIdx === actualIndex || !!highlighted;

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(openY, closeY) - bodyTop;
      const wickTop = Math.min(highY, lowY);
      const wickBottom = Math.max(highY, lowY);

      const draw: KlineDraw = {
        klineX,
        bodyTop,
        bodyHeight,
        wickX: klineX + klineWidth / 2,
        wickTop,
        wickBottom,
        bodyY: openY,
        isBullish,
        isHovered,
        actualIndex,
        visualTopY,
        kline,
      };

      if (isHovered) highlightedDraws.push(draw);
      else if (isBullish) bullishDraws.push(draw);
      else bearishDraws.push(draw);
    }

    const strokeBatch = (list: KlineDraw[], color: string): void => {
      if (list.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = scaledWickWidth;
      ctx.beginPath();
      for (const d of list) {
        if (d.wickTop < d.bodyTop) {
          ctx.moveTo(d.wickX, d.wickTop);
          ctx.lineTo(d.wickX, d.bodyTop);
        }
        if (d.wickBottom > d.bodyTop + d.bodyHeight) {
          ctx.moveTo(d.wickX, d.bodyTop + d.bodyHeight);
          ctx.lineTo(d.wickX, d.wickBottom);
        }
      }
      ctx.stroke();
    };

    const fillBatch = (list: KlineDraw[], color: string): void => {
      if (list.length === 0) return;
      ctx.fillStyle = color;
      for (const d of list) {
        if (d.bodyHeight > 0) {
          ctx.fillRect(d.klineX, d.bodyTop, klineWidth, d.bodyHeight);
        } else {
          ctx.fillRect(d.klineX, d.bodyY - scaledWickWidth / 2, klineWidth, scaledWickWidth);
        }
      }
    };

    strokeBatch(bullishDraws, colors.bullish);
    strokeBatch(bearishDraws, colors.bearish);
    fillBatch(bullishDraws, colors.bullish);
    fillBatch(bearishDraws, colors.bearish);

    for (const d of highlightedDraws) {
      const color = d.isBullish ? colors.bullish : colors.bearish;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = scaledWickWidth;
      ctx.beginPath();
      if (d.wickTop < d.bodyTop) {
        ctx.moveTo(d.wickX, d.wickTop);
        ctx.lineTo(d.wickX, d.bodyTop);
      }
      if (d.wickBottom > d.bodyTop + d.bodyHeight) {
        ctx.moveTo(d.wickX, d.bodyTop + d.bodyHeight);
        ctx.lineTo(d.wickX, d.wickBottom);
      }
      ctx.stroke();
      ctx.fillStyle = color;
      if (d.bodyHeight > 0) {
        ctx.fillRect(d.klineX, d.bodyTop, klineWidth, d.bodyHeight);
      } else {
        ctx.fillRect(d.klineX, d.bodyY - scaledWickWidth / 2, klineWidth, scaledWickWidth);
      }
      ctx.restore();
    }

    const wantsActivity = showActivityIndicator && klineWidth >= 4 && avgTrades > 0;
    const wantsLabels = highlightedIndicesMap && klineWidth >= 4;

    if (wantsLabels || wantsActivity) {
      const lists: KlineDraw[][] = [bullishDraws, bearishDraws, highlightedDraws];
      const indicatorSize = klineWidth > 0 ? Math.min(klineWidth * 0.3, 3) : 3;

      const processDraw = (d: KlineDraw): void => {
        if (wantsLabels) {
          const highlighted = highlightedIndicesMap.get(d.actualIndex);
          if (highlighted) {
            const labelColor = HIGHLIGHT_LABEL_COLORS[highlighted.role] ?? HIGHLIGHT_LABEL_COLORS.context;
            drawCandleLabel(ctx, d.klineX + klineWidth / 2, d.visualTopY, highlighted.offset.toString(), labelColor);
          }
        }

        if (wantsActivity) {
          const trades = getKlineTrades(d.kline);
          const volume = getKlineVolume(d.kline);
          const isHighActivity = trades > avgTrades * 1.5 && volume > avgVolume * 1.5;
          const isLowActivity = trades < avgTrades * 0.3 && volume < avgVolume * 0.5;

          if (isHighActivity || isLowActivity) {
            ctx.save();
            ctx.fillStyle = isHighActivity ? ACTIVITY_COLORS.HIGH_ACTIVITY : ACTIVITY_COLORS.LOW_ACTIVITY;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(d.klineX + klineWidth / 2, d.visualTopY - indicatorSize - 4, indicatorSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isHighActivity ? ACTIVITY_COLORS.HIGH_ACTIVITY_STROKE : ACTIVITY_COLORS.LOW_ACTIVITY_STROKE;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
          }
        }
      };

      for (const list of lists) {
        for (const d of list) processDraw(d);
      }
    }

    ctx.restore();
  }, [manager, colors, enabled, showActivityIndicator, klineWickWidth, hoveredKlineIndexRef, highlightedCandlesRef]);

  return { render };
};
