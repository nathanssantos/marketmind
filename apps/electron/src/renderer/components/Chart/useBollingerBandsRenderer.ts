import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { useBBWorker } from '@renderer/hooks/useBBWorker';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';

export interface UseBollingerBandsRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  period?: number;
  stdDev?: number;
  rightMargin?: number;
}

export const useBollingerBandsRenderer = ({
  manager,
  colors,
  enabled = true,
  period = 20,
  stdDev = 2,
  rightMargin,
}: UseBollingerBandsRendererProps) => {
  const klines = manager?.getKlines() ?? [];
  const bollingerData = useBBWorker(klines, period, stdDev, enabled && klines.length > 0);

  const render = useCallback((): void => {
    if (!manager || !enabled || !bollingerData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !klines) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const upperPoints: Array<{ x: number; y: number }> = [];
    const lowerPoints: Array<{ x: number; y: number }> = [];
    const middlePoints: Array<{ x: number; y: number }> = [];

    for (let i = startIndex; i < endIndex; i++) {
      const upper = bollingerData.upper[i];
      const middle = bollingerData.middle[i];
      const lower = bollingerData.lower[i];
      if (upper == null || middle == null || lower == null) continue;

      const x = manager.indexToX(i) + klineCenterOffset;
      upperPoints.push({ x, y: manager.priceToY(upper) });
      middlePoints.push({ x, y: manager.priceToY(middle) });
      lowerPoints.push({ x, y: manager.priceToY(lower) });
    }

    if (upperPoints.length > 1 && lowerPoints.length > 1) {
      ctx.fillStyle = colors.bollingerBands?.fill ?? INDICATOR_COLORS.BOLLINGER_FILL;
      ctx.beginPath();

      ctx.moveTo(upperPoints[0]!.x, upperPoints[0]!.y);
      for (let i = 1; i < upperPoints.length; i++) {
        ctx.lineTo(upperPoints[i]!.x, upperPoints[i]!.y);
      }

      for (let i = lowerPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(lowerPoints[i]!.x, lowerPoints[i]!.y);
      }

      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = colors.bollingerBands?.upper ?? INDICATOR_COLORS.BOLLINGER_UPPER;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.OVERLAY;
    ctx.beginPath();
    if (upperPoints.length > 0) {
      ctx.moveTo(upperPoints[0]!.x, upperPoints[0]!.y);
      for (let i = 1; i < upperPoints.length; i++) {
        ctx.lineTo(upperPoints[i]!.x, upperPoints[i]!.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = colors.bollingerBands?.lower ?? INDICATOR_COLORS.BOLLINGER_LOWER;
    ctx.beginPath();
    if (lowerPoints.length > 0) {
      ctx.moveTo(lowerPoints[0]!.x, lowerPoints[0]!.y);
      for (let i = 1; i < lowerPoints.length; i++) {
        ctx.lineTo(lowerPoints[i]!.x, lowerPoints[i]!.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = colors.bollingerBands?.middle ?? INDICATOR_COLORS.BOLLINGER_MIDDLE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.OVERLAY_MIDDLE;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (middlePoints.length > 0) {
      ctx.moveTo(middlePoints[0]!.x, middlePoints[0]!.y);
      for (let i = 1; i < middlePoints.length; i++) {
        ctx.lineTo(middlePoints[i]!.x, middlePoints[i]!.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }, [manager, enabled, bollingerData, colors, rightMargin]);

  return { render };
};
