import { useTradingStore } from '@renderer/store/tradingStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import type { Order } from '@marketmind/types';
import {
    getKlineClose,
    getOrderId,
    getOrderPrice,
    getOrderQuantity,
    isOrderActive,
    isOrderLong,
    isOrderPending,
} from '@shared/utils';
import { useMemo, useRef } from 'react';

interface OrderCloseButton {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OrderHitbox {
  orderId: string;
  y: number;
  tolerance: number;
  order: Order;
}

interface SLTPHitbox {
  orderId: string;
  y: number;
  tolerance: number;
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

const drawPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  y: number,
  chartWidth: number,
  fillColor: string,
  arrowDirection: 'left' | 'right' = 'left',
  customX?: number
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;
  const fixedTagWidth = CHART_CONFIG.CHART_RIGHT_MARGIN;
  
  ctx.save();
  ctx.fillStyle = fillColor;
  
  if (arrowDirection === 'left') {
    const x = customX !== undefined ? customX : chartWidth - fixedTagWidth;
    const endX = customX !== undefined ? customX + CHART_CONFIG.CHART_RIGHT_MARGIN : chartWidth;
    ctx.beginPath();
    ctx.moveTo(x - arrowWidth, y);
    ctx.lineTo(x, y - labelHeight / 2);
    ctx.lineTo(endX, y - labelHeight / 2);
    ctx.lineTo(endX, y + labelHeight / 2);
    ctx.lineTo(x, y + labelHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(priceText, x + labelPadding, y);
  } else {
    ctx.beginPath();
    ctx.moveTo(fixedTagWidth + arrowWidth, y);
    ctx.lineTo(fixedTagWidth, y - labelHeight / 2);
    ctx.lineTo(0, y - labelHeight / 2);
    ctx.lineTo(0, y + labelHeight / 2);
    ctx.lineTo(fixedTagWidth, y + labelHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(priceText, labelPadding, y);
  }
  
  ctx.restore();
  return { width: fixedTagWidth + arrowWidth, height: labelHeight };
};

const drawInfoTag = (
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  fillColor: string,
  hasCloseButton: boolean = false,
  closeButtonRef?: { x: number; y: number; size: number } | null
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;
  const closeButtonSize = 14;
  const closeButtonMargin = 4;
  
  const textWidth = ctx.measureText(text).width;
  const closeButtonSpace = hasCloseButton ? closeButtonSize + closeButtonMargin : 0;
  const totalContentWidth = closeButtonSpace + textWidth;
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
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize, 2);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
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
  
  ctx.fillStyle = '#ffffff';
  const textX = labelPadding + closeButtonSpace;
  ctx.fillText(text, textX, y);
  
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
  const bgColor = isPositive ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
  
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y - percentHeight / 2, badgeWidth, percentHeight, borderRadius);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText(percentText, x + percentPadding, y);
  
