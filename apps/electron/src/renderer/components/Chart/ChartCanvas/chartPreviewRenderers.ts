import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';
import { drawInfoTag } from '../orderLineDrawing';
import { getOrderPrice, isOrderLong, isOrderPending } from '@shared/utils';
import type { Order } from '@marketmind/types';
import type { MutableRefObject } from 'react';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { useOrderDragHandler } from '../useOrderDragHandler';
import type { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';

export const renderDragPreview = (
  manager: CanvasManager,
  orderDragHandler: ReturnType<typeof useOrderDragHandler>,
  _t: (key: string) => string,
  infoTagBg: string,
  infoTagText: string,
): void => {
  const currentDragPreviewPrice = orderDragHandler.getPreviewPrice();
  if (!orderDragHandler.isDragging || !orderDragHandler.draggedOrder || currentDragPreviewPrice === null) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const { dragType, draggedOrder } = orderDragHandler;
  const previewPrice = currentDragPreviewPrice;
  const y = manager.priceToY(previewPrice);

  let color: string;
  let label: string;
  let direction: 'up' | 'down' | null = null;

  if (dragType === 'entry' && isOrderPending(draggedOrder)) {
    const isLong = isOrderLong(draggedOrder);
    color = isLong ? ORDER_LINE_COLORS.POSITION_LONG_LINE : ORDER_LINE_COLORS.POSITION_SHORT_LINE;
    direction = (isLong !== manager.isFlipped()) ? 'up' : 'down';
    label = `${isLong ? 'L' : 'S'} ${previewPrice.toFixed(2)}`;
  } else {
    const isStopLoss = dragType === 'stopLoss';
    const entryPrice = getOrderPrice(draggedOrder);
    const isLong = isOrderLong(draggedOrder);
    const dragExecLeverage = (draggedOrder as Order & { leverage?: number }).leverage ?? 1;
    const pctChange = (isLong
      ? (previewPrice - entryPrice) / entryPrice
      : (entryPrice - previewPrice) / entryPrice) * 100 * dragExecLeverage;
    if (isStopLoss) {
      const slInProfit = isLong ? previewPrice > entryPrice : previewPrice < entryPrice;
      color = slInProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
    } else {
      color = ORDER_LINE_COLORS.TP_LINE;
    }
    const pctSign = pctChange >= 0 ? '+' : '';
    label = `${isStopLoss ? 'SL' : 'TP'} ${previewPrice.toFixed(2)} (${pctSign}${pctChange.toFixed(2)}%)`;
  }

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(dimensions.chartWidth, y);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawInfoTag(ctx, label, y, color, infoTagBg, infoTagText, false, null, null, false, 0, null, direction);
  ctx.restore();
};

export const renderSlTpPreview = (
  manager: CanvasManager,
  slTpPlacement: ReturnType<typeof useSlTpPlacementMode>,
  allExecutions: BackendExecution[],
  infoTagBg: string,
  infoTagText: string,
): void => {
  if (!slTpPlacement.active || slTpPlacement.previewPriceRef.current === null) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const previewPrice = slTpPlacement.previewPriceRef.current;
  const y = manager.priceToY(previewPrice);
  const isStopLoss = slTpPlacement.type === 'stopLoss';

  const targetExec = allExecutions.find(e => e.id === slTpPlacement.executionId);
  const entryPrice = targetExec ? parseFloat(targetExec.entryPrice) : 0;
  const isLong = targetExec?.side === 'LONG';
  const execLeverage = targetExec?.leverage ?? 1;
  const pctChange = entryPrice > 0
    ? (isLong
        ? (previewPrice - entryPrice) / entryPrice
        : (entryPrice - previewPrice) / entryPrice) * 100 * execLeverage
    : 0;

  let color: string;
  if (isStopLoss) {
    const slInProfit = entryPrice > 0 && (isLong ? previewPrice > entryPrice : previewPrice < entryPrice);
    color = slInProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
  } else {
    color = ORDER_LINE_COLORS.TP_LINE;
  }

  const pctSign = pctChange >= 0 ? '+' : '';
  const label = `${isStopLoss ? 'SL' : 'TP'} ${formatChartPrice(previewPrice)} (${pctSign}${pctChange.toFixed(2)}%)`;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(dimensions.chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawInfoTag(ctx, label, y, color, infoTagBg, infoTagText, false, null, null, false, 0, null, null);
  ctx.restore();
};

export const renderTsPreview = (
  manager: CanvasManager,
  tsPlacementActive: boolean,
  tsPlacementPreviewPrice: number | null,
  infoTagBg: string,
  infoTagText: string,
): void => {
  if (!tsPlacementActive || tsPlacementPreviewPrice === null) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const y = manager.priceToY(tsPlacementPreviewPrice);
  const color = ORDER_LINE_COLORS.TRAILING_STOP_LINE;
  const label = `TS ${formatChartPrice(tsPlacementPreviewPrice)}`;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(dimensions.chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawInfoTag(ctx, label, y, color, infoTagBg, infoTagText, false, null, 'shield', false, 0, null, null);
  ctx.restore();
};

export const renderOrderPreview = (
  manager: CanvasManager,
  orderPreviewRef: MutableRefObject<{ price: number; type: 'long' | 'short' } | null>,
  _t: (key: string) => string,
  infoTagBg: string,
  infoTagText: string,
): void => {
  const orderPreviewValue = orderPreviewRef.current;
  if (!orderPreviewValue) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const y = manager.priceToY(orderPreviewValue.price);
  const isLong = orderPreviewValue.type === 'long';

  // Match the open-position line palette (blue=LONG, purple=SHORT) so
  // shift/cmd preview previewing where a new order will land uses the
  // same direction colors as live positions on the chart. Previously
  // used SIGNAL_COLORS (green/red) which clashed visually with the
  // long/short line scheme.
  const lineColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_LINE : ORDER_LINE_COLORS.POSITION_SHORT_LINE;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(dimensions.chartWidth, y);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const direction: 'up' | 'down' = isLong !== manager.isFlipped() ? 'up' : 'down';
  const label = orderPreviewValue.price.toFixed(2);
  drawInfoTag(ctx, label, y, lineColor, infoTagBg, infoTagText, false, null, null, false, 0, null, direction);

  ctx.restore();
};
