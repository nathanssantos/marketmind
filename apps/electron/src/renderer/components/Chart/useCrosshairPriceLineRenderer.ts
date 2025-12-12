import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';

const CROSSHAIR_DASH_PATTERN = [1, 3] as const;
const DASHED_LINE_PATTERN = [8, 4] as const;
const DOTTED_LINE_PATTERN = [2, 3] as const;

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

    const { width, chartWidth, chartHeight } = dimensions;

    const priceScaleLeft = width - rightMargin;
    const isInChartArea = mouseX < priceScaleLeft;

    if (!isInChartArea) return;
    if (mouseY < 0 || mouseY > chartHeight) return;

    const price = manager.yToPrice(mouseY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();
    
    ctx.strokeStyle = colors.crosshair;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.6;
    
    if (lineStyle === 'dashed') {
      ctx.setLineDash(DASHED_LINE_PATTERN);
    } else if (lineStyle === 'dotted') {
      ctx.setLineDash(DOTTED_LINE_PATTERN);
    } else {
      ctx.setLineDash(CROSSHAIR_DASH_PATTERN);
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

    if (mouseY < 0 || mouseY > chartHeight) return;

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
