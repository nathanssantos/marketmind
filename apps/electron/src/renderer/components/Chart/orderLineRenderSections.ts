import type { Order, TradingSetup } from '@marketmind/types';
import { calculateLiquidationPrice } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS, ORDER_LINE_LAYOUT } from '@shared/constants';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderActive, isOrderLong } from '@shared/utils';

import {
  drawFlashLine,
  drawHorizontalLine,
  drawInfoTag,
  drawInfoTagFlash,
  drawPercentBadge,
  drawProfitLossArea,
  drawSlTpButtons,
  findKlineIndexByTime,
  isSLInProfitZone,
  setStandardFont,
} from './orderLineDrawing';
import type {
  GroupedPosition,
  OrderCloseButton,
  OrderHitbox,
  SLTPCloseButton,
  SLTPHitbox,
  SlTpButtonHitbox,
  TrailingStopLineConfig,
} from './orderLineTypes';
import { PRICE_TAG_WIDTH, SLTP_BUTTON } from './orderLineTypes';

export interface PriceTagEntry {
  priceText: string;
  y: number;
  fillColor: string;
  flashAlpha?: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  manager: CanvasManager;
  chartWidth: number;
  chartHeight: number;
  klines: Array<{ openTime: number }>;
  currentPrice: number;
  now: number;
  isOrderLoading: (orderId: string) => boolean;
  getFlashAlpha: (orderId: string) => number;
  priceTags: PriceTagEntry[];
  closeButtons: OrderCloseButton[];
  orderHitboxes: OrderHitbox[];
  sltpHitboxes: SLTPHitbox[];
  sltpCloseButtons: SLTPCloseButton[];
  slTpButtonHitboxes: SlTpButtonHitbox[];
  tsCloseButtons: Array<{ x: number; y: number; size: number }>;
  needsAnimation: boolean;
  showProfitLossAreas: boolean;
}

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

      groupedPositions.set(key, {
        symbol: order.symbol,
        netQuantity: orderQuantity,
        avgPrice: entryPrice,
        orderIds: [getOrderId(order)],
        orders: [order],
        totalPnL: orderPnL,
        leverage: (order as Order & { leverage?: number }).leverage ?? 1,
      });
    }
  });

  return groupedPositions;
};

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
      drawInfoTag(ctx, slInfoText, stopY, slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL, true, null);
    } else {
      const slFlashAlphaVal = rc.getFlashAlpha(`${orderId}-sl`);
      rc.priceTags.push({ priceText: formatChartPrice(order.stopLoss), y: stopY, fillColor: slTagColor, flashAlpha: slFlashAlphaVal });

      const slCloseButtonRef = { x: 0, y: 0, size: 14 };
      const slLoading = rc.isOrderLoading(orderId);
      if (slLoading) rc.needsAnimation = true;
      const slTagSize = drawInfoTag(ctx, slInfoText, stopY, slTagColor, true, slCloseButtonRef, null, slLoading, rc.now);
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
      drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.TP_FILL, true, null);
    } else {
      const tpFillColor = ORDER_LINE_COLORS.TP_FILL;
      const tpFlashAlphaVal = rc.getFlashAlpha(`${orderId}-tp`);
      rc.priceTags.push({ priceText: formatChartPrice(order.takeProfit), y: tpY, fillColor: tpFillColor, flashAlpha: tpFlashAlphaVal });

      const tpCloseButtonRef = { x: 0, y: 0, size: 14 };
      const tpLoading = rc.isOrderLoading(orderId);
      if (tpLoading) rc.needsAnimation = true;
      const tpTagSize = drawInfoTag(ctx, tpInfoText, tpY, tpFillColor, true, tpCloseButtonRef, null, tpLoading, rc.now);
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
    const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

    const orderId = getOrderId(order);
    const loading = rc.isOrderLoading(orderId);
    if (loading) rc.needsAnimation = true;
    const flashAlpha = rc.getFlashAlpha(orderId);
    rc.priceTags.push({ priceText: formatChartPrice(getOrderPrice(order)), y, fillColor, flashAlpha });

    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const entryTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, loading, rc.now);
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
  const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

  const hoveredOrderId = getOrderId(order);
  const hoveredLoading = rc.isOrderLoading(hoveredOrderId);
  if (hoveredLoading) rc.needsAnimation = true;
  const closeButtonRef = { x: 0, y: 0, size: 14 };
  drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, hoveredLoading, rc.now);

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
  const directionSymbol = isLong ? '↑' : '↓';

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
  const buttonsX = badgeX + percentBadgeWidth + 6;
  const hasStopLoss = position.orders.some(o => o.stopLoss);
  const hasTakeProfit = position.orders.some(o => o.takeProfit);

  if (!hasStopLoss || !hasTakeProfit) {
    const { slButton, tpButton } = drawSlTpButtons(ctx, buttonsX, y, hasStopLoss, hasTakeProfit);
    const primaryOrderId = position.orderIds[0] || '';
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

const renderConsolidatedSLTP = (
  rc: RenderContext,
  position: GroupedPosition,
  type: 'stopLoss' | 'takeProfit',
  consolidatedPrice: number,
  isPendingPosition: boolean
): void => {
  const { ctx, manager, chartWidth } = rc;
  const isLongPosition = position.netQuantity > 0;
  const y = manager.priceToY(consolidatedPrice);

  if (type === 'stopLoss') {
    const slIsProfit = isSLInProfitZone(isLongPosition, position.avgPrice, consolidatedPrice);
    const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
    const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL;
    const firstOrderId = position.orderIds[0] || '';

    ctx.save();
    drawHorizontalLine(ctx, y, chartWidth, slLineColor);
    setStandardFont(ctx);

    const priceText = formatChartPrice(consolidatedPrice);
    const slResultPercent = (isLongPosition
      ? ((consolidatedPrice - position.avgPrice) / position.avgPrice) * 100
      : ((position.avgPrice - consolidatedPrice) / position.avgPrice) * 100) * position.leverage;
    const slSign = slResultPercent >= 0 ? '+' : '';
    const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
    const infoText = `SL (${slSign}${slResultPercent.toFixed(2)}%)${pendingLabel}`;

    const slFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, rc.getFlashAlpha(`${id}-sl`)), 0);
    rc.priceTags.push({ priceText, y, fillColor: slTagColor, flashAlpha: slFlash });

    drawHorizontalLine(ctx, y, chartWidth, slLineColor);

    const slConsLoading = position.orderIds.some((id: string) => rc.isOrderLoading(id));
    if (slConsLoading) rc.needsAnimation = true;
    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const slTagSize = drawInfoTag(ctx, infoText, y, slTagColor, true, closeButtonRef, null, slConsLoading, rc.now);
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
    const firstOrderId = position.orderIds[0] || '';
    const tpFillColor = ORDER_LINE_COLORS.TP_FILL;

    ctx.save();
    drawHorizontalLine(ctx, y, chartWidth, ORDER_LINE_COLORS.TP_LINE);
    setStandardFont(ctx);

    const priceText = formatChartPrice(consolidatedPrice);
    const tpProfitPercent = (isLongPosition
      ? ((consolidatedPrice - position.avgPrice) / position.avgPrice) * 100
      : ((position.avgPrice - consolidatedPrice) / position.avgPrice) * 100) * position.leverage;
    const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
    const infoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%)${pendingLabel}`;

    const tpFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, rc.getFlashAlpha(`${id}-tp`)), 0);
    rc.priceTags.push({ priceText, y, fillColor: tpFillColor, flashAlpha: tpFlash });

    drawHorizontalLine(ctx, y, chartWidth, ORDER_LINE_COLORS.TP_LINE);

    const tpConsLoading = position.orderIds.some((id: string) => rc.isOrderLoading(id));
    if (tpConsLoading) rc.needsAnimation = true;
    const closeButtonRef = { x: 0, y: 0, size: 14 };
    const tpTagSize = drawInfoTag(ctx, infoText, y, tpFillColor, true, closeButtonRef, null, tpConsLoading, rc.now);
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
          ? Math.max(...stopLossOrders.map(o => o.stopLoss || 0))
          : Math.min(...stopLossOrders.map(o => o.stopLoss || Infinity)))
      : null;
    const consolidatedTakeProfit = takeProfitOrders.length > 0
      ? (isLongPosition
          ? Math.min(...takeProfitOrders.map(o => o.takeProfit || Infinity))
          : Math.max(...takeProfitOrders.map(o => o.takeProfit || 0)))
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

export const renderPendingSetups = (
  rc: RenderContext,
  pendingSetups: TradingSetup[]
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;

  pendingSetups.forEach((setup) => {
    if (!setup.visible) return;

    const effectiveEntryPrice = setup.entryOrderType === 'LIMIT' && setup.limitEntryPrice
      ? setup.limitEntryPrice
      : setup.entryPrice;

    const entryY = manager.priceToY(effectiveEntryPrice);
    if (entryY < 0 || entryY > chartHeight) return;

    const isLong = setup.direction === 'LONG';
    const isLimitOrder = setup.entryOrderType === 'LIMIT';

    if (rc.showProfitLossAreas && (setup.stopLoss || setup.takeProfit)) {
      const entryX = manager.indexToX(setup.klineIndex);

      if (setup.stopLoss) {
        const slY = manager.priceToY(setup.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
        drawProfitLossArea(ctx, entryY, slY, chartWidth, slIsProfit, entryX);
      }
      if (setup.takeProfit) {
        const tpY = manager.priceToY(setup.takeProfit);
        drawProfitLossArea(ctx, entryY, tpY, chartWidth, true, entryX);
      }
    }

    ctx.save();
    setStandardFont(ctx);

    const lineColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_LINE : ORDER_LINE_COLORS.PENDING_SHORT_LINE;
    const fillColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_FILL : ORDER_LINE_COLORS.PENDING_SHORT_FILL;

    const priceText = formatChartPrice(effectiveEntryPrice);
    rc.priceTags.push({ priceText, y: entryY, fillColor });

    drawHorizontalLine(ctx, entryY, chartWidth, lineColor);

    const setupLabel = setup.label ?? setup.type;
    const directionSymbol = isLong ? '↑' : '↓';
    const orderTypeLabel = isLimitOrder ? 'LIMIT' : 'MKT';
    const infoText = `${directionSymbol} ${setupLabel} (${orderTypeLabel})`;

    drawInfoTag(ctx, infoText, entryY, fillColor, false, null, 'bot');

    if (setup.stopLoss) {
      const slY = manager.priceToY(setup.stopLoss);
      const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
      const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SETUP_PROFIT_LINE : ORDER_LINE_COLORS.SETUP_LOSS_LINE;
      const slLossSetupColor = ORDER_LINE_COLORS.SL_LOSS_LINE;
      const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossSetupColor;

      drawHorizontalLine(ctx, slY, chartWidth, slLineColor);

      const slPriceText = formatChartPrice(setup.stopLoss);
      const slPercent = isLong
        ? ((setup.stopLoss - effectiveEntryPrice) / effectiveEntryPrice) * 100
        : ((effectiveEntryPrice - setup.stopLoss) / effectiveEntryPrice) * 100;
      const slInfoText = `SL (${slPercent.toFixed(2)}%)`;

      rc.priceTags.push({ priceText: slPriceText, y: slY, fillColor: slTagColor });
      drawInfoTag(ctx, slInfoText, slY, slTagColor, false, null, null);
    }

    if (setup.takeProfit) {
      const tpY = manager.priceToY(setup.takeProfit);
      drawHorizontalLine(ctx, tpY, chartWidth, ORDER_LINE_COLORS.SETUP_PROFIT_LINE);

      const tpPriceText = formatChartPrice(setup.takeProfit);
      const tpPercent = isLong
        ? ((setup.takeProfit - effectiveEntryPrice) / effectiveEntryPrice) * 100
        : ((effectiveEntryPrice - setup.takeProfit) / effectiveEntryPrice) * 100;
      const tpInfoText = `TP (${tpPercent >= 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`;

      const tpSetupFillColor = ORDER_LINE_COLORS.TP_FILL;
      rc.priceTags.push({ priceText: tpPriceText, y: tpY, fillColor: tpSetupFillColor });
      drawInfoTag(ctx, tpInfoText, tpY, tpSetupFillColor, false, null, null);
    }

    ctx.restore();
  });
};

export const renderTrailingStops = (
  rc: RenderContext,
  activeOrders: Order[],
  trailingStopConfig: TrailingStopLineConfig
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;
  const openPositions = activeOrders.filter(o => isOrderActive(o));
  const positionsByKey = new Map<string, { side: 'long' | 'short'; avgPrice: number; totalQty: number }>();

  for (const order of openPositions) {
    const side = isOrderLong(order) ? 'long' as const : 'short' as const;
    const qty = getOrderQuantity(order);
    const existing = positionsByKey.get(side);
    if (existing) {
      const newTotalQty = existing.totalQty + qty;
      existing.avgPrice = (existing.avgPrice * existing.totalQty + getOrderPrice(order) * qty) / newTotalQty;
      existing.totalQty = newTotalQty;
    } else {
      positionsByKey.set(side, { side, avgPrice: getOrderPrice(order), totalQty: qty });
    }
  }

  for (const pos of positionsByKey.values()) {
    const activationPercent = pos.side === 'long'
      ? trailingStopConfig.activationPercentLong
      : trailingStopConfig.activationPercentShort;
    if (activationPercent <= 0) continue;

    const activationPrice = pos.avgPrice * activationPercent;
    const tsY = manager.priceToY(activationPrice);
    if (tsY < 0 || tsY > chartHeight) continue;

    const activationPctDisplay = ((activationPercent - 1) * 100);
    const pctSign = activationPctDisplay >= 0 ? '+' : '';
    const tsLabel = `TS ${pos.side === 'long' ? '↑' : '↓'} (${pctSign}${activationPctDisplay.toFixed(1)}%)`;

    ctx.save();
    ctx.strokeStyle = ORDER_LINE_COLORS.TRAILING_STOP_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, tsY);
    ctx.lineTo(chartWidth, tsY);
    ctx.stroke();
    ctx.setLineDash([]);

    setStandardFont(ctx);
    const tsCloseBtn = { x: 0, y: 0, size: 14 };
    drawInfoTag(ctx, tsLabel, tsY, ORDER_LINE_COLORS.TRAILING_STOP_FILL, true, tsCloseBtn, 'shield');
    rc.tsCloseButtons.push(tsCloseBtn);

    const tsPriceText = formatChartPrice(activationPrice);
    rc.priceTags.push({ priceText: tsPriceText, y: tsY, fillColor: ORDER_LINE_COLORS.TRAILING_STOP_FILL });

    ctx.restore();
  }
};

export const renderLiquidationLines = (
  rc: RenderContext,
  allPositions: GroupedPosition[]
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;

  allPositions.forEach((position) => {
    if (position.leverage <= 1) return;
    const isLong = position.netQuantity > 0;
    const side = isLong ? 'LONG' as const : 'SHORT' as const;
    const liqPrice = calculateLiquidationPrice(position.avgPrice, position.leverage, side);
    if (liqPrice <= 0) return;

    const liqY = manager.priceToY(liqPrice);
    if (liqY < 0 || liqY > chartHeight) return;

    ctx.save();
    ctx.strokeStyle = ORDER_LINE_COLORS.LIQUIDATION_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, liqY);
    ctx.lineTo(chartWidth, liqY);
    ctx.stroke();
    ctx.setLineDash([]);

    setStandardFont(ctx);
    const liqLabel = `LIQ ${side === 'LONG' ? '↑' : '↓'}`;
    drawInfoTag(ctx, liqLabel, liqY, ORDER_LINE_COLORS.LIQUIDATION_FILL, false);

    const liqPriceText = formatChartPrice(liqPrice);
    rc.priceTags.push({ priceText: liqPriceText, y: liqY, fillColor: ORDER_LINE_COLORS.LIQUIDATION_FILL });

    ctx.restore();
  });
};

export const renderPriceTags = (
  rc: RenderContext
): void => {
  const { ctx, chartWidth, chartHeight } = rc;

  rc.priceTags.forEach(({ priceText, y, fillColor, flashAlpha: tagFlash }) => {
    if (y < 0 || y > chartHeight) return;
    const tagSize = drawPriceTag(ctx, priceText, y, chartWidth, fillColor, PRICE_TAG_WIDTH);
    if (tagFlash && tagFlash > 0) {
      const arrowWidth = 6;
      const tagX = chartWidth;
      const tagEndX = tagX + PRICE_TAG_WIDTH;
      ctx.save();
      ctx.globalAlpha = tagFlash;
      ctx.fillStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
      ctx.beginPath();
      ctx.moveTo(tagX - arrowWidth, y);
      ctx.lineTo(tagX, y - tagSize.height / 2);
      ctx.lineTo(tagEndX, y - tagSize.height / 2);
      ctx.lineTo(tagEndX, y + tagSize.height / 2);
      ctx.lineTo(tagX, y + tagSize.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      rc.needsAnimation = true;
    }
  });
};
