import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { getKlineClose } from '@shared/utils';
import { useCallback } from 'react';

interface UseCurrentPriceLineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  rightMargin?: number;
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
  lineStyle = 'dashed',
  rightMargin = 72,
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
    const { width } = dimensions;
    const y = manager.priceToY(currentPrice);

    ctx.save();
    ctx.strokeStyle = colors.bullish;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.8;
    
    if (lineStyle === 'dashed') {
      ctx.setLineDash([8, 4]);
    } else if (lineStyle === 'dotted') {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }

    const lineEndX = width - rightMargin;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lineEndX, y);
    ctx.stroke();
    ctx.restore();
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin, manager?.getKlines()]);

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
    const { width } = dimensions;
    const y = manager.priceToY(currentPrice);

    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const priceText = currentPrice.toFixed(2);
    const lineEndX = width - rightMargin;
    
    drawPriceTag(ctx, priceText, y, lineEndX, colors.currentPriceLabel.bg);

    ctx.restore();
  }, [manager, colors, rightMargin, manager?.getKlines()]);

  const render = useCallback((): void => {
    renderLine();
    renderLabel();
  }, [renderLine, renderLabel]);

  return { render, renderLine, renderLabel };
};
