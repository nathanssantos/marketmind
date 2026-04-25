import type { Order } from '@marketmind/types';
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
  drawSlTpButtons,
  setStandardFont,
} from './orderLineDrawing';
import type { GroupedPosition } from './orderLineTypes';
import { PRICE_TAG_WIDTH, SLTP_BUTTON } from './orderLineTypes';
import type { RenderContext } from './renderContext';
import { getDirectionArrow } from './utils/directionArrow';

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

  const priceChange = rc.currentPrice - position.avgPrice;
  const percentChange = (isLong
    ? (priceChange / position.avgPrice) * 100
    : (-priceChange / position.avgPrice) * 100) * position.leverage;

  const percentSign = percentChange >= 0 ? '+' : '';
  const percentText = `${percentSign}${percentChange.toFixed(2)}%`;

  const leveragePrefix = position.leverage > 1 ? `${position.leverage}x ` : '';
  const directionSymbol = getDirectionArrow(isLong, manager.isFlipped());

  let infoText: string;
  if (isHovered && position.orders.length > 1) {
    const quantityPrefix = `(${position.orders.length}x) `;
    const typeLabel = isLong ? 'L' : 'S';
    infoText = `${quantityPrefix}${typeLabel} (${absQuantity})`;
  } else {
    infoText = `${leveragePrefix}${directionSymbol} (${absQuantity})`;
  }

  const hasAutoTrade = position.orders.some(o => o.isAutoTrade);

  const posLoading = position.orderIds.some(id => rc.isOrderLoading(id));
  if (posLoading) rc.needsAnimation = true;
  const posFlash = position.orderIds.reduce((maxAlpha, id) => Math.max(maxAlpha, rc.getFlashAlpha(id)), 0);

  if (!isHovered) {
    rc.priceTags.push({ priceText, y, fillColor, flashAlpha: posFlash });
  }

  const closeButtonRef = { x: 0, y: 0, size: 14 };
  const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, hasAutoTrade ? 'bot' : null, posLoading, rc.now);

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

  position.orderIds.forEach((orderId) => {
    rc.closeButtons.push({
      orderId,
      x: closeButtonRef.x,
      y: closeButtonRef.y,
      width: closeButtonRef.size,
      height: closeButtonRef.size,
    });
  });

  const badgeX = infoTagSize.width + 6;
  drawPercentBadge(ctx, percentText, badgeX, y, percentChange >= 0);

  const percentBadgeWidth = ctx.measureText(percentText).width + 8;
  const pnl = position.totalPnL;
  const pnlText = pnl === 0
    ? '$0.00'
    : `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
  const pnlBadgeX = badgeX + percentBadgeWidth + 4;
  drawPercentBadge(ctx, pnlText, pnlBadgeX, y, pnl >= 0);

  const pnlBadgeWidth = ctx.measureText(pnlText).width + 8;
  const buttonsX = pnlBadgeX + pnlBadgeWidth + 6;
  const hasStopLoss = position.orders.some(o => o.stopLoss);
  const hasTakeProfit = position.orders.some(o => o.takeProfit);

  if (!hasStopLoss || !hasTakeProfit) {
    const { slButton, tpButton } = drawSlTpButtons(ctx, buttonsX, y, hasStopLoss, hasTakeProfit);
    const primaryOrderId = position.orderIds[0] ?? '';
    if (slButton) {
      rc.slTpButtonHitboxes.push({
        executionId: primaryOrderId,
        type: 'stopLoss',
        x: slButton.x,
        y: slButton.y,
        width: SLTP_BUTTON.WIDTH,
        height: SLTP_BUTTON.HEIGHT,
      });
    }
    if (tpButton) {
      rc.slTpButtonHitboxes.push({
        executionId: primaryOrderId,
        type: 'takeProfit',
        x: tpButton.x,
        y: tpButton.y,
        width: SLTP_BUTTON.WIDTH,
        height: SLTP_BUTTON.HEIGHT,
      });
    }
  }

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
