import { useMemo } from 'react';
import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@shared/types';

interface UseCurrentPriceLineRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
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
  const render = useMemo(() => {
    return (): void => {
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

      // Calculate Y position for current price
      const y = manager.priceToY(currentPrice);

      ctx.save();
      
      // Set line style
      ctx.strokeStyle = colors.bullish;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 0.8;
      
      // Apply dash pattern based on style
      if (lineStyle === 'dashed') {
        ctx.setLineDash([8, 4]);
      } else if (lineStyle === 'dotted') {
        ctx.setLineDash([2, 3]);
      } else {
        ctx.setLineDash([]);
      }

      // Draw the line across the entire chart width (excluding right margin)
      const lineEndX = width - rightMargin;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lineEndX, y);
      ctx.stroke();

      // Reset line dash for label
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Draw price label on the right
      const priceText = currentPrice.toFixed(2);
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      // Background for label
      const labelPadding = 4;
      const textMetrics = ctx.measureText(priceText);
      const labelX = lineEndX + 4;
      const labelWidth = textMetrics.width + labelPadding * 2;
      const labelHeight = 16;
      
      ctx.fillStyle = colors.bullish;
      ctx.fillRect(labelX, y - labelHeight / 2, labelWidth, labelHeight);
      
      // Price text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(priceText, labelX + labelPadding, y);

      ctx.restore();
    };
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin]);

  return { render };
};
