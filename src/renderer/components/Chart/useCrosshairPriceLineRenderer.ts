import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants';
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

const drawPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  y: number,
  x: number,
  fillColor: string,
  fixedWidth: number = 72
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;
  const tagWidth = fixedWidth;
  
  ctx.save();
  ctx.fillStyle = fillColor;
  
  const endX = x + tagWidth;
  ctx.beginPath();
  ctx.moveTo(x - arrowWidth, y);
  ctx.lineTo(x, y - labelHeight / 2);
  ctx.lineTo(endX, y - labelHeight / 2);
  ctx.lineTo(endX, y + labelHeight / 2);
  ctx.lineTo(x, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText(priceText, x + labelPadding, y);
  
  ctx.restore();
  return { width: tagWidth + arrowWidth, height: labelHeight };
};

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

    const { width, chartWidth, chartHeight } = dimensions;

    const priceScaleLeft = width - rightMargin;
    const isInChartArea = mouseX < priceScaleLeft;

    if (!isInChartArea) return;

    const price = manager.yToPrice(mouseY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();
    
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

    const lineEndX = chartWidth;
    
    ctx.beginPath();
    ctx.moveTo(0, mouseY);
    ctx.lineTo(lineEndX, mouseY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, chartHeight);
    ctx.stroke();

    ctx.restore();

    const priceText = price.toFixed(2);
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const tagStartX = width - CHART_CONFIG.CHART_RIGHT_MARGIN;
    
    ctx.fillStyle = colors.crosshair;
    const labelPadding = 8;
    const labelHeight = 18;
    const arrowWidth = 6;
    const tagWidth = CHART_CONFIG.CHART_RIGHT_MARGIN;
    
    const endX = tagStartX + tagWidth;
    ctx.beginPath();
    ctx.moveTo(tagStartX - arrowWidth, mouseY);
    ctx.lineTo(tagStartX, mouseY - labelHeight / 2);
    ctx.lineTo(endX, mouseY - labelHeight / 2);
    ctx.lineTo(endX, mouseY + labelHeight / 2);
    ctx.lineTo(tagStartX, mouseY + labelHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = colors.background;
    ctx.fillText(priceText, tagStartX + labelPadding, mouseY);

    ctx.restore();
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin, mouseX, mouseY]);

  return { render };
};
