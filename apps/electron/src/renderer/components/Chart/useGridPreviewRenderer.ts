import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { GRID_ORDER_COLORS } from '@shared/constants/chartColors';
import { GRID_ORDER_CONFIG } from '@shared/constants/chartConfig';
import { useCallback } from 'react';
import { roundTradingPrice } from '@shared/utils';

interface UseGridPreviewRendererProps {
  manager: CanvasManager | null;
  getPreviewPrices: () => number[];
}

export const useGridPreviewRenderer = ({ manager, getPreviewPrices }: UseGridPreviewRendererProps) => {
  const renderGridPreview = useCallback((): void => {
    if (!manager) return;

    const { isDrawingGrid, startPrice, endPrice, gridSide } = useGridOrderStore.getState();
    if (!isDrawingGrid || startPrice === null || endPrice === null) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const prices = getPreviewPrices();
    if (prices.length === 0) return;

    const isBuy = gridSide === 'BUY';
    const lineColor = isBuy ? GRID_ORDER_COLORS.BUY_LINE : GRID_ORDER_COLORS.SELL_LINE;
    const fillColor = isBuy ? GRID_ORDER_COLORS.BUY_RANGE_FILL : GRID_ORDER_COLORS.SELL_RANGE_FILL;
    const labelColor = isBuy ? GRID_ORDER_COLORS.BUY_LABEL : GRID_ORDER_COLORS.SELL_LABEL;

    const topY = manager.priceToY(Math.max(startPrice, endPrice));
    const bottomY = manager.priceToY(Math.min(startPrice, endPrice));

    ctx.save();

    ctx.fillStyle = fillColor;
    ctx.fillRect(0, topY, dimensions.chartWidth, bottomY - topY);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = GRID_ORDER_CONFIG.PREVIEW_LINE_WIDTH;
    ctx.setLineDash([...GRID_ORDER_CONFIG.PREVIEW_LINE_DASH]);

    for (const price of prices) {
      const y = manager.priceToY(price);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.chartWidth, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.font = GRID_ORDER_CONFIG.LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const price of prices) {
      const y = manager.priceToY(price);
      const label = roundTradingPrice(price);
      const textWidth = ctx.measureText(label).width;
      const totalWidth = textWidth + GRID_ORDER_CONFIG.LABEL_PADDING * 2;

      ctx.fillStyle = labelColor;
      ctx.fillRect(2, y - GRID_ORDER_CONFIG.LABEL_HEIGHT / 2, totalWidth, GRID_ORDER_CONFIG.LABEL_HEIGHT);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 2 + GRID_ORDER_CONFIG.LABEL_PADDING, y);
    }

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerY = (topY + bottomY) / 2;
    const summaryLabel = `${prices.length} ${isBuy ? 'BUY' : 'SELL'}`;
    const summaryWidth = ctx.measureText(summaryLabel).width + 16;
    ctx.fillStyle = labelColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(dimensions.chartWidth / 2 - summaryWidth / 2, centerY - 10, summaryWidth, 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(summaryLabel, dimensions.chartWidth / 2, centerY);

    ctx.restore();
  }, [manager, getPreviewPrices]);

  return { renderGridPreview };
};
