import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
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
}

export const useCurrentPriceLineRenderer = ({
  manager,
  colors,
  enabled = true,
  lineWidth = 2,
  lineStyle = 'dashed',
  rightMargin = 72,
}: UseCurrentPriceLineRendererProps): UseCurrentPriceLineRendererReturn => {
  const render = useCallback((): void => {
    if (!enabled || !manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    const candles = manager.getCandles();
    
    if (!candles.length || !ctx || !dimensions || !bounds) return;

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) return;

    const currentPrice = lastCandle.close;
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

    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    const priceText = currentPrice.toFixed(2);
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const labelPadding = 8;
    const labelX = lineEndX;
    const labelWidth = rightMargin;
    const labelHeight = 18;
    const arrowWidth = 6;
    
    ctx.fillStyle = colors.currentPriceLabel.bg;
    
    ctx.beginPath();
    ctx.moveTo(labelX, y);
    ctx.lineTo(labelX + arrowWidth, y - labelHeight / 2);
    ctx.lineTo(labelX + labelWidth, y - labelHeight / 2);
    ctx.lineTo(labelX + labelWidth, y + labelHeight / 2);
    ctx.lineTo(labelX + arrowWidth, y + labelHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = colors.currentPriceLabel.text;
    ctx.fillText(priceText, labelX + arrowWidth + labelPadding, y);

    ctx.restore();
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin, manager?.getCandles()]);

  return { render };
};
