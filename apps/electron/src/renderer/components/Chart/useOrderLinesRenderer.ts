import type { Order, TradingSetup } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';

import {
    getKlineClose,
    getOrderId,
    getOrderPrice,
    getOrderQuantity,
    isOrderActive,
    isOrderLong,
    isOrderPending,
} from '@shared/utils';
import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';

const CANVAS_GEOMETRY = {
  FULL_CIRCLE: Math.PI + Math.PI,
  HALF: 0.5,
  DOUBLE: 2,
} as const;

const SVG_BOT_ICON = {
  VIEWBOX_SIZE: 24,
  STROKE_WIDTH_DIVISOR: 12,
  ANTENNA_CENTER_X: 12,
  ANTENNA_TOP_Y: 4,
  ANTENNA_BOTTOM_Y: 8,
  ANTENNA_LEFT_X: 8,
  BODY_X: 4,
  BODY_Y: 8,
  BODY_WIDTH: 16,
  BODY_HEIGHT: 12,
  LEFT_EAR_X: 2,
  RIGHT_EAR_START_X: 20,
  RIGHT_EAR_END_X: 22,
  EAR_Y: 14,
  LEFT_EYE_X: 9,
  RIGHT_EYE_X: 15,
  EYE_TOP_Y: 13,
  EYE_BOTTOM_Y: 15,
} as const;


const isSLInProfitZone = (isLong: boolean, entryPrice: number, slPrice: number): boolean =>
  isLong ? slPrice > entryPrice : slPrice < entryPrice;

const findKlineIndexByTime = (
  klines: Array<{ openTime: number }>,
  targetTime: number
): number => {
  if (klines.length === 0) return 0;

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    if (kline && kline.openTime >= targetTime) {
      return Math.max(0, i - 1);
    }
  }

  return klines.length - 1;
};

const drawProfitLossArea = (
  ctx: CanvasRenderingContext2D,
  y1: number,
  y2: number,
  chartWidth: number,
  isProfit: boolean,
  startX: number = 0
): void => {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const height = maxY - minY;
  if (height <= 0) return;

  const effectiveStartX = Math.max(0, startX);
  const width = chartWidth - effectiveStartX;
  if (width <= 0) return;

  ctx.save();
  ctx.fillStyle = isProfit ? ORDER_LINE_COLORS.PROFIT_AREA : ORDER_LINE_COLORS.LOSS_AREA;
  ctx.fillRect(effectiveStartX, minY, width, height);
  ctx.restore();
};

export interface BackendExecution {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: string;
  quantity: string;
  stopLoss: string | null;
  takeProfit: string | null;
  status: string | null;
  setupType: string | null;
  marketType?: 'SPOT' | 'FUTURES' | null;
  openedAt?: string | Date | null;
  triggerKlineOpenTime?: number | null;
  fibonacciProjection?: import('@marketmind/types').FibonacciProjectionData | null;
}

interface OrderCloseButton {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OrderHitbox {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: Order;
}

interface SLTPHitbox {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'stopLoss' | 'takeProfit';
  price: number;
}

interface SLTPCloseButton {
  orderIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'stopLoss' | 'takeProfit';
}

const PRICE_TAG_WIDTH = 72;

const drawBotIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void => {
  ctx.save();
  ctx.strokeStyle = ORDER_LINE_COLORS.BOT_ICON_STROKE;
  ctx.lineWidth = size / SVG_BOT_ICON.STROKE_WIDTH_DIVISOR;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const scale = size / SVG_BOT_ICON.VIEWBOX_SIZE;

  ctx.beginPath();
  ctx.moveTo(x + SVG_BOT_ICON.ANTENNA_CENTER_X * scale, y + SVG_BOT_ICON.ANTENNA_BOTTOM_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.ANTENNA_CENTER_X * scale, y + SVG_BOT_ICON.ANTENNA_TOP_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.ANTENNA_LEFT_X * scale, y + SVG_BOT_ICON.ANTENNA_TOP_Y * scale);
  ctx.stroke();

  const bodyX = x + SVG_BOT_ICON.BODY_X * scale;
  const bodyY = y + SVG_BOT_ICON.BODY_Y * scale;
  const bodyW = SVG_BOT_ICON.BODY_WIDTH * scale;
  const bodyH = SVG_BOT_ICON.BODY_HEIGHT * scale;
  const radius = CANVAS_GEOMETRY.DOUBLE * scale;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, radius);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + SVG_BOT_ICON.LEFT_EAR_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.BODY_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + SVG_BOT_ICON.RIGHT_EAR_START_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.RIGHT_EAR_END_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + SVG_BOT_ICON.RIGHT_EYE_X * scale, y + SVG_BOT_ICON.EYE_TOP_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.RIGHT_EYE_X * scale, y + SVG_BOT_ICON.EYE_BOTTOM_Y * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + SVG_BOT_ICON.LEFT_EYE_X * scale, y + SVG_BOT_ICON.EYE_TOP_Y * scale);
  ctx.lineTo(x + SVG_BOT_ICON.LEFT_EYE_X * scale, y + SVG_BOT_ICON.EYE_BOTTOM_Y * scale);
  ctx.stroke();

  ctx.restore();
};

