import type { Order } from '@marketmind/types';
import { calculateBreakevenPrice } from '@marketmind/utils';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderLong } from '@shared/utils';

import {
  drawFlashLine,
  drawHorizontalLine,
  drawInfoTag,
  drawInfoTagFlash,
  drawPercentBadge,
  setStandardFont,
} from './orderLineDrawing';
import type { GroupedPosition } from './orderLineTypes';
import { PRICE_TAG_WIDTH } from './orderLineTypes';
import type { RenderContext } from './renderContext';

export const groupActivePositions = (
  activeOrdersList: Order[],
  currentPrice: number
): Map<string, GroupedPosition> => {
  const groupedPositions = new Map<string, GroupedPosition>();

  activeOrdersList.forEach((order) => {
    const isLong = isOrderLong(order);
    const key = `${order.symbol}-${isLong ? 'LONG' : 'SHORT'}`;
    const existing = groupedPositions.get(key);
    const orderQuantity = isLong ? getOrderQuantity(order) : -getOrderQuantity(order);

    if (existing) {
      const newNetQty = existing.netQuantity + orderQuantity;
      const entryPrice = getOrderPrice(order);
      const totalInvestment = Math.abs(existing.avgPrice * existing.netQuantity) + Math.abs(entryPrice * orderQuantity);
      const avgPrice = totalInvestment / Math.abs(newNetQty || 1);
      const quantity = getOrderQuantity(order);
      const orderPnL = isLong
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      existing.avgPrice = avgPrice;
      existing.netQuantity = newNetQty;
      existing.totalPnL += orderPnL;
      existing.orderIds.push(getOrderId(order));
      existing.orders.push(order);
    } else {
      const entryPrice = getOrderPrice(order);
      const quantity = getOrderQuantity(order);
      const orderPnL = isLong
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      const typedOrder = order as Order & { leverage?: number; liquidationPrice?: number };
      groupedPositions.set(key, {
        symbol: order.symbol,
        netQuantity: orderQuantity,
        avgPrice: entryPrice,
        orderIds: [getOrderId(order)],
        orders: [order],
        totalPnL: orderPnL,
        leverage: typedOrder.leverage ?? 1,
        liquidationPrice: typedOrder.liquidationPrice,
      });
    }
  });

  return groupedPositions;
};

