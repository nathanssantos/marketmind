import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import {
  computeSecondsRemaining,
  drawCurrentPriceTag,
  formatTimerText,
} from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineOpen } from '@shared/utils';
import { useCallback } from 'react';

interface UseCurrentPriceLineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  lineWidth?: number;
  timeframe?: string;
}

interface UseCurrentPriceLineRendererReturn {
  render: () => void;
  renderLine: () => void;
  renderLabel: () => void;
}

export const useCurrentPriceLineRenderer = ({
  manager,
  colors,
  enabled = true,
  lineWidth = 2,
  timeframe,
}: UseCurrentPriceLineRendererProps): UseCurrentPriceLineRendererReturn => {
  const renderLine = useCallback((): void => {
    if (!enabled || !manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    const klines = manager.getKlines();

    if (!klines.length || !ctx || !dimensions || !bounds) return;

    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const currentPrice = getKlineClose(lastKline);
    const openPrice = getKlineOpen(lastKline);
    const isBullish = currentPrice >= openPrice;
    const candleColor = isBullish ? colors.bullish : colors.bearish;

    const { chartWidth, chartHeight } = dimensions;
    const y = manager.priceToY(currentPrice);

    if (y < 0 || y > chartHeight) return;

    ctx.save();
    ctx.strokeStyle = candleColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([2, 3]);

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.restore();
  }, [enabled, manager, colors, lineWidth, manager?.getKlines()]);

  const renderLabel = useCallback((): void => {
    if (!manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    const klines = manager.getKlines();

    if (!klines.length || !ctx || !dimensions || !bounds) return;

    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const currentPrice = getKlineClose(lastKline);
    const openPrice = getKlineOpen(lastKline);
    const isBullish = currentPrice >= openPrice;
    const bgColor = isBullish ? colors.bullish : colors.bearish;

    const { chartWidth, chartHeight } = dimensions;
    const y = manager.priceToY(currentPrice);

    if (y < 0 || y > chartHeight) return;

    const priceText = formatChartPrice(currentPrice);
    const timerText = timeframe
      ? formatTimerText(computeSecondsRemaining(timeframe, lastKline.openTime))
      : null;

    drawCurrentPriceTag(
      ctx,
      priceText,
      timerText,
      y,
      chartWidth,
      bgColor,
      colors.axisLine,
      CHART_CONFIG.CANVAS_PADDING_RIGHT,
      '#ffffff'
    );
  }, [manager, colors, timeframe, manager?.getKlines()]);

  const render = useCallback((): void => {
    renderLine();
    renderLabel();
  }, [renderLine, renderLabel]);

  return { render, renderLine, renderLabel };
};