const drawInfoTag = (
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  fillColor: string,
  hasCloseButton: boolean = false,
  closeButtonRef?: { x: number; y: number; size: number } | null,
  isAutoTrade: boolean = false
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;
  const closeButtonSize = 14;
  const closeButtonMargin = 4;
  const botIconSize = 12;
  const botIconMargin = 3;

  const textWidth = ctx.measureText(text).width;
  const closeButtonSpace = hasCloseButton ? closeButtonSize + closeButtonMargin : 0;
  const botIconSpace = isAutoTrade ? botIconSize + botIconMargin : 0;
  const totalContentWidth = closeButtonSpace + botIconSpace + textWidth;
  const tagWidth = totalContentWidth + labelPadding * 2;
  
  ctx.save();
  ctx.fillStyle = fillColor;
  
  ctx.beginPath();
  ctx.moveTo(tagWidth + arrowWidth, y);
  ctx.lineTo(tagWidth, y - labelHeight / 2);
  ctx.lineTo(0, y - labelHeight / 2);
  ctx.lineTo(0, y + labelHeight / 2);
  ctx.lineTo(tagWidth, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();
  
  if (hasCloseButton && closeButtonRef) {
    const closeButtonX = labelPadding;
    const closeButtonY = y - closeButtonSize / 2;
    
    ctx.fillStyle = ORDER_LINE_COLORS.CLOSE_BUTTON_BG;
    ctx.beginPath();
    ctx.roundRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize, 2);
    ctx.fill();
    
    ctx.strokeStyle = ORDER_LINE_COLORS.TEXT_WHITE;
    ctx.lineWidth = 1;
    const crossPadding = 3;
    ctx.beginPath();
    ctx.moveTo(closeButtonX + crossPadding, closeButtonY + crossPadding);
    ctx.lineTo(closeButtonX + closeButtonSize - crossPadding, closeButtonY + closeButtonSize - crossPadding);
    ctx.moveTo(closeButtonX + closeButtonSize - crossPadding, closeButtonY + crossPadding);
    ctx.lineTo(closeButtonX + crossPadding, closeButtonY + closeButtonSize - crossPadding);
    ctx.stroke();
    
    closeButtonRef.x = closeButtonX;
    closeButtonRef.y = closeButtonY;
    closeButtonRef.size = closeButtonSize;
  }
  
  let currentX = labelPadding + closeButtonSpace;

  if (isAutoTrade) {
    drawBotIcon(ctx, currentX, y - botIconSize / 2, botIconSize);
    currentX += botIconSize + botIconMargin;
  }

  ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
  ctx.fillText(text, currentX, y);

  ctx.restore();
  return { width: tagWidth + arrowWidth, height: labelHeight };
};

const drawPercentBadge = (
  ctx: CanvasRenderingContext2D,
  percentText: string,
  x: number,
  y: number,
  isPositive: boolean
): { width: number; height: number } => {
  const percentPadding = 4;
  const percentHeight = 14;
  const borderRadius = 3;
  const percentWidth = ctx.measureText(percentText).width;
  const badgeWidth = percentWidth + percentPadding * 2;
  
  ctx.save();
  const bgColor = isPositive ? ORDER_LINE_COLORS.PERCENT_POSITIVE_BG : ORDER_LINE_COLORS.PERCENT_NEGATIVE_BG;
  
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y - percentHeight / 2, badgeWidth, percentHeight, borderRadius);
  ctx.fill();
  
  ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
  ctx.fillText(percentText, x + percentPadding, y);
  
  ctx.restore();
  return { width: badgeWidth, height: percentHeight };
};

export interface PendingSetup {
  id: string;
  type: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  limitEntryPrice?: number;
  entryOrderType?: 'MARKET' | 'LIMIT';
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio: number;
  confidence: number;
  klineIndex: number;
  label?: string;
}

