import { calculateATR } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow } from '@shared/utils';
import { useCallback, useMemo } from 'react';

const ATR_LONG_COLOR = '#00e5ff';
const ATR_SHORT_COLOR = '#ff6d00';

interface UseATRRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  period?: number;
  multiplier?: number;
}

interface ATRTrailingStopData {
  stopPrice: number;
  isLong: boolean;
}

export const useATRRenderer = ({
  manager,
  colors,
  enabled = true,
  period = 14,
  multiplier = 2.0,
}: UseATRRendererProps) => {
  const trailingStopData = useMemo(() => {
    if (!manager || !enabled) return null;
    const klines = manager.getKlines();
    if (!klines || klines.length < period + 1) return null;

    const atrValues = calculateATR(klines, period);
    const stops: ATRTrailingStopData[] = [];

    let isLong = true;
    let stopPrice = 0;

    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];
      if (!kline) continue;

      const atr = atrValues[i];
      if (atr === undefined || isNaN(atr) || atr === 0) {
        stops.push({ stopPrice: 0, isLong });
        continue;
      }

      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      const close = getKlineClose(kline);
      const atrDistance = atr * multiplier;

      const longStop = high - atrDistance;
      const shortStop = low + atrDistance;

      if (i === 0) {
        isLong = true;
        stopPrice = longStop;
      } else {
        const prevStop = stops[i - 1];
        if (!prevStop) {
          stops.push({ stopPrice: longStop, isLong: true });
          continue;
        }

        if (isLong) {
          stopPrice = Math.max(longStop, prevStop.stopPrice);
          if (close < prevStop.stopPrice) {
            isLong = false;
            stopPrice = shortStop;
          }
        } else {
          stopPrice = Math.min(shortStop, prevStop.stopPrice);
          if (close > prevStop.stopPrice) {
            isLong = true;
            stopPrice = longStop;
          }
        }
      }

      stops.push({ stopPrice, isLong });
    }

    return stops;
  }, [manager, enabled, period, multiplier, manager?.getKlines()?.length]);

  const render = useCallback((): void => {
    if (!manager || !enabled || !trailingStopData || trailingStopData.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const effectiveWidth = dimensions.chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    ctx.save();
    ctx.lineWidth = 2;

    let currentIsLong: boolean | null = null;

    for (let i = visibleStartIndex; i <= visibleEndIndex && i < trailingStopData.length; i++) {
      const data = trailingStopData[i];
      if (!data || data.stopPrice === 0) continue;

      const x = (i - viewport.start) * klineWidth + klineWidth / 2;
      const y = manager.priceToY(data.stopPrice);

      if (currentIsLong === null) {
        currentIsLong = data.isLong;
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (data.isLong !== currentIsLong) {
        ctx.strokeStyle = currentIsLong ? ATR_LONG_COLOR : ATR_SHORT_COLOR;
        ctx.stroke();

        currentIsLong = data.isLong;
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    if (currentIsLong !== null) {
      ctx.strokeStyle = currentIsLong ? ATR_LONG_COLOR : ATR_SHORT_COLOR;
      ctx.stroke();
    }

    ctx.restore();
  }, [manager, trailingStopData, enabled, colors]);

  return { render };
};
