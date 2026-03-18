import type { Order, TradingSetup } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawBotIcon, drawShieldIcon } from '@renderer/utils/canvas/canvasIcons';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG, ORDER_LINE_COLORS, ORDER_LINE_LAYOUT, ORDER_LINE_ANIMATION } from '@shared/constants';

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
import { useOrderFlashStore } from '@renderer/store/orderFlashStore';


const isSLInProfitZone = (isLong: boolean, entryPrice: number, slPrice: number): boolean =>
  isLong ? slPrice > entryPrice : slPrice < entryPrice;

const findKlineIndexByTime = (
  klines: Array<{ openTime: number }>,
  targetTime: number
): number => {
  if (klines.length === 0) return 0;
  let low = 0;
  let high = klines.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (klines[mid]!.openTime < targetTime) low = mid + 1;
    else if (klines[mid]!.openTime > targetTime) high = mid - 1;
    else return mid;
  }
  return Math.max(0, high);
};

const drawInfoTagFlash = (
  ctx: CanvasRenderingContext2D,
  tagSize: { width: number; height: number },
  y: number,
  flashAlpha: number
): void => {
  if (flashAlpha <= 0) return;
  const bodyEnd = tagSize.width - ORDER_LINE_LAYOUT.ARROW_WIDTH;
  const halfH = tagSize.height / 2;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
  ctx.beginPath();
  ctx.moveTo(tagSize.width, y);
  ctx.lineTo(bodyEnd, y - halfH);
  ctx.lineTo(0, y - halfH);
  ctx.lineTo(0, y + halfH);
  ctx.lineTo(bodyEnd, y + halfH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  entryOrderType?: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | null;
  marketType?: 'SPOT' | 'FUTURES' | null;
  openedAt?: string | Date | null;
  triggerKlineOpenTime?: number | null;
  fibonacciProjection?: import('@marketmind/types').FibonacciProjectionData | null;
  leverage?: number;
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

interface SlTpButtonHitbox {
  executionId: string;
  type: 'stopLoss' | 'takeProfit';
  x: number;
  y: number;
  width: number;
  height: number;
}

const PRICE_TAG_WIDTH = CHART_CONFIG.CANVAS_PADDING_RIGHT;

const drawSpinner = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  timestamp: number
): void => {
  const startAngle = timestamp * ORDER_LINE_ANIMATION.SPINNER_SPEED;
  ctx.strokeStyle = ORDER_LINE_COLORS.SPINNER_COLOR;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, startAngle + ORDER_LINE_ANIMATION.SPINNER_ARC_LENGTH);
  ctx.stroke();
};

