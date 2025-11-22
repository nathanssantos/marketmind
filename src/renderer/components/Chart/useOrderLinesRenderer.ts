import { useTradingStore } from '@renderer/store/tradingStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { Order } from '@shared/types/trading';
import { useRef } from 'react';

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

export const useOrderLinesRenderer = (manager: CanvasManager | null, isSimulatorActive: boolean, hoveredOrderId: string | null = null) => {
  const orders = useTradingStore((state) => state.orders);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const closeButtonsRef = useRef<OrderCloseButton[]>([]);
  const orderHitboxesRef = useRef<OrderHitbox[]>([]);
  const sltpHitboxesRef = useRef<SLTPHitbox[]>([]);
  const sltpCloseButtonsRef = useRef<SLTPCloseButton[]>([]);

  const renderOrderLines = (): void => {
    if (!manager || !isSimulatorActive) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const candles = manager.getCandles();
    if (!ctx || !dimensions || !candles.length) return;

    const { chartWidth } = dimensions;
    const currentPrice = candles[candles.length - 1]?.close;
    if (!currentPrice) return;

    const activeOrders = orders.filter(
      (order) => 
        order.walletId === activeWalletId && 
        (order.status === 'active' || order.status === 'pending')
    );

    closeButtonsRef.current = [];
    orderHitboxesRef.current = [];
    sltpHitboxesRef.current = [];
    sltpCloseButtonsRef.current = [];

    const pendingOrders = activeOrders.filter((order) => order.status === 'pending');
    const activeOrdersList = activeOrders.filter((order) => order.status === 'active');

    const pendingOrdersToRender = hoveredOrderId 
      ? pendingOrders.filter(o => o.id !== hoveredOrderId)
      : pendingOrders;
    const hoveredPendingOrder = hoveredOrderId 
      ? pendingOrders.find(o => o.id === hoveredOrderId)
      : null;

    const groupedPositions = new Map<string, {
      symbol: string;
      type: 'long' | 'short';
      avgPrice: number;
      totalQuantity: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    }>();

    activeOrdersList.forEach((order) => {
      const key = `${order.symbol}-${order.type}`;
      const existing = groupedPositions.get(key);

      if (existing) {
        const totalQty = existing.totalQuantity + order.quantity;
        const avgPrice = 
          (existing.avgPrice * existing.totalQuantity + order.entryPrice * order.quantity) / totalQty;
        
        const orderPnL = order.type === 'long'
          ? (currentPrice - order.entryPrice) * order.quantity
          : (order.entryPrice - currentPrice) * order.quantity;
        
        existing.avgPrice = avgPrice;
        existing.totalQuantity = totalQty;
        existing.totalPnL += orderPnL;
        existing.orderIds.push(order.id);
        existing.orders.push(order);
      } else {
        const orderPnL = order.type === 'long'
          ? (currentPrice - order.entryPrice) * order.quantity
          : (order.entryPrice - currentPrice) * order.quantity;

        groupedPositions.set(key, {
          symbol: order.symbol,
          type: order.type,
          avgPrice: order.entryPrice,
          totalQuantity: order.quantity,
          orderIds: [order.id],
          orders: [order],
          totalPnL: orderPnL,
        });
      }
    });

    pendingOrdersToRender.forEach((order) => {
      const y = manager.priceToY(order.entryPrice);
      const isLong = order.type === 'long';
      
      orderHitboxesRef.current.push({
        orderId: order.id,
        y,
        tolerance: 8,
        order,
      });

      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      ctx.fillStyle = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const typeLabel = order.type === 'long' ? 'L' : 'S';
      const baseLabel = `${typeLabel} ${order.entryPrice.toFixed(2)} (${order.quantity})`;
      const labelPadding = 8;
      const baseLabelWidth = ctx.measureText(baseLabel).width;
      
      const labelHeight = 18;
      const arrowWidth = 6;
      const closeButtonSize = 14;
      const closeButtonMargin = 4;
      const closeButtonX = labelPadding;
      const closeButtonSpacing = closeButtonSize + closeButtonMargin;
      const totalWidth = closeButtonSpacing + baseLabelWidth;
      const labelWidth = totalWidth + labelPadding * 2;
      const tagEndX = labelWidth + arrowWidth;
      
      ctx.beginPath();
      ctx.moveTo(tagEndX, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(labelWidth + arrowWidth, y);
      ctx.lineTo(labelWidth, y - labelHeight / 2);
      ctx.lineTo(0, y - labelHeight / 2);
      ctx.lineTo(0, y + labelHeight / 2);
      ctx.lineTo(labelWidth, y + labelHeight / 2);
      ctx.closePath();
      ctx.fill();
      
      const closeButtonY = y - closeButtonSize / 2;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(
        closeButtonX,
        closeButtonY,
        closeButtonSize,
        closeButtonSize,
        2
      );
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
      
      closeButtonsRef.current.push({
        orderId: order.id,
        x: closeButtonX,
        y: closeButtonY,
        width: closeButtonSize,
        height: closeButtonSize,
      });
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(baseLabel, labelPadding + closeButtonSpacing, y);
      
      ctx.restore();
    });

    type PositionData = {
      symbol: string;
      type: 'long' | 'short';
      avgPrice: number;
      totalQuantity: number;
      orderIds: string[];
      orders: Order[];
      totalPnL: number;
    };

    let hoveredPosition: PositionData | null = null;
    const positionsToRender: PositionData[] = [];
    const allPositions: PositionData[] = [];

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
      const y = manager.priceToY(position.avgPrice);
      const isLong = position.type === 'long';
      
      const positionData = {
        symbol: position.symbol,
        type: position.type,
        avgPrice: position.avgPrice,
        totalQuantity: position.totalQuantity,
        totalPnL: position.totalPnL,
        orders: position.orders,
      };

      const positionId = `position-${position.symbol}-${position.type}`;

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
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      ctx.fillStyle = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const isActive = true;
      let percentText = '';
      let percentWidth = 0;
      
      if (isActive) {
        const priceChange = currentPrice - position.avgPrice;
        const percentChange = isLong 
          ? (priceChange / position.avgPrice) * 100
          : (-priceChange / position.avgPrice) * 100;
        
        const percentSign = percentChange >= 0 ? '+' : '';
        percentText = `${percentSign}${percentChange.toFixed(2)}%`;
        percentWidth = ctx.measureText(percentText).width;
      }
      
      const typeLabel = position.type === 'long' ? 'L' : 'S';
      const quantityPrefix = position.orders.length > 1 
        ? `(${position.orders.length}x) ` 
        : '';
      const baseLabel = `${quantityPrefix}${typeLabel} ${position.avgPrice.toFixed(2)} (${position.totalQuantity})`;
      const labelPadding = 8;
      const baseLabelWidth = ctx.measureText(baseLabel).width;
      const percentPadding = 4;
      const spacing = isActive ? 6 : 0;
      
      const labelHeight = 18;
      const arrowWidth = 6;
      const closeButtonSize = 14;
      const closeButtonMargin = 4;
      const closeButtonX = labelPadding;
      const closeButtonSpacing = closeButtonSize + closeButtonMargin;
      const totalWidth = closeButtonSpacing + baseLabelWidth + (isActive ? spacing + percentWidth + percentPadding * 2 : 0);
      const labelWidth = totalWidth + labelPadding * 2;
      const tagEndX = labelWidth + arrowWidth;
      
      ctx.beginPath();
      ctx.moveTo(tagEndX, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(labelWidth + arrowWidth, y);
      ctx.lineTo(labelWidth, y - labelHeight / 2);
      ctx.lineTo(0, y - labelHeight / 2);
      ctx.lineTo(0, y + labelHeight / 2);
      ctx.lineTo(labelWidth, y + labelHeight / 2);
      ctx.closePath();
      ctx.fill();
      
      const closeButtonY = y - closeButtonSize / 2;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(
        closeButtonX,
        closeButtonY,
        closeButtonSize,
        closeButtonSize,
        2
      );
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
      
      position.orderIds.forEach((orderId) => {
        closeButtonsRef.current.push({
          orderId,
          x: closeButtonX,
          y: closeButtonY,
          width: closeButtonSize,
          height: closeButtonSize,
        });
      });
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(baseLabel, labelPadding + closeButtonSpacing, y);
      
      if (isActive) {
        const percentX = labelPadding + closeButtonSpacing + baseLabelWidth + spacing;
        const priceChange = currentPrice - position.avgPrice;
        const percentChange = isLong 
          ? (priceChange / position.avgPrice) * 100
          : (-priceChange / position.avgPrice) * 100;
        const percentBgColor = percentChange >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
        const percentHeight = 14;
        const percentY = y;
        const borderRadius = 3;
        
        ctx.fillStyle = percentBgColor;
        ctx.beginPath();
        ctx.roundRect(
          percentX,
          percentY - percentHeight / 2,
          percentWidth + percentPadding * 2,
          percentHeight,
          borderRadius
        );
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(percentText, percentX + percentPadding, percentY);
      }
      
      ctx.restore();
    });

    if (hoveredPendingOrder) {
      const order = hoveredPendingOrder;
      const y = manager.priceToY(order.entryPrice);
      const isLong = order.type === 'long';
      
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.fillStyle = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const typeLabel = order.type === 'long' ? 'L' : 'S';
      const baseLabel = `${typeLabel} ${order.entryPrice.toFixed(2)} (${order.quantity})`;
      const labelPadding = 8;
      const baseLabelWidth = ctx.measureText(baseLabel).width;
      
      const labelHeight = 18;
      const arrowWidth = 6;
      const closeButtonSize = 14;
      const closeButtonMargin = 4;
      const closeButtonX = labelPadding;
      const closeButtonSpacing = closeButtonSize + closeButtonMargin;
      const totalWidth = closeButtonSpacing + baseLabelWidth;
      const labelWidth = totalWidth + labelPadding * 2;
      
      ctx.beginPath();
      ctx.moveTo(labelWidth + arrowWidth, y);
      ctx.lineTo(labelWidth, y - labelHeight / 2);
      ctx.lineTo(0, y - labelHeight / 2);
      ctx.lineTo(0, y + labelHeight / 2);
      ctx.lineTo(labelWidth, y + labelHeight / 2);
      ctx.closePath();
      ctx.fill();
      
      const closeButtonY = y - closeButtonSize / 2;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(
        closeButtonX,
        closeButtonY,
        closeButtonSize,
        closeButtonSize,
        2
      );
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
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(baseLabel, labelPadding + closeButtonSpacing, y);
      
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
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      ctx.fillStyle = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const isActive = true;
      let percentText = '';
      let percentWidth = 0;
      
      if (isActive) {
        const priceChange = currentPrice - position.avgPrice;
        const percentChange = isLong 
          ? (priceChange / position.avgPrice) * 100
          : (-priceChange / position.avgPrice) * 100;
        
        const percentSign = percentChange >= 0 ? '+' : '';
        percentText = `${percentSign}${percentChange.toFixed(2)}%`;
        percentWidth = ctx.measureText(percentText).width;
      }
      
      const typeLabel = position.type === 'long' ? 'L' : 'S';
      const quantityPrefix = position.orders.length > 1 
        ? `(${position.orders.length}x) ` 
        : '';
      const baseLabel = `${quantityPrefix}${typeLabel} ${position.avgPrice.toFixed(2)} (${position.totalQuantity})`;
      const labelPadding = 8;
      const baseLabelWidth = ctx.measureText(baseLabel).width;
      const percentPadding = 4;
      const spacing = isActive ? 6 : 0;
      
      const labelHeight = 18;
      const arrowWidth = 6;
      const closeButtonSize = 14;
      const closeButtonMargin = 4;
      const closeButtonX = labelPadding;
      const closeButtonSpacing = closeButtonSize + closeButtonMargin;
      const totalWidth = closeButtonSpacing + baseLabelWidth + (isActive ? spacing + percentWidth + percentPadding * 2 : 0);
      const labelWidth = totalWidth + labelPadding * 2;
      const tagEndX = labelWidth + arrowWidth;
      
      ctx.beginPath();
      ctx.moveTo(tagEndX, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(labelWidth + arrowWidth, y);
      ctx.lineTo(labelWidth, y - labelHeight / 2);
      ctx.lineTo(0, y - labelHeight / 2);
      ctx.lineTo(0, y + labelHeight / 2);
      ctx.lineTo(labelWidth, y + labelHeight / 2);
      ctx.closePath();
      ctx.fill();
      
      const closeButtonY = y - closeButtonSize / 2;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(
        closeButtonX,
        closeButtonY,
        closeButtonSize,
        closeButtonSize,
        2
      );
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
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(baseLabel, labelPadding + closeButtonSpacing, y);
      
      if (isActive) {
        const percentX = labelPadding + closeButtonSpacing + baseLabelWidth + spacing;
        const priceChange = currentPrice - position.avgPrice;
        const percentChange = isLong 
          ? (priceChange / position.avgPrice) * 100
          : (-priceChange / position.avgPrice) * 100;
        const percentBgColor = percentChange >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
        const percentHeight = 14;
        const percentY = y;
        const borderRadius = 3;
        
        ctx.fillStyle = percentBgColor;
        ctx.beginPath();
        ctx.roundRect(
          percentX,
          percentY - percentHeight / 2,
          percentWidth + percentPadding * 2,
          percentHeight,
          borderRadius
        );
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(percentText, percentX + percentPadding, percentY);
      }
      
      ctx.restore();
    }

    allPositions.forEach((position) => {
      const labelPadding = 8;
      
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
            orderId: order.id,
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
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const slPercent = ((avgStopLoss - position.avgPrice) / position.avgPrice) * 100;
        const slLabel = `SL ${avgStopLoss.toFixed(2)} (${slPercent.toFixed(2)}%)`;
        const slWidth = ctx.measureText(slLabel).width;
        
        const closeButtonSize = 14;
        const closeButtonMargin = 4;
        const closeButtonSpacing = closeButtonSize + closeButtonMargin;
        const labelHeight = 18;
        const arrowWidth = 6;
        const totalWidth = closeButtonSpacing + slWidth + labelPadding * 2;
        const labelWidth = totalWidth;
        
        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, stopY);
        ctx.lineTo(labelWidth, stopY - labelHeight / 2);
        ctx.lineTo(0, stopY - labelHeight / 2);
        ctx.lineTo(0, stopY + labelHeight / 2);
        ctx.lineTo(labelWidth, stopY + labelHeight / 2);
        ctx.closePath();
        ctx.fill();
        
        const closeButtonX = labelPadding;
        const closeButtonY = stopY - closeButtonSize / 2;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect(
          closeButtonX,
          closeButtonY,
          closeButtonSize,
          closeButtonSize,
          2
        );
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
        
        sltpCloseButtonsRef.current.push({
          orderIds: position.orderIds,
          x: closeButtonX,
          y: closeButtonY,
          width: closeButtonSize,
          height: closeButtonSize,
          type: 'stopLoss',
        });
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(slLabel, labelPadding + closeButtonSpacing, stopY);
        
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
            orderId: order.id,
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
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const tpPercent = ((avgTakeProfit - position.avgPrice) / position.avgPrice) * 100;
        const tpLabel = `TP ${avgTakeProfit.toFixed(2)} (+${tpPercent.toFixed(2)}%)`;
        const tpWidth = ctx.measureText(tpLabel).width;
        
        const closeButtonSize = 14;
        const closeButtonMargin = 4;
        const closeButtonSpacing = closeButtonSize + closeButtonMargin;
        const labelHeight = 18;
        const arrowWidth = 6;
        const totalWidth = closeButtonSpacing + tpWidth + labelPadding * 2;
        const labelWidth = totalWidth;
        
        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, tpY);
        ctx.lineTo(labelWidth, tpY - labelHeight / 2);
        ctx.lineTo(0, tpY - labelHeight / 2);
        ctx.lineTo(0, tpY + labelHeight / 2);
        ctx.lineTo(labelWidth, tpY + labelHeight / 2);
        ctx.closePath();
        ctx.fill();
        
        const closeButtonX = labelPadding;
        const closeButtonY = tpY - closeButtonSize / 2;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect(
          closeButtonX,
          closeButtonY,
          closeButtonSize,
          closeButtonSize,
          2
        );
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
        
        sltpCloseButtonsRef.current.push({
          orderIds: position.orderIds,
          x: closeButtonX,
          y: closeButtonY,
          width: closeButtonSize,
          height: closeButtonSize,
          type: 'takeProfit',
        });
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tpLabel, labelPadding + closeButtonSpacing, tpY);
        
        ctx.restore();
      }
    });
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

  const getOrderAtPosition = (_x: number, y: number): import('@shared/types/trading').Order | null => {
    if (!manager || !isSimulatorActive) return null;

    const activeOrders = orders.filter(
      (order) => 
        order.walletId === activeWalletId && 
        (order.status === 'active' || order.status === 'pending')
    );

    const tolerance = 8;

    for (const order of activeOrders) {
      const orderY = manager.priceToY(order.entryPrice);
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