const renderPositionEntry = (
  rc: RenderContext,
  position: GroupedPosition,
  isHovered: boolean
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;
  if (position.orders.length === 0) return;

  const y = manager.priceToY(position.avgPrice);
  if (isHovered && (y < 0 || y > chartHeight)) return;

  const isLong = position.netQuantity > 0;
  const absQuantity = Math.abs(position.netQuantity);
  const positionId = `position-${position.symbol}-${isLong ? 'LONG' : 'SHORT'}`;

  const setupTypes = [...new Set(position.orders.map(o => o.setupType).filter(Boolean))] as string[];
  const positionData = {
    symbol: position.symbol,
    type: isLong ? ('long' as const) : ('short' as const),
    avgPrice: position.avgPrice,
    totalQuantity: absQuantity,
    totalPnL: position.totalPnL,
    leverage: position.leverage,
    orders: position.orders,
    setupTypes,
  };

  ctx.save();
  setStandardFont(ctx);

  const lineColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_LINE : ORDER_LINE_COLORS.POSITION_SHORT_LINE;
  const fillColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_FILL : ORDER_LINE_COLORS.POSITION_SHORT_FILL;

  const priceText = formatChartPrice(position.avgPrice);

  if (isHovered) {
    drawPriceTag(ctx, priceText, y, chartWidth, fillColor, PRICE_TAG_WIDTH);
  }

  drawHorizontalLine(ctx, y, chartWidth, lineColor);

  if (rc.showBreakevenLines) {
    const bePrice = calculateBreakevenPrice({
      entryPrice: position.avgPrice,
      side: isLong ? 'LONG' : 'SHORT',
      takerRate: rc.breakevenTakerRate,
    });
    if (bePrice !== position.avgPrice) {
      const beY = manager.priceToY(bePrice);
      const beLineColor = isLong
        ? ORDER_LINE_COLORS.POSITION_LONG_BE_LINE
        : ORDER_LINE_COLORS.POSITION_SHORT_BE_LINE;
      const beFillColor = isLong
        ? ORDER_LINE_COLORS.POSITION_LONG_BE_FILL
        : ORDER_LINE_COLORS.POSITION_SHORT_BE_FILL;
      drawHorizontalLine(ctx, beY, chartWidth, beLineColor, 1, true);
      rc.priceTags.push({
        priceText: `BE ${formatChartPrice(bePrice)}`,
        y: beY,
        fillColor: beFillColor,
      });
    }
  }

  const priceChange = rc.currentPrice - position.avgPrice;
  const percentChange = (isLong
    ? (priceChange / position.avgPrice) * 100
    : (-priceChange / position.avgPrice) * 100) * position.leverage;

  const percentSign = percentChange >= 0 ? '+' : '';
  const percentText = `${percentSign}${percentChange.toFixed(2)}%`;

  const direction: 'up' | 'down' = (isLong !== manager.isFlipped()) ? 'up' : 'down';
  const typeLabel = isLong ? 'L' : 'S';

  let infoText: string;
  if (isHovered && position.orders.length > 1) {
    const quantityPrefix = `(${position.orders.length}x) `;
    infoText = `${quantityPrefix}${typeLabel} (${absQuantity})`;
  } else {
    infoText = `${typeLabel} (${absQuantity})`;
  }

  const hasAutoTrade = position.orders.some(o => o.isAutoTrade);

  const posLoading = position.orderIds.some(id => rc.isOrderLoading(id));
  if (posLoading) rc.needsAnimation = true;
  const posFlash = position.orderIds.reduce((maxAlpha, id) => Math.max(maxAlpha, rc.getFlashAlpha(id)), 0);

  if (!isHovered) {
    rc.priceTags.push({ priceText, y, fillColor, flashAlpha: posFlash });
  }

  const actionsButtonRef = { x: 0, y: 0, size: 14 };
  // SL/TP buttons stay on the order line ALWAYS — even when an SL/TP
  // order already exists. Lets the user grab the button to drag-
  // reposition the existing SL/TP without having to scroll/search for
  // it off-screen during a fast scalp.
  const showSl = true;
  const showTp = true;
  const slButtonRef = { x: 0, y: 0, width: 0, height: 0 };
  const tpButtonRef = { x: 0, y: 0, width: 0, height: 0 };

  const infoTagSize = drawInfoTag(
    ctx,
    infoText,
    y,
    lineColor,
    rc.infoTagBg,
    rc.infoTagText,
    false,
    null,
    hasAutoTrade ? 'bot' : null,
    posLoading,
    rc.now,
    { showSl, showTp, slButtonRef, tpButtonRef },
    direction,
    actionsButtonRef,
  );

  if (!isHovered) {
    drawInfoTagFlash(ctx, infoTagSize, y, posFlash);
    drawFlashLine(ctx, posFlash, y, chartWidth);
  }

  rc.orderHitboxes.push({
    orderId: positionId,
    x: 0,
    y: y - infoTagSize.height / 2,
    width: infoTagSize.width,
    height: infoTagSize.height,
    order: {
      ...position.orders[0],
      id: positionId,
      entryPrice: position.avgPrice,
      quantity: absQuantity,
      type: isLong ? 'long' : 'short',
      metadata: { isPosition: true, positionData },
    } as unknown as Order,
  });

  rc.actionsButtons.push({
    positionId,
    x: actionsButtonRef.x,
    y: actionsButtonRef.y,
    width: actionsButtonRef.size,
    height: actionsButtonRef.size,
  });

  const primaryOrderId = position.orderIds[0] ?? '';
  if (slButtonRef) {
    rc.slTpButtonHitboxes.push({
      executionId: primaryOrderId,
      type: 'stopLoss',
      x: slButtonRef.x,
      y: slButtonRef.y,
      width: slButtonRef.width,
      height: slButtonRef.height,
    });
  }
  if (tpButtonRef) {
    rc.slTpButtonHitboxes.push({
      executionId: primaryOrderId,
      type: 'takeProfit',
      x: tpButtonRef.x,
      y: tpButtonRef.y,
      width: tpButtonRef.width,
      height: tpButtonRef.height,
    });
  }

  const badgeX = infoTagSize.width + 6;
  drawPercentBadge(ctx, percentText, badgeX, y, percentChange >= 0);

  const percentBadgeWidth = ctx.measureText(percentText).width + 8;
  const pnl = position.totalPnL;
  const pnlText = pnl === 0
    ? '0.00'
    : `${pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}`;
  const pnlBadgeX = badgeX + percentBadgeWidth + 4;
  drawPercentBadge(ctx, pnlText, pnlBadgeX, y, pnl >= 0);

  ctx.restore();
};

export const renderPositions = (
  rc: RenderContext,
  positions: GroupedPosition[]
): void => {
  positions.forEach((position) => renderPositionEntry(rc, position, false));
};

export const renderHoveredPosition = (
  rc: RenderContext,
  position: GroupedPosition
): void => {
  renderPositionEntry(rc, position, true);
};