  ctx.restore();
  return { width: badgeWidth, height: percentHeight };
};

export const useOrderLinesRenderer = (manager: CanvasManager | null, isSimulatorActive: boolean, hoveredOrderId: string | null = null) => {
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const orders = useTradingStore((state) => state.orders);
  
  const activeOrders = useMemo(
    () => isSimulatorActive && activeWalletId
      ? orders.filter(o => o.walletId === activeWalletId && (isOrderActive(o) || isOrderPending(o)))
      : [],
    [orders, activeWalletId, isSimulatorActive]
  );
  
  const closeButtonsRef = useRef<OrderCloseButton[]>([]);
  const orderHitboxesRef = useRef<OrderHitbox[]>([]);
  const sltpHitboxesRef = useRef<SLTPHitbox[]>([]);
  const sltpCloseButtonsRef = useRef<SLTPCloseButton[]>([]);

  const renderOrderLines = (): void => {
    if (!manager || !isSimulatorActive || activeOrders.length === 0) return;

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

    const groupedPositions = new Map<string, {
      symbol: string;
      netQuantity: number;
      avgPrice: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    }>();

    activeOrdersList.forEach((order) => {
      const key = order.symbol;
      const existing = groupedPositions.get(key);
      const orderQuantity = isOrderLong(order) ? getOrderQuantity(order) : -getOrderQuantity(order);

      if (existing) {
        const newNetQty = existing.netQuantity + orderQuantity;
        const sameDirection = (existing.netQuantity > 0 && orderQuantity > 0) || (existing.netQuantity < 0 && orderQuantity < 0);
        
        let avgPrice = existing.avgPrice;
        
        if (sameDirection) {
          const entryPrice = getOrderPrice(order);
          const totalInvestment = Math.abs(existing.avgPrice * existing.netQuantity) + Math.abs(entryPrice * orderQuantity);
          avgPrice = totalInvestment / Math.abs(newNetQty || 1);
        }
        
        const entryPrice = getOrderPrice(order);
        const quantity = getOrderQuantity(order);
        const orderPnL = isOrderLong(order)
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
        const orderPnL = isOrderLong(order)
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
      const isLong = isOrderLong(order);
      
      orderHitboxesRef.current.push({
        orderId: getOrderId(order),
        y,
        tolerance: 8,
        order,
      });

      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const lineColor = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      const fillColor = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      
      const priceText = getOrderPrice(order).toFixed(2);
      priceTags.push({ priceText, y, fillColor });
      
      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();
      
      const typeLabel = isLong ? 'L' : 'S';
      const infoText = `${typeLabel} (${getOrderQuantity(order)})`;
      
      const closeButtonRef = { x: 0, y: 0, size: 14 };
      drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef);
      
      closeButtonsRef.current.push({
        orderId: getOrderId(order),
        x: closeButtonRef.x,
        y: closeButtonRef.y,
        width: closeButtonRef.size,
        height: closeButtonRef.size,
      });
      
      ctx.restore();
    });

    type GroupedPosition = {
      symbol: string;
      netQuantity: number;
      avgPrice: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    };

    type PositionData = {
      symbol: string;
      type: 'long' | 'short';
      avgPrice: number;
      totalQuantity: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    };

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
      
      const positionData = {
        symbol: position.symbol,
        type: isLong ? ('long' as const) : ('short' as const),
        avgPrice: position.avgPrice,
        totalQuantity: absQuantity,
        totalPnL: position.totalPnL,
        orders: position.orders,
      };

      const positionId = `position-${position.symbol}`;

      orderHitboxesRef.current.push({
        orderId: positionId,
        y,
        tolerance: 8,
        order: {
          ...position.orders[0],
          id: positionId,
          entryPrice: position.avgPrice,
          quantity: absQuantity,
          type: isLong ? 'long' : 'short',
          metadata: { isPosition: true, positionData },
        } as unknown as Order,
      });
      
      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const lineColor = isLong ? 'rgba(59, 130, 246, 0.8)' : 'rgba(251, 146, 60, 0.8)';
      const fillColor = isLong ? 'rgba(59, 130, 246, 0.9)' : 'rgba(251, 146, 60, 0.9)';
      
      const priceText = position.avgPrice.toFixed(2);
      priceTags.push({ priceText, y, fillColor });
      
      const tagStartX = chartWidth;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
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
      
      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef);
      
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
      const isLong = isOrderLong(order);
      
      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const lineColor = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      const fillColor = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      
      const priceText = getOrderPrice(order).toFixed(2);
      const tagStartX = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
      drawPriceTag(ctx, priceText, y, tagStartX, fillColor, 'left', tagStartX);
      
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tagStartX, y);
      ctx.stroke();
      
      const typeLabel = isLong ? 'L' : 'S';
      const infoText = `${typeLabel} (${getOrderQuantity(order)})`;
      
