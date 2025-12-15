import { calculateBollingerBandsArray } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback, useMemo } from 'react';

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
  const bollingerData = useMemo(() => {
    if (!manager || !enabled) return null;
    const klines = manager.getKlines();
    if (!klines || klines.length === 0) return null;
    return calculateBollingerBandsArray(klines, period, stdDev);
  }, [manager, enabled, period, stdDev, manager?.getKlines()?.length]);

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
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    const upperPoints: Array<{ x: number; y: number }> = [];
    const lowerPoints: Array<{ x: number; y: number }> = [];
    const middlePoints: Array<{ x: number; y: number }> = [];

    for (let i = startIndex; i < endIndex; i++) {
      const bb = bollingerData[i];
      if (!bb) continue;

      const x = manager.indexToX(i) + klineCenterOffset;
      if (x > effectiveWidth) break;

      upperPoints.push({ x, y: manager.priceToY(bb.upper) });
      middlePoints.push({ x, y: manager.priceToY(bb.middle) });
      lowerPoints.push({ x, y: manager.priceToY(bb.lower) });
    }

    if (upperPoints.length > 1 && lowerPoints.length > 1) {
      ctx.fillStyle = colors.bollingerBands?.fill ?? 'rgba(33, 150, 243, 0.08)';
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

    ctx.strokeStyle = colors.bollingerBands?.upper ?? 'rgba(33, 150, 243, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (upperPoints.length > 0) {
      ctx.moveTo(upperPoints[0]!.x, upperPoints[0]!.y);
      for (let i = 1; i < upperPoints.length; i++) {
        ctx.lineTo(upperPoints[i]!.x, upperPoints[i]!.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = colors.bollingerBands?.lower ?? 'rgba(33, 150, 243, 0.6)';
    ctx.beginPath();
    if (lowerPoints.length > 0) {
      ctx.moveTo(lowerPoints[0]!.x, lowerPoints[0]!.y);
      for (let i = 1; i < lowerPoints.length; i++) {
        ctx.lineTo(lowerPoints[i]!.x, lowerPoints[i]!.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = colors.bollingerBands?.middle ?? 'rgba(33, 150, 243, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (middlePoints.length > 0) {
      ctx.moveTo(middlePoints[0]!.x, middlePoints[0]!.y);
      for (let i = 1; i < middlePoints.length; i++) {
        ctx.lineTo(middlePoints[i]!.x, middlePoints[i]!.y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }, [manager, enabled, bollingerData, colors, rightMargin]);

  return { render };
};
