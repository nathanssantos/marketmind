import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawShieldIcon } from '@renderer/utils/canvas/canvasIcons';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';
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

  if (dragType === 'entry' && isOrderPending(draggedOrder)) {
    const isLong = isOrderLong(draggedOrder);
    color = isLong ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
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
      color = slInProfit ? 'rgba(15, 118, 56, 0.8)' : 'rgba(185, 28, 28, 0.8)';
    } else {
      color = 'rgba(15, 118, 56, 0.8)';
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
  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const labelPadding = 8;
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;
  const labelHeight = 18;
  const arrowWidth = 6;
  const labelWidth = textWidth + labelPadding * 2;

  ctx.beginPath();
  ctx.moveTo(labelWidth + arrowWidth, y);
  ctx.lineTo(labelWidth, y - labelHeight / 2);
  ctx.lineTo(0, y - labelHeight / 2);
  ctx.lineTo(0, y + labelHeight / 2);
  ctx.lineTo(labelWidth, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, labelPadding, y);

  ctx.restore();
};

export const renderSlTpPreview = (
  manager: CanvasManager,
  slTpPlacement: ReturnType<typeof useSlTpPlacementMode>,
  allExecutions: BackendExecution[],
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
    color = slInProfit ? 'rgba(15, 118, 56, 0.8)' : 'rgba(185, 28, 28, 0.8)';
  } else {
    color = 'rgba(15, 118, 56, 0.8)';
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
  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const labelPadding = 8;
  const textWidth = ctx.measureText(label).width;
  const labelHeight = 18;
  const arrowWidth = 6;
  const labelWidth = textWidth + labelPadding * 2;

  ctx.beginPath();
  ctx.moveTo(labelWidth + arrowWidth, y);
  ctx.lineTo(labelWidth, y - labelHeight / 2);
  ctx.lineTo(0, y - labelHeight / 2);
  ctx.lineTo(0, y + labelHeight / 2);
  ctx.lineTo(labelWidth, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, labelPadding, y);
  ctx.restore();
};

export const renderTsPreview = (
  manager: CanvasManager,
  tsPlacementActive: boolean,
  tsPlacementPreviewPrice: number | null,
): void => {
  if (!tsPlacementActive || tsPlacementPreviewPrice === null) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const y = manager.priceToY(tsPlacementPreviewPrice);
  const color = ORDER_LINE_COLORS.TRAILING_STOP_LINE;
  const fillColor = ORDER_LINE_COLORS.TRAILING_STOP_FILL;
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
  ctx.fillStyle = fillColor;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const iconSize = 12;
  const iconPadding = 4;
  const labelPadding = 8;
  const textWidth = ctx.measureText(label).width;
  const labelHeight = 18;
  const arrowWidth = 6;
  const totalLabelWidth = iconSize + iconPadding + textWidth + labelPadding * 2;

  ctx.beginPath();
  ctx.moveTo(totalLabelWidth + arrowWidth, y);
  ctx.lineTo(totalLabelWidth, y - labelHeight / 2);
  ctx.lineTo(0, y - labelHeight / 2);
  ctx.lineTo(0, y + labelHeight / 2);
  ctx.lineTo(totalLabelWidth, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();

  drawShieldIcon(ctx, labelPadding, y - iconSize / 2, iconSize, ORDER_LINE_COLORS.TRAILING_STOP_ICON_STROKE);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, labelPadding + iconSize + iconPadding, y);
  ctx.restore();
};

export const renderOrderPreview = (
  manager: CanvasManager,
  orderPreviewRef: MutableRefObject<{ price: number; type: 'long' | 'short' } | null>,
  t: (key: string) => string,
): void => {
  const orderPreviewValue = orderPreviewRef.current;
  if (!orderPreviewValue) return;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  if (!ctx || !dimensions) return;

  const y = manager.priceToY(orderPreviewValue.price);
  const isLong = orderPreviewValue.type === 'long';

  const willBeActive = false;

  const color = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
  const opacity = willBeActive ? 0.8 : 0.5; ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(dimensions.chartWidth, y);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const statusLabel = willBeActive ? t('trading.active') : t('trading.pending');
  const directionSymbol = isLong ? '\u2191' : '\u2193';
  const label = `${directionSymbol} @ ${orderPreviewValue.price.toFixed(2)} [${statusLabel}]`;
  const labelPadding = 8;
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;
  const labelHeight = 18;
  const arrowWidth = 6;
  const labelWidth = textWidth + labelPadding * 2;

  ctx.beginPath();
  ctx.moveTo(labelWidth + arrowWidth, y);
  ctx.lineTo(labelWidth, y - labelHeight / 2);
  ctx.lineTo(0, y - labelHeight / 2);
  ctx.lineTo(0, y + labelHeight / 2);
  ctx.lineTo(labelWidth, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, labelPadding, y);

  ctx.restore();
};
