import type { Order } from '@marketmind/types';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';
import { getOrderId } from '@shared/utils';

import {
  drawFlashLine,
  drawHorizontalLine,
  drawInfoTag,
  drawInfoTagFlash,
  drawProfitLossArea,
  findKlineIndexByTime,
  isSLInProfitZone,
  setStandardFont,
} from './orderLineDrawing';
import type { GroupedPosition } from './orderLineTypes';
import type { RenderContext } from './renderContext';

const renderConsolidatedSLTP = (
  rc: RenderContext,
  position: GroupedPosition,
  type: 'stopLoss' | 'takeProfit',
  consolidatedPrice: number,
  _isPendingPosition: boolean
): void => {
  const { ctx, manager, chartWidth } = rc;
  const isLongPosition = position.netQuantity > 0;
  const y = manager.priceToY(consolidatedPrice);

  if (type === 'stopLoss') {
    const slIsProfit = isSLInProfitZone(isLongPosition, position.avgPrice, consolidatedPrice);
    const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
    const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL;
    const firstOrderId = position.orderIds[0] ?? '';

    ctx.save();
    drawHorizontalLine(ctx, y, chartWidth, slLineColor);
    setStandardFont(ctx);

    const priceText = formatChartPrice(consolidatedPrice);
    const slResultPercent = (isLongPosition
      ? ((consolidatedPrice - position.avgPrice) / position.avgPrice) * 100
      : ((position.avgPrice - consolidatedPrice) / position.avgPrice) * 100) * position.leverage;
    const slSign = slResultPercent >= 0 ? '+' : '';
    const pendingLabel = '';
    const infoText = `SL (${slSign}${slResultPercent.toFixed(2)}%)${pendingLabel}`;

    const slFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, rc.getFlashAlpha(`${id}-sl`)), 0);
    rc.priceTags.push({ priceText, y, fillColor: slTagColor, flashAlpha: slFlash });

    drawHorizontalLine(ctx, y, chartWidth, slLineColor);

    const slConsLoading = position.orderIds.some((id: string) => rc.isOrderLoading(id));
    if (slConsLoading) rc.needsAnimation = true;
    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const slTagSize = drawInfoTag(ctx, infoText, y, slTagColor, rc.infoTagBg, rc.infoTagText, true, closeButtonRef, null, slConsLoading, rc.now);
    drawInfoTagFlash(ctx, slTagSize, y, slFlash);

    rc.orderHitboxes.push({
      orderId: firstOrderId,
      x: 0,
      y: y - slTagSize.height / 2,
      width: slTagSize.width,
      height: slTagSize.height,
      order: {
        ...position.orders[0],
        entryPrice: consolidatedPrice,
        stopLoss: consolidatedPrice,
        metadata: { isSLTP: true, type: 'stopLoss' },
      } as Order,
    });

    position.orders.forEach((order) => {
      rc.sltpHitboxes.push({
        orderId: getOrderId(order),
        x: 0,
        y: y - slTagSize.height / 2,
        width: slTagSize.width,
        height: slTagSize.height,
        type: 'stopLoss',
        price: consolidatedPrice,
      });
    });

    rc.sltpCloseButtons.push({
      orderIds: position.orderIds,
      x: closeButtonRef.x,
      y: closeButtonRef.y,
      width: closeButtonRef.size,
      height: closeButtonRef.size,
      type: 'stopLoss',
    });

    ctx.restore();
    drawFlashLine(ctx, slFlash, y, chartWidth);
  } else {
    const firstOrderId = position.orderIds[0] ?? '';
    const tpFillColor = ORDER_LINE_COLORS.TP_FILL;

    ctx.save();
    drawHorizontalLine(ctx, y, chartWidth, ORDER_LINE_COLORS.TP_LINE);
    setStandardFont(ctx);

    const priceText = formatChartPrice(consolidatedPrice);
    const tpProfitPercent = (isLongPosition
      ? ((consolidatedPrice - position.avgPrice) / position.avgPrice) * 100
      : ((position.avgPrice - consolidatedPrice) / position.avgPrice) * 100) * position.leverage;
    const pendingLabel = '';
    const infoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%)${pendingLabel}`;

    const tpFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, rc.getFlashAlpha(`${id}-tp`)), 0);
    rc.priceTags.push({ priceText, y, fillColor: tpFillColor, flashAlpha: tpFlash });

    drawHorizontalLine(ctx, y, chartWidth, ORDER_LINE_COLORS.TP_LINE);

    const tpConsLoading = position.orderIds.some((id: string) => rc.isOrderLoading(id));
    if (tpConsLoading) rc.needsAnimation = true;
    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const tpTagSize = drawInfoTag(ctx, infoText, y, tpFillColor, rc.infoTagBg, rc.infoTagText, true, closeButtonRef, null, tpConsLoading, rc.now);
    drawInfoTagFlash(ctx, tpTagSize, y, tpFlash);

    rc.orderHitboxes.push({
      orderId: firstOrderId,
      x: 0,
      y: y - tpTagSize.height / 2,
      width: tpTagSize.width,
      height: tpTagSize.height,
      order: {
        ...position.orders[0],
        entryPrice: consolidatedPrice,
        takeProfit: consolidatedPrice,
        metadata: { isSLTP: true, type: 'takeProfit' },
      } as Order,
    });

    position.orders.forEach((order) => {
      rc.sltpHitboxes.push({
        orderId: getOrderId(order),
        x: 0,
        y: y - tpTagSize.height / 2,
        width: tpTagSize.width,
        height: tpTagSize.height,
        type: 'takeProfit',
        price: consolidatedPrice,
      });
    });

    rc.sltpCloseButtons.push({
      orderIds: position.orderIds,
      x: closeButtonRef.x,
      y: closeButtonRef.y,
      width: closeButtonRef.size,
      height: closeButtonRef.size,
      type: 'takeProfit',
    });

    ctx.restore();
    drawFlashLine(ctx, tpFlash, y, chartWidth);
  }
};

export const renderPositionSLTP = (
  rc: RenderContext,
  allPositions: GroupedPosition[]
): void => {
  const { ctx, manager, chartWidth, klines } = rc;

  allPositions.forEach((position) => {
    const isPendingPosition = position.orders.some(o => (o as Order & { isPendingLimitOrder?: boolean }).isPendingLimitOrder);
    const isLongPosition = position.netQuantity > 0;
    const entryY = manager.priceToY(position.avgPrice);

    const stopLossOrders = position.orders.filter(o => o.stopLoss);
    const takeProfitOrders = position.orders.filter(o => o.takeProfit);
    const consolidatedStopLoss = stopLossOrders.length > 0
      ? (isLongPosition
          ? Math.max(...stopLossOrders.map(o => o.stopLoss ?? 0))
          : Math.min(...stopLossOrders.map(o => o.stopLoss ?? Infinity)))
      : null;
    const consolidatedTakeProfit = takeProfitOrders.length > 0
      ? (isLongPosition
          ? Math.min(...takeProfitOrders.map(o => o.takeProfit ?? Infinity))
          : Math.max(...takeProfitOrders.map(o => o.takeProfit ?? 0)))
      : null;

    if (rc.showProfitLossAreas && (consolidatedStopLoss || consolidatedTakeProfit)) {
      const earliestOrderTime = Math.min(...position.orders.map(o => o.time));
      const entryKlineIndex = findKlineIndexByTime(klines, earliestOrderTime);
      const entryX = manager.indexToX(entryKlineIndex);

      if (consolidatedStopLoss) {
        const stopY = manager.priceToY(consolidatedStopLoss);
        const slIsProfit = isSLInProfitZone(isLongPosition, position.avgPrice, consolidatedStopLoss);
        drawProfitLossArea(ctx, entryY, stopY, chartWidth, slIsProfit, entryX);
      }
      if (consolidatedTakeProfit) {
        const tpY = manager.priceToY(consolidatedTakeProfit);
        drawProfitLossArea(ctx, entryY, tpY, chartWidth, true, entryX);
      }
    }

    if (stopLossOrders.length > 0 && consolidatedStopLoss) {
      renderConsolidatedSLTP(rc, position, 'stopLoss', consolidatedStopLoss, isPendingPosition);
    }

    if (takeProfitOrders.length > 0 && consolidatedTakeProfit) {
      renderConsolidatedSLTP(rc, position, 'takeProfit', consolidatedTakeProfit, isPendingPosition);
    }
  });
};
