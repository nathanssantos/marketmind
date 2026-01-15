import type { CanvasManager } from '@/renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';
import type { RefObject } from 'react';
import { useCallback } from 'react';

const CROSSHAIR_DASH_PATTERN = [1, 3] as const;
const DASHED_LINE_PATTERN = [8, 4] as const;
const DOTTED_LINE_PATTERN = [2, 3] as const;

interface UseCrosshairPriceLineRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  mousePositionRef: RefObject<{ x: number; y: number } | null>;
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
  mousePositionRef,
  lineWidth = 1,
  lineStyle = 'solid',
  rightMargin = 72,
}: UseCrosshairPriceLineRendererProps): UseCrosshairPriceLineRendererReturn => {
  const render = useCallback((): void => {
    const mousePos = mousePositionRef.current;
    if (!enabled || !manager || !mousePos) return;

    const { x: mouseX, y: mouseY } = mousePos;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!ctx || !dimensions || !bounds) return;

    const { width, height, chartWidth, chartHeight } = dimensions;

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

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = colors.crosshair;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash(lineStyle === 'dashed' ? DASHED_LINE_PATTERN : lineStyle === 'dotted' ? DOTTED_LINE_PATTERN : CROSSHAIR_DASH_PATTERN);

    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, height - CHART_CONFIG.CANVAS_PADDING_BOTTOM);
    ctx.stroke();

    ctx.restore();

    if (mouseY < 0 || mouseY > chartHeight) return;

    const priceText = formatChartPrice(price);
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const tagStartX = chartWidth;

    ctx.fillStyle = colors.crosshair;
    const labelPadding = 8;
    const labelHeight = 18;
    const arrowWidth = 6;
    const tagWidth = CHART_CONFIG.CANVAS_PADDING_RIGHT;

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
  }, [enabled, manager, colors, lineWidth, lineStyle, rightMargin, mousePositionRef]);

  return { render };
};