      const closeButtonRef = { x: 0, y: 0, size: 14 };
      drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef);
      
      closeButtonsRef.current.push({
        orderId: getOrderId(order),
        x: closeButtonRef.x,
        y: closeButtonRef.y,
        width: closeButtonRef.size,
        height: closeButtonRef.size,
      });
      
      ctx.restore();
    }

    if (hoveredPosition) {
      const position: PositionData = hoveredPosition;
      const y = manager.priceToY(position.avgPrice);
      const isLong = position.type === 'long';
      const positionId = `position-${position.symbol}-${position.type}`;
      
      const positionData = {
        symbol: position.symbol,
        type: position.type,
        avgPrice: position.avgPrice,
        totalQuantity: position.totalQuantity,
        totalPnL: position.totalPnL,
        orders: position.orders,
      };
      
      orderHitboxesRef.current.push({
        orderId: positionId,
        y,
        tolerance: 8,
        order: {
          ...position.orders[0],
          id: positionId,
          entryPrice: position.avgPrice,
          quantity: position.totalQuantity,
          metadata: { isPosition: true, positionData },
        } as Order,
      });

      ctx.save();
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const lineColor = isLong ? 'rgba(59, 130, 246, 0.8)' : 'rgba(251, 146, 60, 0.8)';
      const fillColor = isLong ? 'rgba(59, 130, 246, 0.9)' : 'rgba(251, 146, 60, 0.9)';
      
      const priceText = position.avgPrice.toFixed(2);
      const tagStartX = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
      drawPriceTag(ctx, priceText, y, tagStartX, fillColor, 'left', tagStartX);
      
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
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
      
      const typeLabel = position.type === 'long' ? 'L' : 'S';
      const quantityPrefix = position.orders.length > 1 
        ? `(${position.orders.length}x) ` 
        : '';
      const infoText = `${quantityPrefix}${typeLabel} (${position.totalQuantity})`;
      
      const closeButtonRef = { x: 0, y: 0, size: 14 };
      const infoTagSize = drawInfoTag(ctx, infoText, y, fillColor, true, closeButtonRef);
      
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
    }

    allPositions.forEach((position) => {
      const anyOrderHasStopLoss = position.orders.some(o => o.stopLoss);
      if (anyOrderHasStopLoss) {
        const stopLossOrders = position.orders.filter(o => o.stopLoss);
        const avgStopLoss = stopLossOrders.reduce((sum, o) => sum + (o.stopLoss || 0), 0) / stopLossOrders.length;
        const stopY = manager.priceToY(avgStopLoss);
        
        const firstOrderId = position.orderIds[0] || '';
        
        orderHitboxesRef.current.push({
          orderId: firstOrderId,
          y: stopY,
          tolerance: 8,
          order: {
            ...position.orders[0],
            entryPrice: avgStopLoss,
            stopLoss: avgStopLoss,
            metadata: { isSLTP: true, type: 'stopLoss' },
          } as Order,
        });
        
        position.orders.forEach((order) => {
          sltpHitboxesRef.current.push({
            orderId: getOrderId(order),
            y: stopY,
            tolerance: 8,
            type: 'stopLoss',
            price: avgStopLoss,
          });
        });
        
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(chartWidth, stopY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const fillColor = 'rgba(239, 68, 68, 0.9)';
        const slPercent = ((avgStopLoss - position.avgPrice) / position.avgPrice) * 100;
        const priceText = avgStopLoss.toFixed(2);
        const infoText = `SL (${slPercent.toFixed(2)}%)`;
        
        priceTags.push({ priceText, y: stopY, fillColor });
        
        const tagStartX = chartWidth;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(tagStartX, stopY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        drawInfoTag(ctx, infoText, stopY, fillColor, true, closeButtonRef);
        
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

      const anyOrderHasTakeProfit = position.orders.some(o => o.takeProfit);
      if (anyOrderHasTakeProfit) {
        const takeProfitOrders = position.orders.filter(o => o.takeProfit);
        const avgTakeProfit = takeProfitOrders.reduce((sum, o) => sum + (o.takeProfit || 0), 0) / takeProfitOrders.length;
        const tpY = manager.priceToY(avgTakeProfit);
        
        const firstOrderId = position.orderIds[0] || '';
        
        orderHitboxesRef.current.push({
          orderId: firstOrderId,
          y: tpY,
          tolerance: 8,
          order: {
            ...position.orders[0],
            entryPrice: avgTakeProfit,
            takeProfit: avgTakeProfit,
            metadata: { isSLTP: true, type: 'takeProfit' },
          } as Order,
        });
        
        position.orders.forEach((order) => {
          sltpHitboxesRef.current.push({
            orderId: getOrderId(order),
            y: tpY,
            tolerance: 8,
            type: 'takeProfit',
            price: avgTakeProfit,
          });
        });
        
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(chartWidth, tpY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const fillColor = 'rgba(34, 197, 94, 0.9)';
        const tpPercent = ((avgTakeProfit - position.avgPrice) / position.avgPrice) * 100;
        const priceText = avgTakeProfit.toFixed(2);
        const infoText = `TP (+${tpPercent.toFixed(2)}%)`;
        
        priceTags.push({ priceText, y: tpY, fillColor });
        
        const tagStartX = chartWidth;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(tagStartX, tpY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        const closeButtonRef = { x: 0, y: 0, size: 14 };
        drawInfoTag(ctx, infoText, tpY, fillColor, true, closeButtonRef);
        
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
    
    ctx.restore();
    
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    priceTags.forEach(({ priceText, y, fillColor }) => {
      const tagStartX = width - CHART_CONFIG.CHART_RIGHT_MARGIN;
      drawPriceTag(ctx, priceText, y, width, fillColor, 'left', tagStartX);
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

  const getOrderAtPosition = (_x: number, y: number): import('@marketmind/types').Order | null => {
    if (!manager || !isSimulatorActive) return null;

    const activeOrders = orders.filter(
      (order) => 
        order.walletId === activeWalletId && 
        (isOrderActive(order) || isOrderPending(order))
    );

    const tolerance = 8;

    for (const order of activeOrders) {
      const orderY = manager.priceToY(getOrderPrice(order));
      if (Math.abs(y - orderY) <= tolerance) {
        return order;
      }
    }

    return null;
  };

  const getHoveredOrder = (_x: number, y: number): Order | null => {
    let closestHitbox: OrderHitbox | null = null;
    let minDistance = Infinity;

    for (const hitbox of orderHitboxesRef.current) {
      const distance = Math.abs(y - hitbox.y);
      if (distance <= hitbox.tolerance && distance < minDistance) {
        minDistance = distance;
        closestHitbox = hitbox;
      }
    }

    return closestHitbox ? closestHitbox.order : null;
  };

  const getSLTPAtPosition = (_x: number, y: number): { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number } | null => {
    for (const hitbox of sltpHitboxesRef.current) {
      if (Math.abs(y - hitbox.y) <= hitbox.tolerance) {
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
