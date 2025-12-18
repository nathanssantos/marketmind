import { calculateMonthlyVWAP } from '@marketmind/indicators';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback } from 'react';

const VWAP_COLOR = '#FFD700';
const VWAP_LINE_WIDTH = 3;
const VWAP_DASH_PATTERN = [6, 4];

export interface UseVWAPRendererProps {
  manager: CanvasManager | null;
  enabled?: boolean;
}

export const useVWAPRenderer = ({
  manager,
  enabled = true,
}: UseVWAPRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !klines || klines.length === 0) return;

    const vwapValues = calculateMonthlyVWAP(klines);
    if (vwapValues.length === 0) return;

    const { width, chartWidth, chartHeight } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    ctx.strokeStyle = VWAP_COLOR;
    ctx.lineWidth = VWAP_LINE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(VWAP_DASH_PATTERN);

    ctx.beginPath();

    let hasMovedTo = false;

    for (let i = startIndex; i < endIndex; i++) {
      const value = vwapValues[i];
      if (value === null || value === undefined || isNaN(value)) continue;

      const x = manager.indexToX(i);

      if (x > effectiveWidth) break;

      const centerX = x + klineCenterOffset;
      const y = manager.priceToY(value);

      if (!hasMovedTo) {
        ctx.moveTo(centerX, y);
        hasMovedTo = true;
      } else {
        ctx.lineTo(centerX, y);
      }
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const lastVisibleIndex = endIndex - 1;
    const lastVisibleValue = vwapValues[lastVisibleIndex];

    if (lastVisibleValue !== null && lastVisibleValue !== undefined && !isNaN(lastVisibleValue)) {
      const y = manager.priceToY(lastVisibleValue);

      if (y >= 0 && y <= chartHeight) {
        ctx.save();
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const priceText = lastVisibleValue.toFixed(2);
        const tagStartX = width - CHART_CONFIG.CHART_RIGHT_MARGIN;

        drawPriceTag(ctx, priceText, y, tagStartX, VWAP_COLOR, CHART_CONFIG.CHART_RIGHT_MARGIN);

        ctx.restore();
      }
    }
  }, [manager, enabled]);

  return { render };
};
