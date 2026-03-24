import { calculateIntradayVWAP, calculateWeeklyVWAP, calculateMonthlyVWAP } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { INDICATOR_COLORS } from '@shared/constants';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback } from 'react';

export type VWAPPeriod = 'daily' | 'weekly' | 'monthly';

const VWAP_FALLBACK_COLORS: Record<VWAPPeriod, string> = {
  daily: INDICATOR_COLORS.VWAP_DAILY_LINE,
  weekly: INDICATOR_COLORS.VWAP_WEEKLY_LINE,
  monthly: INDICATOR_COLORS.VWAP_LINE,
};

const VWAP_LINE_WIDTH = 3;
const VWAP_DASH_PATTERN = [6, 4];

const VWAP_CALCULATORS: Record<VWAPPeriod, typeof calculateMonthlyVWAP> = {
  daily: calculateIntradayVWAP,
  weekly: calculateWeeklyVWAP,
  monthly: calculateMonthlyVWAP,
};

export interface UseVWAPRendererProps {
  manager: CanvasManager | null;
  colors?: ChartThemeColors;
  enabled?: boolean;
  period?: VWAPPeriod;
}

export const useVWAPRenderer = ({
  manager,
  colors,
  enabled = true,
  period = 'monthly',
}: UseVWAPRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !klines || klines.length === 0) return;

    const calculate = VWAP_CALCULATORS[period];
    const vwapValues = calculate(klines);
    if (vwapValues.length === 0) return;

    const color = colors?.vwap?.[period] ?? VWAP_FALLBACK_COLORS[period];
    const { chartWidth, chartHeight } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    ctx.strokeStyle = color;
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
        const priceText = formatChartPrice(lastVisibleValue);
        drawPriceTag(ctx, priceText, y, chartWidth, color, CHART_CONFIG.CANVAS_PADDING_RIGHT);
      }
    }
  }, [manager, colors, enabled, period]);

  return { render };
};