const drawInfoTag = (
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  fillColor: string,
  hasCloseButton: boolean = false,
  closeButtonRef?: { x: number; y: number; size: number } | null,
  icon: 'bot' | 'shield' | null = null,
  isLoading: boolean = false,
  timestamp: number = 0
): { width: number; height: number } => {
  const { LABEL_PADDING, LABEL_HEIGHT, ARROW_WIDTH, CLOSE_BUTTON_SIZE, CLOSE_BUTTON_MARGIN, ICON_SIZE, ICON_MARGIN, CLOSE_CROSS_PADDING } = ORDER_LINE_LAYOUT;

  const textWidth = ctx.measureText(text).width;
  const closeButtonSpace = hasCloseButton ? CLOSE_BUTTON_SIZE + CLOSE_BUTTON_MARGIN : 0;
  const iconSpace = icon ? ICON_SIZE + ICON_MARGIN : 0;
  const totalContentWidth = closeButtonSpace + iconSpace + textWidth;
  const tagWidth = totalContentWidth + LABEL_PADDING * 2;

  ctx.save();
  ctx.fillStyle = fillColor;

  ctx.beginPath();
  ctx.moveTo(tagWidth + ARROW_WIDTH, y);
  ctx.lineTo(tagWidth, y - LABEL_HEIGHT / 2);
  ctx.lineTo(0, y - LABEL_HEIGHT / 2);
  ctx.lineTo(0, y + LABEL_HEIGHT / 2);
  ctx.lineTo(tagWidth, y + LABEL_HEIGHT / 2);
  ctx.closePath();
  ctx.fill();

  if (hasCloseButton && closeButtonRef) {
    const closeButtonX = LABEL_PADDING;
    const closeButtonY = y - CLOSE_BUTTON_SIZE / 2;

    ctx.fillStyle = ORDER_LINE_COLORS.CLOSE_BUTTON_BG;
    ctx.beginPath();
    ctx.roundRect(closeButtonX, closeButtonY, CLOSE_BUTTON_SIZE, CLOSE_BUTTON_SIZE, 2);
    ctx.fill();

    if (isLoading) {
      drawSpinner(ctx, closeButtonX + CLOSE_BUTTON_SIZE / 2, y, CLOSE_BUTTON_SIZE / 2 - 2, timestamp);
    } else {
      ctx.strokeStyle = ORDER_LINE_COLORS.TEXT_WHITE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(closeButtonX + CLOSE_CROSS_PADDING, closeButtonY + CLOSE_CROSS_PADDING);
      ctx.lineTo(closeButtonX + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING, closeButtonY + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING);
      ctx.moveTo(closeButtonX + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING, closeButtonY + CLOSE_CROSS_PADDING);
      ctx.lineTo(closeButtonX + CLOSE_CROSS_PADDING, closeButtonY + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING);
      ctx.stroke();
    }

    closeButtonRef.x = closeButtonX;
    closeButtonRef.y = closeButtonY;
    closeButtonRef.size = CLOSE_BUTTON_SIZE;
  }

  let currentX = LABEL_PADDING + closeButtonSpace;

  if (icon === 'bot') {
    drawBotIcon(ctx, currentX, y - ICON_SIZE / 2, ICON_SIZE);
    currentX += ICON_SIZE + ICON_MARGIN;
  } else if (icon === 'shield') {
    drawShieldIcon(ctx, currentX, y - ICON_SIZE / 2 - 1, ICON_SIZE);
    currentX += ICON_SIZE + ICON_MARGIN;
  }

  ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
  ctx.fillText(text, currentX, y);

  ctx.restore();
  return { width: tagWidth + ARROW_WIDTH, height: LABEL_HEIGHT };
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

const SLTP_BUTTON = {
  WIDTH: 20,
  HEIGHT: 14,
  GAP: 3,
  BORDER_RADIUS: 3,
  FONT_SIZE: 9,
  SL_BG: 'rgba(185, 28, 28, 0.85)',
  SL_BORDER: 'rgba(185, 28, 28, 1)',
  TP_BG: 'rgba(15, 118, 56, 0.85)',
  TP_BORDER: 'rgba(15, 118, 56, 1)',
  TEXT_COLOR: '#ffffff',
} as const;

const drawSlTpButtons = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hasStopLoss: boolean,
  hasTakeProfit: boolean,
): { slButton: { x: number; y: number } | null; tpButton: { x: number; y: number } | null; totalWidth: number } => {
  let currentX = x;
  let slButton: { x: number; y: number } | null = null;
  let tpButton: { x: number; y: number } | null = null;

  ctx.save();
  ctx.font = `${SLTP_BUTTON.FONT_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!hasStopLoss) {
    const btnY = y - SLTP_BUTTON.HEIGHT / 2;
    ctx.fillStyle = SLTP_BUTTON.SL_BG;
    ctx.strokeStyle = SLTP_BUTTON.SL_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, SLTP_BUTTON.BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
    ctx.fillText('SL', currentX + SLTP_BUTTON.WIDTH / 2, y);
    slButton = { x: currentX, y: btnY };
    currentX += SLTP_BUTTON.WIDTH + SLTP_BUTTON.GAP;
  }

  if (!hasTakeProfit) {
    const btnY = y - SLTP_BUTTON.HEIGHT / 2;
    ctx.fillStyle = SLTP_BUTTON.TP_BG;
    ctx.strokeStyle = SLTP_BUTTON.TP_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, SLTP_BUTTON.BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
    ctx.fillText('TP', currentX + SLTP_BUTTON.WIDTH / 2, y);
    tpButton = { x: currentX, y: btnY };
    currentX += SLTP_BUTTON.WIDTH;
  }

  ctx.restore();
  return { slButton, tpButton, totalWidth: currentX - x };
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

export interface TrailingStopLineConfig {
  enabled: boolean;
  activationPercentLong: number;
  activationPercentShort: number;
}

export const useOrderLinesRenderer = (
  manager: CanvasManager | null,
  hasTradingEnabled: boolean,
  hoveredOrderIdRef: RefObject<string | null>,
  backendExecutions: BackendExecution[] = [],
  pendingSetups: TradingSetup[] = [],
  showProfitLossAreas: boolean = true,
  orderLoadingMapRef?: RefObject<Map<string, number>>,
  orderFlashMapRef?: RefObject<Map<string, number>>,
  trailingStopConfig?: TrailingStopLineConfig | null,
  draggedOrderIdRef?: RefObject<string | null>
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
          type: (exec.entryOrderType ?? (exec.status === 'pending' ? 'LIMIT' : 'MARKET')) as Order['type'],
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
          isAutoTrade: !!exec.setupType,
          walletId: '',
          setupType: exec.setupType ?? undefined,
          isPendingLimitOrder: exec.status === 'pending',
          leverage: exec.leverage ?? 1,
        } as Order;
      });
  }, [backendExecutions]);
  
  const closeButtonsRef = useRef<OrderCloseButton[]>([]);
  const orderHitboxesRef = useRef<OrderHitbox[]>([]);
  const sltpHitboxesRef = useRef<SLTPHitbox[]>([]);
  const sltpCloseButtonsRef = useRef<SLTPCloseButton[]>([]);
  const slTpButtonHitboxesRef = useRef<SlTpButtonHitbox[]>([]);
  const tsCloseButtonsRef = useRef<Array<{ x: number; y: number; size: number }>>([]);

  const renderOrderLines = (): boolean => {
    const hasOrders = activeOrders.length > 0;
    const hasPendingSetups = pendingSetups.filter(s => s.visible).length > 0;
    if (!manager || (!hasOrders && !hasPendingSetups)) return false;
    if (!hasTradingEnabled && activeOrders.length === 0 && !hasPendingSetups) return false;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const klines = manager.getKlines();
    if (!ctx || !dimensions || !klines.length) return false;

    const { chartWidth, chartHeight } = dimensions;
    const lastKline = klines[klines.length - 1];
    if (!lastKline) return false;

    const currentPrice = getKlineClose(lastKline);
    const now = performance.now();
    let needsAnimation = false;

    const isOrderLoading = (orderId: string): boolean =>
      orderLoadingMapRef?.current?.has(orderId) ?? false;

    const getFlashAlpha = (orderId: string): number => {
      const localFlashTime = orderFlashMapRef?.current?.get(orderId);
      const storeFlashTime = useOrderFlashStore.getState().getFlashTime(orderId);
      const flashTime = Math.max(localFlashTime ?? 0, storeFlashTime ?? 0) || 0;
      if (!flashTime) return 0;
      const elapsed = now - flashTime;
      if (elapsed >= ORDER_LINE_ANIMATION.FLASH_DURATION_MS) {
        orderFlashMapRef?.current?.delete(orderId);
        if (storeFlashTime) useOrderFlashStore.getState().clearFlash(orderId);
        return 0;
      }
      needsAnimation = true;
      return (1 - elapsed / ORDER_LINE_ANIMATION.FLASH_DURATION_MS) * 0.6;
    };

    closeButtonsRef.current = [];
    orderHitboxesRef.current = [];
    sltpHitboxesRef.current = [];
    sltpCloseButtonsRef.current = [];
    slTpButtonHitboxesRef.current = [];
    tsCloseButtonsRef.current = [];

    const priceTags: Array<{ priceText: string; y: number; fillColor: string; flashAlpha?: number }> = [];

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
      leverage: number;
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
          leverage: (order as Order & { leverage?: number }).leverage ?? 1,
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

      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();

      const typeLabel = isLong ? 'L' : 'S';
      const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

      const orderId = getOrderId(order);
      const loading = isOrderLoading(orderId);
      if (loading) needsAnimation = true;
      const flashAlpha = getFlashAlpha(orderId);
      priceTags.push({ priceText, y, fillColor, flashAlpha });

      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const entryTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, loading, now);
      drawInfoTagFlash(ctx, entryTagSize, y, flashAlpha);

      orderHitboxesRef.current.push({
        orderId,
        x: 0,
        y: y - ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT / 2,
        width: chartWidth,
        height: ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT,
        order,
      });

      closeButtonsRef.current.push({
        orderId,
        x: closeButtonRef.x,
        y: closeButtonRef.y,
        width: closeButtonRef.size,
        height: closeButtonRef.size,
      });

      ctx.restore();

      if (flashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.restore();
      }

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
        const slLossColor = ORDER_LINE_COLORS.SL_LOSS_LINE;
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossColor;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL;

        ctx.save();
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

        const slFlashAlphaVal = getFlashAlpha(`${orderId}-sl`);
        priceTags.push({ priceText: formatChartPrice(order.stopLoss), y: stopY, fillColor: slTagColor, flashAlpha: slFlashAlphaVal });

        const slCloseButtonRef = { x: 0, y: 0, size: 14 };
        const slLoading = isOrderLoading(orderId);
        if (slLoading) needsAnimation = true;
        const slTagSize = drawInfoTag(ctx, slInfoText, stopY, slTagColor, true, slCloseButtonRef, null, slLoading, now);
        drawInfoTagFlash(ctx, slTagSize, stopY, slFlashAlphaVal);

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

        const slFlashAlpha = getFlashAlpha(`${orderId}-sl`);
        if (slFlashAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = slFlashAlpha;
          ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, stopY);
          ctx.lineTo(chartWidth, stopY);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (order.takeProfit) {
        const tpY = manager.priceToY(order.takeProfit);

        ctx.save();
        ctx.lineWidth = 1;
        const tpLineColor = ORDER_LINE_COLORS.TP_LINE;
        const tpFillColor = ORDER_LINE_COLORS.TP_FILL;
        ctx.strokeStyle = tpLineColor;

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
        const tpInfoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%) [PENDING]`;

        const tpFlashAlphaVal = getFlashAlpha(`${orderId}-tp`);
        priceTags.push({ priceText: formatChartPrice(order.takeProfit), y: tpY, fillColor: tpFillColor, flashAlpha: tpFlashAlphaVal });

        const tpCloseButtonRef = { x: 0, y: 0, size: 14 };
        const tpLoading = isOrderLoading(orderId);
        if (tpLoading) needsAnimation = true;
        const tpTagSize = drawInfoTag(ctx, tpInfoText, tpY, tpFillColor, true, tpCloseButtonRef, null, tpLoading, now);
        drawInfoTagFlash(ctx, tpTagSize, tpY, tpFlashAlphaVal);

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

        const tpFlashAlpha = getFlashAlpha(`${orderId}-tp`);
        if (tpFlashAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = tpFlashAlpha;
          ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();
          ctx.restore();
        }
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
        leverage: position.leverage,
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

      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();

      const priceChange = currentPrice - position.avgPrice;
      const percentChange = (isLong
        ? (priceChange / position.avgPrice) * 100
        : (-priceChange / position.avgPrice) * 100) * position.leverage;
      
      const percentSign = percentChange >= 0 ? '+' : '';
      const percentText = `${percentSign}${percentChange.toFixed(2)}%`;
      
      const leveragePrefix = position.leverage > 1 ? `${position.leverage}x ` : '';
      const directionSymbol = isLong ? '↑' : '↓';
      const infoText = `${leveragePrefix}${directionSymbol} (${absQuantity})`;
      const hasAutoTrade = position.orders.some(o => o.isAutoTrade);

      const posLoading = position.orderIds.some(id => isOrderLoading(id));
      if (posLoading) needsAnimation = true;
      const posFlash = position.orderIds.reduce((maxAlpha, id) => Math.max(maxAlpha, getFlashAlpha(id)), 0);
      priceTags.push({ priceText, y, fillColor, flashAlpha: posFlash });

      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, hasAutoTrade ? 'bot' : null, posLoading, now);
      drawInfoTagFlash(ctx, infoTagSize, y, posFlash);

      if (posFlash > 0) {
        ctx.save();
        ctx.globalAlpha = posFlash;
        ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.restore();
      }

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

      const percentBadgeWidth = ctx.measureText(percentText).width + 8;
      const buttonsX = badgeX + percentBadgeWidth + 6;
      const hasStopLoss = position.orders.some(o => o.stopLoss);
      const hasTakeProfit = position.orders.some(o => o.takeProfit);

      if (!hasStopLoss || !hasTakeProfit) {
        const { slButton, tpButton } = drawSlTpButtons(ctx, buttonsX, y, hasStopLoss, hasTakeProfit);
        const primaryOrderId = position.orderIds[0] || '';
        if (slButton) {
          slTpButtonHitboxesRef.current.push({
            executionId: primaryOrderId,
            type: 'stopLoss',
            x: slButton.x,
            y: slButton.y,
            width: SLTP_BUTTON.WIDTH,
            height: SLTP_BUTTON.HEIGHT,
          });
        }
        if (tpButton) {
          slTpButtonHitboxesRef.current.push({
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
    });

    const isDraggedOrder = hoveredPendingOrder && draggedOrderIdRef?.current === getOrderId(hoveredPendingOrder);
    if (hoveredPendingOrder && !isDraggedOrder) {
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
        drawPriceTag(ctx, priceText, y, chartWidth, fillColor, PRICE_TAG_WIDTH);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();

        const typeLabel = isLong ? 'L' : 'S';
        const infoText = `${typeLabel} (${getOrderQuantity(order)})`;

        const hoveredOrderId = getOrderId(order);
        const hoveredLoading = isOrderLoading(hoveredOrderId);
        if (hoveredLoading) needsAnimation = true;
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, order.isAutoTrade ? 'bot' : null, hoveredLoading, now);

        orderHitboxesRef.current.push({
          orderId: hoveredOrderId,
          x: 0,
          y: y - ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT / 2,
          width: chartWidth,
          height: ORDER_LINE_LAYOUT.LINE_HIT_HEIGHT,
          order,
        });

        closeButtonsRef.current.push({
          orderId: hoveredOrderId,
          x: closeButtonRef.x,
          y: closeButtonRef.y,
          width: closeButtonRef.size,
          height: closeButtonRef.size,
        });

        ctx.restore();

        const entryPrice = getOrderPrice(order);

        if (order.stopLoss) {
          const stopY = manager.priceToY(order.stopLoss);
          const slIsProfit = isSLInProfitZone(isLong, entryPrice, order.stopLoss);
          const slLossColor = ORDER_LINE_COLORS.SL_LOSS_LINE;

          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossColor;

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

          drawInfoTag(ctx, slInfoText, stopY, slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL, true, null);
          ctx.restore();
        }

        if (order.takeProfit) {
          const tpY = manager.priceToY(order.takeProfit);

          ctx.save();
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
          const tpInfoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%) [PENDING]`;

          drawInfoTag(ctx, tpInfoText, tpY, ORDER_LINE_COLORS.TP_FILL, true, null);
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
          leverage: hPos.leverage,
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
        drawPriceTag(ctx, priceText, y, chartWidth, fillColor, PRICE_TAG_WIDTH);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
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

        const hPosLoading = hPos.orderIds.some((id: string) => isOrderLoading(id));
        if (hPosLoading) needsAnimation = true;
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef, hasAutoTrade ? 'bot' : null, hPosLoading, now);

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

        const percentBadgeWidth = ctx.measureText(percentText).width + 8;
        const buttonsX = badgeX + percentBadgeWidth + 6;
        const hasStopLoss = hPos.orders.some((o: Order) => o.stopLoss);
        const hasTakeProfit = hPos.orders.some((o: Order) => o.takeProfit);

        if (!hasStopLoss || !hasTakeProfit) {
          const { slButton, tpButton } = drawSlTpButtons(ctx, buttonsX, y, hasStopLoss, hasTakeProfit);
          const primaryOrderId = hPos.orderIds[0] || '';
          if (slButton) {
            slTpButtonHitboxesRef.current.push({
              executionId: primaryOrderId,
              type: 'stopLoss',
              x: slButton.x,
              y: slButton.y,
              width: SLTP_BUTTON.WIDTH,
              height: SLTP_BUTTON.HEIGHT,
            });
          }
          if (tpButton) {
            slTpButtonHitboxesRef.current.push({
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
      }
    }

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
        const slLossColor = ORDER_LINE_COLORS.SL_LOSS_LINE;
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossColor;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_FILL : ORDER_LINE_COLORS.SL_LOSS_FILL;

        const firstOrderId = position.orderIds[0] || '';

        ctx.save();
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
        const slResultPercent = (isLongPosition
          ? ((consolidatedStopLoss - position.avgPrice) / position.avgPrice) * 100
          : ((position.avgPrice - consolidatedStopLoss) / position.avgPrice) * 100) * position.leverage;
        const slSign = slResultPercent >= 0 ? '+' : '';
        const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
        const infoText = `SL (${slSign}${slResultPercent.toFixed(2)}%)${pendingLabel}`;

        const slFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, getFlashAlpha(`${id}-sl`)), 0);
        priceTags.push({ priceText, y: stopY, fillColor: slTagColor, flashAlpha: slFlash });

        const tagStartX = chartWidth;
        ctx.strokeStyle = slLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(tagStartX, stopY);
        ctx.stroke();

        const slConsLoading = position.orderIds.some((id: string) => isOrderLoading(id));
        if (slConsLoading) needsAnimation = true;
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const slTagSize = drawInfoTag(ctx, infoText, stopY, slTagColor, true, closeButtonRef, null, slConsLoading, now);
        drawInfoTagFlash(ctx, slTagSize, stopY, slFlash);

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

        if (slFlash > 0) {
          ctx.save();
          ctx.globalAlpha = slFlash;
          ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, stopY);
          ctx.lineTo(chartWidth, stopY);
          ctx.stroke();
          ctx.restore();
        }
      }

      const anyOrderHasTakeProfit = takeProfitOrders.length > 0;
      if (anyOrderHasTakeProfit && consolidatedTakeProfit) {
        const tpY = manager.priceToY(consolidatedTakeProfit);

        const firstOrderId = position.orderIds[0] || '';

        ctx.save();
        ctx.lineWidth = 1;
        const tpLineColor = ORDER_LINE_COLORS.TP_LINE;
        ctx.strokeStyle = tpLineColor;

        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const tpFillColor = ORDER_LINE_COLORS.TP_FILL;
        const priceText = formatChartPrice(consolidatedTakeProfit);
        const tpProfitPercent = (isLongPosition
          ? ((consolidatedTakeProfit - position.avgPrice) / position.avgPrice) * 100
          : ((position.avgPrice - consolidatedTakeProfit) / position.avgPrice) * 100) * position.leverage;
        const pendingLabel = isPendingPosition ? ' [PENDING]' : '';
        const infoText = `TP (${tpProfitPercent >= 0 ? '+' : ''}${tpProfitPercent.toFixed(2)}%)${pendingLabel}`;

        const tpFlash = position.orderIds.reduce((max: number, id: string) => Math.max(max, getFlashAlpha(`${id}-tp`)), 0);
        priceTags.push({ priceText, y: tpY, fillColor: tpFillColor, flashAlpha: tpFlash });

        const tagStartX = chartWidth;
        ctx.strokeStyle = tpLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(tagStartX, tpY);
        ctx.stroke();

        const tpConsLoading = position.orderIds.some((id: string) => isOrderLoading(id));
        if (tpConsLoading) needsAnimation = true;
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        const tpTagSize = drawInfoTag(ctx, infoText, tpY, tpFillColor, true, closeButtonRef, null, tpConsLoading, now);
        drawInfoTagFlash(ctx, tpTagSize, tpY, tpFlash);

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

        if (tpFlash > 0) {
          ctx.save();
          ctx.globalAlpha = tpFlash;
          ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();
          ctx.restore();
        }
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
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const lineColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_LINE : ORDER_LINE_COLORS.PENDING_SHORT_LINE;
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

      drawInfoTag(ctx, infoText, entryY, fillColor, false, null, 'bot');

      if (setup.stopLoss) {
        const slY = manager.priceToY(setup.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
        const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SETUP_PROFIT_LINE : ORDER_LINE_COLORS.SETUP_LOSS_LINE;
        const slLossSetupColor = ORDER_LINE_COLORS.SL_LOSS_LINE;
        const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossSetupColor;

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
        drawInfoTag(ctx, slInfoText, slY, slTagColor, false, null, null);
      }

      if (setup.takeProfit) {
        const tpY = manager.priceToY(setup.takeProfit);
        ctx.strokeStyle = ORDER_LINE_COLORS.SETUP_PROFIT_LINE;
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();

        const tpPriceText = formatChartPrice(setup.takeProfit);
        const tpPercent = isLong
          ? ((setup.takeProfit - effectiveEntryPrice) / effectiveEntryPrice) * 100
          : ((effectiveEntryPrice - setup.takeProfit) / effectiveEntryPrice) * 100;
        const tpInfoText = `TP (${tpPercent >= 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`;

        const tpSetupFillColor = ORDER_LINE_COLORS.TP_FILL;
        priceTags.push({ priceText: tpPriceText, y: tpY, fillColor: tpSetupFillColor });
        drawInfoTag(ctx, tpInfoText, tpY, tpSetupFillColor, false, null, null);
      }

      ctx.restore();
    });

    ctx.restore();

    if (trailingStopConfig?.enabled) {
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

        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const tsCloseBtn = { x: 0, y: 0, size: 14 };
        drawInfoTag(ctx, tsLabel, tsY, ORDER_LINE_COLORS.TRAILING_STOP_FILL, true, tsCloseBtn, 'shield');
        tsCloseButtonsRef.current.push(tsCloseBtn);

        const tsPriceText = formatChartPrice(activationPrice);
        priceTags.push({ priceText: tsPriceText, y: tsY, fillColor: ORDER_LINE_COLORS.TRAILING_STOP_FILL });

        ctx.restore();
      }
    }

    priceTags.forEach(({ priceText, y, fillColor, flashAlpha: tagFlash }) => {
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
        needsAnimation = true;
      }
    });

    if (orderLoadingMapRef?.current) {
      for (const loading of orderLoadingMapRef.current.values()) {
        if (loading) { needsAnimation = true; break; }
      }
    }

    return needsAnimation;
  };

  const getClickedOrderId = (x: number, y: number): string | null => {
    for (const btn of tsCloseButtonsRef.current) {
      if (x >= btn.x && x <= btn.x + btn.size && y >= btn.y && y <= btn.y + btn.size) return 'ts-disable';
    }

    for (const button of sltpCloseButtonsRef.current) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
      ) {
        return `sltp:${button.type}:${button.orderIds.join(',')}`;
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

  const getSlTpButtonAtPosition = (x: number, y: number): { executionId: string; type: 'stopLoss' | 'takeProfit' } | null => {
    for (const hitbox of slTpButtonHitboxesRef.current) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return { executionId: hitbox.executionId, type: hitbox.type };
      }
    }
    return null;
  };

  return { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition };
};
