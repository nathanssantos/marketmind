import type { Order } from '@marketmind/types';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS, ORDER_LINE_LAYOUT } from '@shared/constants';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderLong } from '@shared/utils';

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
import { PRICE_TAG_WIDTH } from './orderLineTypes';
import type { RenderContext } from './renderContext';

const renderSLTPForPendingOrder = (
  rc: RenderContext,
  order: Order,
  isLong: boolean,
  entryPrice: number,
  orderId: string,
  isHoveredOnly: boolean
): void => {
  const { ctx, manager, chartWidth } = rc;

  if (order.stopLoss) {
    const stopY = manager.priceToY(order.stopLoss);
    const slIsProfit = isSLInProfitZone(isLong, entryPrice, order.stopLoss);
    const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
    const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = slLineColor;
    drawHorizontalLine(ctx, stopY, chartWidth, slLineColor);

    setStandardFont(ctx);

    const slResultPercent = isLong
      ? ((order.stopLoss - entryPrice) / entryPrice) * 100
      : ((entryPrice - order.stopLoss) / entryPrice) * 100;
    const slSign = slResultPercent >= 0 ? '+' : '';
    const slInfoText = `SL (${slSign}${slResultPercent.toFixed(2)}%) [PENDING]`;

    if (isHoveredOnly) {
      drawInfoTag(ctx, slInfoText, stopY, slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL, rc.infoTagBg, rc.infoTagText, true, null);
    } else {
      const slFlashAlphaVal = rc.getFlashAlpha(`${orderId}-sl`);
      rc.priceTags.push({ priceText: formatChartPrice(order.stopLoss), y: stopY, fillColor: slTagColor, flashAlpha: slFlashAlphaVal });

      const slCloseButtonRef = { x: 0, y: 0, size: 14 };
      const slLoading = rc.isOrderLoading(orderId);
      if (slLoading) rc.needsAnimation = true;
      const slTagSize = drawInfoTag(ctx, slInfoText, stopY, slTagColor, rc.infoTagBg, rc.infoTagText, true, slCloseButtonRef, null, slLoading, rc.now);
      drawInfoTagFlash(ctx, slTagSize, stopY, slFlashAlphaVal);

      rc.sltpHitboxes.push({
        orderId: getOrderId(order),
        x: 0,
        y: stopY - slTagSize.height / 2,
        width: slTagSize.width,
        height: slTagSize.height,
        type: 'stopLoss',
        price: order.stopLoss,
      });

      rc.sltpCloseButtons.push({
        orderIds: [getOrderId(order)],
        x: slCloseButtonRef.x,
        y: slCloseButtonRef.y,
        width: slCloseButtonRef.size,
        height: slCloseButtonRef.size,
        type: 'stopLoss',
      });

      const slFlashAlpha = rc.getFlashAlpha(`${orderId}-sl`);
      drawFlashLine(ctx, slFlashAlpha, stopY, chartWidth);
    }

    ctx.restore();
  }

  if (order.takeProfit) {
    const tpY = manager.priceToY(order.takeProfit);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ORDER_LINE_COLORS.TP_LINE;
    drawHorizontalLine(ctx, tpY, chartWidth, ORDER_LINE_COLORS.TP_LINE);

    setStandardFont(ctx);

    const tpProfitPercent = isLong
      ? ((order.takeProfit - entryPrice) / entryPrice) * 100
      : ((entryPrice - order.takeProfit) / entryPrice) * 100;
    const tpInfoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%) [PENDING]`;

    if (isHoveredOnly) {
      drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.TP_FILL, rc.infoTagBg, rc.infoTagText, true, null);
    } else {
      const tpFillColor = ORDER_LINE_COLORS.TP_FILL;
      const tpFlashAlphaVal = rc.getFlashAlpha(`${orderId}-tp`);
      rc.priceTags.push({ priceText: formatChartPrice(order.takeProfit), y: tpY, fillColor: tpFillColor, flashAlpha: tpFlashAlphaVal });

      const tpCloseButtonRef = { x: 0, y: 0, size: 14 };
      const tpLoading = rc.isOrderLoading(orderId);
      if (tpLoading) rc.needsAnimation = true;
      const tpTagSize = drawInfoTag(ctx, tpInfoText, tpY, tpFillColor, rc.infoTagBg, rc.infoTagText, true, tpCloseButtonRef, null, tpLoading, rc.now);
      drawInfoTagFlash(ctx, tpTagSize, tpY, tpFlashAlphaVal);

      rc.sltpHitboxes.push({
        orderId: getOrderId(order),
        x: 0,
        y: tpY - tpTagSize.height / 2,
        width: tpTagSize.width,
        height: tpTagSize.height,
        type: 'takeProfit',
        price: order.takeProfit,
      });

      rc.sltpCloseButtons.push({
        orderIds: [getOrderId(order)],
        x: tpCloseButtonRef.x,
        y: tpCloseButtonRef.y,
        width: tpCloseButtonRef.size,
        height: tpCloseButtonRef.size,
        type: 'takeProfit',
      });

      const tpFlashAlpha = rc.getFlashAlpha(`${orderId}-tp`);
      drawFlashLine(ctx, tpFlashAlpha, tpY, chartWidth);
    }

    ctx.restore();
  }
};

export const renderPendingOrders = (
  rc: RenderContext,
  pendingOrders: Order[]
): void => {
  const { ctx, manager, chartWidth, chartHeight, klines } = rc;

  pendingOrders.forEach((order) => {
    const y = manager.priceToY(getOrderPrice(order));
    if (y < 0 || y > chartHeight) return;

    const isLong = isOrderLong(order);

    ctx.save();
    setStandardFont(ctx);

    const lineColor = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
    const fillColor = isLong ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

    drawHorizontalLine(ctx, y, chartWidth, lineColor);

    const typeLabel = isLong ? 'L' : 'S';
    const direction: 'up' | 'down' = (isLong !== manager.isFlipped()) ? 'up' : 'down';
    const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

    const orderId = getOrderId(order);
    const loading = rc.isOrderLoading(orderId);
    if (loading) rc.needsAnimation = true;
    const flashAlpha = rc.getFlashAlpha(orderId);
    rc.priceTags.push({ priceText: formatChartPrice(getOrderPrice(order)), y, fillColor, flashAlpha });

    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const entryTagSize = drawInfoTag(ctx, infoText, y, lineColor, rc.infoTagBg, rc.infoTagText, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, loading, rc.now, null, direction);
    drawInfoTagFlash(ctx, entryTagSize, y, flashAlpha);

    rc.orderHitboxes.push({
      orderId,
      x: 0,
      y: y - ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT / 2,
      width: chartWidth,
      height: ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT,
      order,
    });

    rc.closeButtons.push({
      orderId,
      x: closeButtonRef.x,
      y: closeButtonRef.y,
      width: closeButtonRef.size,
      height: closeButtonRef.size,
    });

    ctx.restore();

    drawFlashLine(ctx, flashAlpha, y, chartWidth);

    const entryPrice = getOrderPrice(order);

    if (rc.showProfitLossAreas && (order.stopLoss || order.takeProfit)) {
      const entryKlineIndex = findKlineIndexByTime(klines, order.time);
      const entryX = manager.indexToX(entryKlineIndex);

      if (order.stopLoss) {
        const stopY = manager.priceToY(order.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, entryPrice, order.stopLoss);
        drawProfitLossArea(ctx, y, stopY, chartWidth, slIsProfit, entryX);
      }
      if (order.takeProfit) {
        const tpY = manager.priceToY(order.takeProfit);
        drawProfitLossArea(ctx, y, tpY, chartWidth, true, entryX);
      }
    }

    renderSLTPForPendingOrder(rc, order, isLong, entryPrice, orderId, false);
  });
};

export const renderHoveredPendingOrder = (
  rc: RenderContext,
  order: Order
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;
  const y = manager.priceToY(getOrderPrice(order));
  if (y < 0 || y > chartHeight) return;

  const isLong = isOrderLong(order);

  ctx.save();
  setStandardFont(ctx);

  const lineColor = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
  const fillColor = isLong ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

  const priceText = formatChartPrice(getOrderPrice(order));
  drawPriceTag(ctx, priceText, y, chartWidth, fillColor, PRICE_TAG_WIDTH);

  drawHorizontalLine(ctx, y, chartWidth, lineColor);

  const typeLabel = isLong ? 'L' : 'S';
  const direction: 'up' | 'down' = (isLong !== manager.isFlipped()) ? 'up' : 'down';
  const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

  const hoveredOrderId = getOrderId(order);
  const hoveredLoading = rc.isOrderLoading(hoveredOrderId);
  if (hoveredLoading) rc.needsAnimation = true;
  const closeButtonRef = { x: 0, y: 0, size: 14 };
  drawInfoTag(ctx, infoText, y, lineColor, rc.infoTagBg, rc.infoTagText, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, hoveredLoading, rc.now, null, direction);

  rc.orderHitboxes.push({
    orderId: hoveredOrderId,
    x: 0,
    y: y - ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT / 2,
    width: chartWidth,
    height: ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT,
    order,
  });

  rc.closeButtons.push({
    orderId: hoveredOrderId,
    x: closeButtonRef.x,
    y: closeButtonRef.y,
    width: closeButtonRef.size,
    height: closeButtonRef.size,
  });

  ctx.restore();

  const entryPrice = getOrderPrice(order);
  renderSLTPForPendingOrder(rc, order, isLong, entryPrice, hoveredOrderId, true);
};
