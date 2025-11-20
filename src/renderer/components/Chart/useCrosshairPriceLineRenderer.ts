import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { useCallback } from 'react';

interface UseCrosshairPriceLineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  mouseX: number | null;
  mouseY: number | null;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  rightMargin?: number;
}

interface UseCrosshairPriceLineRendererReturn {
  render: () => void;
}

export const useCrosshairPriceLineRenderer = ({
  manager,
  colors,
  enabled = true,
  mouseX,
  mouseY,
  lineWidth = 1,
  lineStyle = 'solid',
  rightMargin = 72,
}: UseCrosshairPriceLineRendererProps): UseCrosshairPriceLineRendererReturn => {
  const render = useCallback((): void => {
    if (!enabled || !manager || mouseY === null || mouseX === null) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    
    if (!ctx || !dimensions || !bounds) return;

    const { width } = dimensions;
    const timeScaleTop = dimensions.height - 40;

    if (mouseY >= timeScaleTop) return;

    const priceScaleLeft = width - rightMargin;
    const isInChartArea = mouseX < priceScaleLeft && mouseY < timeScaleTop;

    if (!isInChartArea) return;

    const price = manager.yToPrice(mouseY);

    ctx.save();
    
    ctx.strokeStyle = colors.crosshair;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.6;
    
    if (lineStyle === 'dashed') {
      ctx.setLineDash([8, 4]);
    } else if (lineStyle === 'dotted') {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }

    const lineEndX = priceScaleLeft;
    
    ctx.beginPath();
    ctx.moveTo(0, mouseY);
    ctx.lineTo(lineEndX, mouseY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, timeScaleTop);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    const priceText = price.toFixed(2);
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const labelPadding = 8;
    const labelX = lineEndX;
    const labelWidth = rightMargin;
    const labelHeight = 18;
    const arrowWidth = 6;
    
    ctx.fillStyle = colors.crosshair;
    
    ctx.beginPath();
    ctx.moveTo(labelX, mouseY);
    ctx.lineTo(labelX + arrowWidth, mouseY - labelHeight / 2);
    ctx.lineTo(labelX + labelWidth, mouseY - labelHeight / 2);
    ctx.lineTo(labelX + labelWidth, mouseY + labelHeight / 2);
    ctx.lineTo(labelX + arrowWidth, mouseY + labelHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = colors.background;
    ctx.fillText(priceText, labelX + arrowWidth + labelPadding, mouseY);

    ctx.restore();
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin, mouseX, mouseY]);

  return { render };
};