export const useOrderLinesRenderer = (
  manager: CanvasManager | null,
  hasTradingEnabled: boolean,
  hoveredOrderIdRef: RefObject<string | null>,
  backendExecutions: BackendExecution[] = [],
  pendingSetups: TradingSetup[] = [],
  showProfitLossAreas: boolean = true
) => {
  const activeOrders = useMemo((): Order[] => {
    return backendExecutions
      .filter(exec => exec.status === 'open' || exec.status === 'pending')
      .map(exec => {
        const openedTime = exec.openedAt
          ? (typeof exec.openedAt === 'string' ? new Date(exec.openedAt).getTime() : exec.openedAt.getTime())
          : null;
        const validOpenedTime = openedTime && openedTime > 1000000000000 ? openedTime : null;
        const openedAtTime = validOpenedTime || Date.now();
        return {
          id: exec.id,
          symbol: exec.symbol,
          orderId: 0,
          orderListId: -1,
          clientOrderId: exec.id,
          price: exec.entryPrice,
          origQty: exec.quantity,
          executedQty: exec.status === 'pending' ? '0' : exec.quantity,
          cummulativeQuoteQty: '0',
          status: exec.status === 'pending' ? 'NEW' as const : 'FILLED' as const,
          timeInForce: 'GTC' as const,
          type: exec.status === 'pending' ? 'LIMIT' as const : 'MARKET' as const,
          side: exec.side === 'LONG' ? 'BUY' : 'SELL',
          time: openedAtTime,
          updateTime: Date.now(),
          isWorking: true,
          origQuoteOrderQty: '0',
          entryPrice: parseFloat(exec.entryPrice),
          quantity: parseFloat(exec.quantity),
          orderDirection: exec.side === 'LONG' ? 'long' : 'short',
          stopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : undefined,
          takeProfit: exec.takeProfit ? parseFloat(exec.takeProfit) : undefined,
          isAutoTrade: true,
          walletId: '',
          setupType: exec.setupType ?? undefined,
          isPendingLimitOrder: exec.status === 'pending',
        } as Order;
      });
  }, [backendExecutions]);
  
  const closeButtonsRef = useRef<OrderCloseButton[]>([]);
  const orderHitboxesRef = useRef<OrderHitbox[]>([]);
  const sltpHitboxesRef = useRef<SLTPHitbox[]>([]);
  const sltpCloseButtonsRef = useRef<SLTPCloseButton[]>([]);

  const renderOrderLines = (): void => {
    const hasOrders = activeOrders.length > 0;
    const hasPendingSetups = pendingSetups.filter(s => s.visible).length > 0;
    if (!manager || (!hasOrders && !hasPendingSetups)) return;
    if (!hasTradingEnabled && activeOrders.length === 0 && !hasPendingSetups) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const klines = manager.getKlines();
    if (!ctx || !dimensions || !klines.length) return;

    const { width, chartWidth, chartHeight } = dimensions;
    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const currentPrice = getKlineClose(lastKline);

    closeButtonsRef.current = [];
    orderHitboxesRef.current = [];
    sltpHitboxesRef.current = [];
    sltpCloseButtonsRef.current = [];

    const priceTags: Array<{ priceText: string; y: number; fillColor: string }> = [];

    const pendingOrders = activeOrders.filter((order) => isOrderPending(order));
    const activeOrdersList = activeOrders.filter((order) => isOrderActive(order));

    const hoveredOrderId = hoveredOrderIdRef.current;
    const pendingOrdersToRender = hoveredOrderId
      ? pendingOrders.filter(o => getOrderId(o) !== hoveredOrderId)
      : pendingOrders;
    const hoveredPendingOrder = hoveredOrderId
      ? pendingOrders.find(o => getOrderId(o) === hoveredOrderId)
      : null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    type GroupedPosition = {
      symbol: string;
      netQuantity: number;
      avgPrice: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    };

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
        });
      }
    });


    pendingOrdersToRender.forEach((order) => {
      const y = manager.priceToY(getOrderPrice(order));
      if (y < 0 || y > chartHeight) return;

      const isLong = isOrderLong(order);

      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const lineColor = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
      const fillColor = isLong ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

      const priceText = formatChartPrice(getOrderPrice(order));
      priceTags.push({ priceText, y, fillColor });

      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();

      const typeLabel = isLong ? 'L' : 'S';
      const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade);

      orderHitboxesRef.current.push({
        orderId: getOrderId(order),
        x: 0,
        y: y - infoTagSize.height / 2,
        width: infoTagSize.width,
        height: infoTagSize.height,
        order,
      });

      closeButtonsRef.current.push({
        orderId: getOrderId(order),
        x: closeButtonRef.x,
        y: closeButtonRef.y,
        width: closeButtonRef.size,
        height: closeButtonRef.size,
      });

      ctx.restore();

      const pendingAlpha = 0.35;
      const entryPrice = getOrderPrice(order);

      if (showProfitLossAreas && (order.stopLoss || order.takeProfit)) {
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

      if (order.stopLoss) {
        const stopY = manager.priceToY(order.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, entryPrice, order.stopLoss);
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

        ctx.save();
        ctx.globalAlpha = pendingAlpha;
        ctx.lineWidth = 1;
        ctx.strokeStyle = slLineColor;

        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(chartWidth, stopY);
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const slResultPercent = isLong
          ? ((order.stopLoss - entryPrice) / entryPrice) * 100
          : ((entryPrice - order.stopLoss) / entryPrice) * 100;
        const slSign = slResultPercent >= 0 ? '+' : '';
        const slInfoText = `SL (${slSign}${slResultPercent.toFixed(2)}%) [PENDING]`;

        priceTags.push({ priceText: formatChartPrice(order.stopLoss), y: stopY, fillColor: slTagColor });

        const slCloseButtonRef = { x: 0, y: 0, size: 14 };
        const slTagSize = drawInfoTag(ctx, slInfoText, stopY, slTagColor, true, slCloseButtonRef);

        sltpHitboxesRef.current.push({
          orderId: getOrderId(order),
          x: 0,
          y: stopY - slTagSize.height / 2,
          width: slTagSize.width,
          height: slTagSize.height,
          type: 'stopLoss',
          price: order.stopLoss,
        });

        sltpCloseButtonsRef.current.push({
          orderIds: [getOrderId(order)],
          x: slCloseButtonRef.x,
          y: slCloseButtonRef.y,
          width: slCloseButtonRef.size,
          height: slCloseButtonRef.size,
          type: 'stopLoss',
        });

        ctx.restore();
      }

      if (order.takeProfit) {
        const tpY = manager.priceToY(order.takeProfit);

        ctx.save();
        ctx.globalAlpha = pendingAlpha;
        ctx.lineWidth = 1;
        ctx.strokeStyle = ORDER_LINE_COLORS.TP_LINE;

        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const tpProfitPercent = isLong
          ? ((order.takeProfit - entryPrice) / entryPrice) * 100
          : ((entryPrice - order.takeProfit) / entryPrice) * 100;
        const tpInfoText = `TP (+${tpProfitPercent.toFixed(2)}%) [PENDING]`;

        priceTags.push({ priceText: formatChartPrice(order.takeProfit), y: tpY, fillColor: ORDER_LINE_COLORS.LONG_FILL });

        const tpCloseButtonRef = { x: 0, y: 0, size: 14 };
        const tpTagSize = drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.LONG_FILL, true, tpCloseButtonRef);

        sltpHitboxesRef.current.push({
          orderId: getOrderId(order),
          x: 0,
          y: tpY - tpTagSize.height / 2,
          width: tpTagSize.width,
          height: tpTagSize.height,
          type: 'takeProfit',
          price: order.takeProfit,
        });

        sltpCloseButtonsRef.current.push({
          orderIds: [getOrderId(order)],
          x: tpCloseButtonRef.x,
          y: tpCloseButtonRef.y,
          width: tpCloseButtonRef.size,
          height: tpCloseButtonRef.size,
          type: 'takeProfit',
        });

        ctx.restore();
      }
    });

    let hoveredPosition: GroupedPosition | null = null;
    const positionsToRender: GroupedPosition[] = [];
    const allPositions: GroupedPosition[] = [];

    groupedPositions.forEach((position) => {
      allPositions.push(position);
      const isHovered = hoveredOrderId && position.orderIds.includes(hoveredOrderId);
      if (isHovered) {
        hoveredPosition = position;
      } else {
        positionsToRender.push(position);
      }
    });

    positionsToRender.forEach((position) => {
      if (position.orders.length === 0) return;
      
      const y = manager.priceToY(position.avgPrice);
      const isLong = position.netQuantity > 0;
      const absQuantity = Math.abs(position.netQuantity);
      
      const setupTypes = [...new Set(position.orders.map(o => o.setupType).filter(Boolean))] as string[];
      const positionData = {
        symbol: position.symbol,
        type: isLong ? ('long' as const) : ('short' as const),
        avgPrice: position.avgPrice,
        totalQuantity: absQuantity,
        totalPnL: position.totalPnL,
        orders: position.orders,
        setupTypes,
      };

      const positionId = `position-${position.symbol}-${isLong ? 'LONG' : 'SHORT'}`;
      
      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const lineColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_LINE : ORDER_LINE_COLORS.POSITION_SHORT_LINE;
      const fillColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_FILL : ORDER_LINE_COLORS.POSITION_SHORT_FILL;
      
      const priceText = formatChartPrice(position.avgPrice);
      priceTags.push({ priceText, y, fillColor });
      
      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();
      
      const priceChange = currentPrice - position.avgPrice;
      const percentChange = isLong 
        ? (priceChange / position.avgPrice) * 100
        : (-priceChange / position.avgPrice) * 100;
      
      const percentSign = percentChange >= 0 ? '+' : '';
      const percentText = `${percentSign}${percentChange.toFixed(2)}%`;
      
      const quantityPrefix = position.orders.length > 1
        ? `(${position.orders.length}x) `
        : '';
      const directionSymbol = isLong ? '↑' : '↓';
      const infoText = `${quantityPrefix}${directionSymbol} (${absQuantity})`;
      const hasAutoTrade = position.orders.some(o => o.isAutoTrade);

      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, hasAutoTrade);

      orderHitboxesRef.current.push({
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
        closeButtonsRef.current.push({
          orderId,
          x: closeButtonRef.x,
          y: closeButtonRef.y,
          width: closeButtonRef.size,
          height: closeButtonRef.size,
        });
      });

      const badgeX = infoTagSize.width + 6;
      drawPercentBadge(ctx, percentText, badgeX, y, percentChange >= 0);

      ctx.restore();
    });

    if (hoveredPendingOrder) {
      const order = hoveredPendingOrder;
      const y = manager.priceToY(getOrderPrice(order));
      if (y >= 0 && y <= chartHeight) {
        const isLong = isOrderLong(order);

        ctx.save();
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const lineColor = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
        const fillColor = isLong ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

        const priceText = formatChartPrice(getOrderPrice(order));
        const tagStartX = chartWidth - PRICE_TAG_WIDTH;
        drawPriceTag(ctx, priceText, y, tagStartX, fillColor, PRICE_TAG_WIDTH);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(tagStartX, y);
        ctx.stroke();

        const typeLabel = isLong ? 'L' : 'S';
        const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

        const closeButtonRef = { x: 0, y: 0, size: 14 };
        drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade);

        closeButtonsRef.current.push({
          orderId: getOrderId(order),
          x: closeButtonRef.x,
          y: closeButtonRef.y,
          width: closeButtonRef.size,
          height: closeButtonRef.size,
        });

        ctx.restore();

        const pendingAlpha = 0.35;
        const entryPrice = getOrderPrice(order);

        if (order.stopLoss) {
          const stopY = manager.priceToY(order.stopLoss);

          ctx.save();
          ctx.globalAlpha = pendingAlpha;
          ctx.lineWidth = 1;
          ctx.strokeStyle = ORDER_LINE_COLORS.SL_LOSS_LINE;

          ctx.beginPath();
          ctx.moveTo(0, stopY);
          ctx.lineTo(chartWidth, stopY);
          ctx.stroke();

          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          const slResultPercent = isLong
            ? ((order.stopLoss - entryPrice) / entryPrice) * 100
            : ((entryPrice - order.stopLoss) / entryPrice) * 100;
          const slSign = slResultPercent >= 0 ? '+' : '';
          const slInfoText = `SL (${slSign}${slResultPercent.toFixed(2)}%) [PENDING]`;

          drawInfoTag(ctx, slInfoText, stopY, ORDER_LINE_COLORS.SHORT_FILL, true, null);
          ctx.restore();
        }

        if (order.takeProfit) {
          const tpY = manager.priceToY(order.takeProfit);

          ctx.save();
          ctx.globalAlpha = pendingAlpha;
          ctx.lineWidth = 1;
          ctx.strokeStyle = ORDER_LINE_COLORS.SL_PROFIT_LINE;

          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();

          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          const tpProfitPercent = isLong
            ? ((order.takeProfit - entryPrice) / entryPrice) * 100
            : ((entryPrice - order.takeProfit) / entryPrice) * 100;
          const tpInfoText = `TP (+${tpProfitPercent.toFixed(2)}%) [PENDING]`;

          drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.LONG_FILL, true, null);
          ctx.restore();
        }
      }
    }

    if (hoveredPosition) {
      const hPos = hoveredPosition as GroupedPosition;
      const y = manager.priceToY(hPos.avgPrice);
      if (y >= 0 && y <= chartHeight) {
        const isLong = hPos.netQuantity > 0;
        const absQuantity = Math.abs(hPos.netQuantity);
        const positionId = `position-${hPos.symbol}-${isLong ? 'LONG' : 'SHORT'}`;

        const setupTypes = [...new Set(hPos.orders.map((o: Order) => o.setupType).filter(Boolean))] as string[];
        const positionData = {
          symbol: hPos.symbol,
          type: isLong ? ('long' as const) : ('short' as const),
          avgPrice: hPos.avgPrice,
          totalQuantity: absQuantity,
          totalPnL: hPos.totalPnL,
          orders: hPos.orders,
          setupTypes,
        };

        ctx.save();
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const lineColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_LINE : ORDER_LINE_COLORS.POSITION_SHORT_LINE;
        const fillColor = isLong ? ORDER_LINE_COLORS.POSITION_LONG_FILL : ORDER_LINE_COLORS.POSITION_SHORT_FILL;

        const priceText = formatChartPrice(hPos.avgPrice);
        const tagStartX = chartWidth - PRICE_TAG_WIDTH;
        drawPriceTag(ctx, priceText, y, tagStartX, fillColor, PRICE_TAG_WIDTH);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(tagStartX, y);
        ctx.stroke();

        const priceChange = currentPrice - hPos.avgPrice;
        const percentChange = isLong
          ? (priceChange / hPos.avgPrice) * 100
          : (-priceChange / hPos.avgPrice) * 100;

        const percentSign = percentChange >= 0 ? '+' : '';
        const percentText = `${percentSign}${percentChange.toFixed(2)}%`;

        const typeLabel = isLong ? 'L' : 'S';
        const quantityPrefix = hPos.orders.length > 1
          ? `(${hPos.orders.length}x) `
          : '';
        const infoText = `${quantityPrefix}${typeLabel} (${absQuantity})`;
        const hasAutoTrade = hPos.orders.some((o: Order) => o.isAutoTrade);

        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, hasAutoTrade);

        orderHitboxesRef.current.push({
          orderId: positionId,
          x: 0,
          y: y - infoTagSize.height / 2,
          width: infoTagSize.width,
          height: infoTagSize.height,
          order: {
            ...hPos.orders[0],
            id: positionId,
            entryPrice: hPos.avgPrice,
            quantity: absQuantity,
            metadata: { isPosition: true, positionData },
          } as Order,
        });

        hPos.orderIds.forEach((orderId: string) => {
          closeButtonsRef.current.push({
            orderId,
            x: closeButtonRef.x,
            y: closeButtonRef.y,
            width: closeButtonRef.size,
            height: closeButtonRef.size,
          });
        });

        const badgeX = infoTagSize.width + 6;
        drawPercentBadge(ctx, percentText, badgeX, y, percentChange >= 0);

        ctx.restore();
      }
    }

    allPositions.forEach((position) => {
      const isPendingPosition = position.orders.some(o => (o as Order & { isPendingLimitOrder?: boolean }).isPendingLimitOrder);
      const pendingAlpha = isPendingPosition ? 0.35 : 1;
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

      if (showProfitLossAreas && (consolidatedStopLoss || consolidatedTakeProfit)) {
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

      const anyOrderHasStopLoss = stopLossOrders.length > 0;
      if (anyOrderHasStopLoss && consolidatedStopLoss) {
        const stopY = manager.priceToY(consolidatedStopLoss);
        const slIsProfit = isSLInProfitZone(isLongPosition, position.avgPrice, consolidatedStopLoss);
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.LONG_FILL : ORDER_LINE_COLORS.SHORT_FILL;

        const firstOrderId = position.orderIds[0] || '';

        ctx.save();
        ctx.globalAlpha = pendingAlpha;
        ctx.lineWidth = 1;
        ctx.strokeStyle = slLineColor;

        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(chartWidth, stopY);
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const priceText = formatChartPrice(consolidatedStopLoss);
        const slResultPercent = isLongPosition
          ? ((consolidatedStopLoss - position.avgPrice) / position.avgPrice) * 100
          : ((position.avgPrice - consolidatedStopLoss) / position.avgPrice) * 100;
        const slSign = slResultPercent >= 0 ? '+' : '';
        const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
        const infoText = `SL (${slSign}${slResultPercent.toFixed(2)}%)${pendingLabel}`;

        priceTags.push({ priceText, y: stopY, fillColor: slTagColor });

        const tagStartX = chartWidth;
        ctx.strokeStyle = slLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(tagStartX, stopY);
        ctx.stroke();

        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const slTagSize = drawInfoTag(ctx, infoText, stopY, slTagColor, true, closeButtonRef);

        orderHitboxesRef.current.push({
          orderId: firstOrderId,
          x: 0,
          y: stopY - slTagSize.height / 2,
          width: slTagSize.width,
          height: slTagSize.height,
          order: {
            ...position.orders[0],
            entryPrice: consolidatedStopLoss,
            stopLoss: consolidatedStopLoss,
            metadata: { isSLTP: true, type: 'stopLoss' },
          } as Order,
        });

        position.orders.forEach((order) => {
          sltpHitboxesRef.current.push({
            orderId: getOrderId(order),
            x: 0,
            y: stopY - slTagSize.height / 2,
            width: slTagSize.width,
            height: slTagSize.height,
            type: 'stopLoss',
            price: consolidatedStopLoss,
          });
        });

        sltpCloseButtonsRef.current.push({
          orderIds: position.orderIds,
          x: closeButtonRef.x,
          y: closeButtonRef.y,
          width: closeButtonRef.size,
          height: closeButtonRef.size,
          type: 'stopLoss',
        });

        ctx.restore();
      }

      const anyOrderHasTakeProfit = takeProfitOrders.length > 0;
      if (anyOrderHasTakeProfit && consolidatedTakeProfit) {
        const tpY = manager.priceToY(consolidatedTakeProfit);

        const firstOrderId = position.orderIds[0] || '';

        ctx.save();
        ctx.globalAlpha = pendingAlpha;
        ctx.lineWidth = 1;
        ctx.strokeStyle = ORDER_LINE_COLORS.TP_LINE;

        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const fillColor = ORDER_LINE_COLORS.LONG_FILL;
        const priceText = formatChartPrice(consolidatedTakeProfit);
        const tpProfitPercent = isLongPosition
          ? ((consolidatedTakeProfit - position.avgPrice) / position.avgPrice) * 100
          : ((position.avgPrice - consolidatedTakeProfit) / position.avgPrice) * 100;
        const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
        const infoText = `TP (+${tpProfitPercent.toFixed(2)}%)${pendingLabel}`;

        priceTags.push({ priceText, y: tpY, fillColor });

        const tagStartX = chartWidth;
        ctx.strokeStyle = ORDER_LINE_COLORS.SL_PROFIT_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(tagStartX, tpY);
        ctx.stroke();

        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const tpTagSize = drawInfoTag(ctx, infoText, tpY, fillColor, true, closeButtonRef);

        orderHitboxesRef.current.push({
          orderId: firstOrderId,
          x: 0,
          y: tpY - tpTagSize.height / 2,
          width: tpTagSize.width,
          height: tpTagSize.height,
          order: {
            ...position.orders[0],
            entryPrice: consolidatedTakeProfit,
            takeProfit: consolidatedTakeProfit,
            metadata: { isSLTP: true, type: 'takeProfit' },
          } as Order,
        });

        position.orders.forEach((order) => {
          sltpHitboxesRef.current.push({
            orderId: getOrderId(order),
            x: 0,
            y: tpY - tpTagSize.height / 2,
            width: tpTagSize.width,
            height: tpTagSize.height,
            type: 'takeProfit',
            price: consolidatedTakeProfit,
          });
        });

        sltpCloseButtonsRef.current.push({
          orderIds: position.orderIds,
          x: closeButtonRef.x,
          y: closeButtonRef.y,
          width: closeButtonRef.size,
          height: closeButtonRef.size,
          type: 'takeProfit',
        });

        ctx.restore();
      }
    });

    pendingSetups.forEach((setup) => {
      if (!setup.visible) return;

      const effectiveEntryPrice = setup.entryOrderType === 'LIMIT' && setup.limitEntryPrice
        ? setup.limitEntryPrice
        : setup.entryPrice;

      const entryY = manager.priceToY(effectiveEntryPrice);
      if (entryY < 0 || entryY > chartHeight) return;

      const isLong = setup.direction === 'LONG';
      const isLimitOrder = setup.entryOrderType === 'LIMIT';
      const pendingAlpha = 0.5;

      if (showProfitLossAreas && (setup.stopLoss || setup.takeProfit)) {
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
      ctx.globalAlpha = pendingAlpha;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const lineColor = isLong ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;
      const fillColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_FILL : ORDER_LINE_COLORS.PENDING_SHORT_FILL;

      const priceText = formatChartPrice(effectiveEntryPrice);
      priceTags.push({ priceText, y: entryY, fillColor });

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, entryY);
      ctx.lineTo(chartWidth, entryY);
      ctx.stroke();

      const setupLabel = setup.label ?? setup.type;
      const directionSymbol = isLong ? '↑' : '↓';
      const orderTypeLabel = isLimitOrder ? 'LIMIT' : 'MKT';
      const infoText = `${directionSymbol} ${setupLabel} (${orderTypeLabel})`;

      drawInfoTag(ctx, infoText, entryY, fillColor, false, null, true);

      if (setup.stopLoss) {
        const slY = manager.priceToY(setup.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SETUP_PROFIT_LINE : ORDER_LINE_COLORS.SETUP_LOSS_LINE;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : ORDER_LINE_COLORS.SL_LOSS_LINE;

        ctx.globalAlpha = pendingAlpha * 0.7;

        ctx.strokeStyle = slLineColor;
        ctx.beginPath();
        ctx.moveTo(0, slY);
        ctx.lineTo(chartWidth, slY);
        ctx.stroke();

        const slPriceText = formatChartPrice(setup.stopLoss);
        const slPercent = isLong
          ? ((setup.stopLoss - effectiveEntryPrice) / effectiveEntryPrice) * 100
          : ((effectiveEntryPrice - setup.stopLoss) / effectiveEntryPrice) * 100;
        const slInfoText = `SL (${slPercent.toFixed(2)}%)`;

        priceTags.push({ priceText: slPriceText, y: slY, fillColor: slTagColor });
        drawInfoTag(ctx, slInfoText, slY, slTagColor, false, null, false);
      }

      if (setup.takeProfit) {
        const tpY = manager.priceToY(setup.takeProfit);
        ctx.globalAlpha = pendingAlpha * 0.7;

        ctx.strokeStyle = ORDER_LINE_COLORS.SETUP_PROFIT_LINE;
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();

        const tpPriceText = formatChartPrice(setup.takeProfit);
        const tpPercent = isLong
          ? ((setup.takeProfit - effectiveEntryPrice) / effectiveEntryPrice) * 100
          : ((effectiveEntryPrice - setup.takeProfit) / effectiveEntryPrice) * 100;
        const tpInfoText = `TP (+${tpPercent.toFixed(2)}%)`;

        priceTags.push({ priceText: tpPriceText, y: tpY, fillColor: ORDER_LINE_COLORS.SL_PROFIT_LINE });
        drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.SL_PROFIT_LINE, false, null, false);
      }

      ctx.restore();
    });

    ctx.restore();

    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    priceTags.forEach(({ priceText, y, fillColor }) => {
      if (y >= 0 && y <= chartHeight) {
        const tagStartX = width - PRICE_TAG_WIDTH;
        drawPriceTag(ctx, priceText, y, tagStartX, fillColor, PRICE_TAG_WIDTH);
      }
    });
    
    ctx.restore();
  };

  const getClickedOrderId = (x: number, y: number): string | null => {
    for (const button of sltpCloseButtonsRef.current) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
      ) {
        return `sltp-${button.type}-${button.orderIds.join(',')}`;
      }
    }
    
    for (const button of closeButtonsRef.current) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
      ) {
        return button.orderId;
      }
    }
    return null;
  };

  const getOrderAtPosition = (x: number, y: number): import('@marketmind/types').Order | null => {
    if (!manager || !hasTradingEnabled) return null;

    for (const hitbox of orderHitboxesRef.current) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return hitbox.order;
      }
    }

    return null;
  };

  const getHoveredOrder = (x: number, y: number): Order | null => {
    for (const hitbox of orderHitboxesRef.current) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return hitbox.order;
      }
    }

    return null;
  };

  const getSLTPAtPosition = (x: number, y: number): { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number } | null => {
    for (const hitbox of sltpHitboxesRef.current) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return {
          orderId: hitbox.orderId,
          type: hitbox.type,
          price: hitbox.price,
        };
      }
    }
    return null;
  };

  return { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition };
};
