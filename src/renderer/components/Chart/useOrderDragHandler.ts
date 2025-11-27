import type { Order } from '@shared/types/trading';
import { useCallback, useState } from 'react';

interface OrderDragConfig {
  orders: Order[];
  updateOrder: (id: string, updates: Partial<Order>) => void;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  enabled: boolean;
  getOrderAtPosition: (x: number, y: number) => Order | null;
  currentPrice: number;
}

export type DragType = 'entry' | 'stopLoss' | 'takeProfit';

export const useOrderDragHandler = (config: OrderDragConfig) => {
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragType, setDragType] = useState<DragType | null>(null);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  const handleSLTPMouseDown = useCallback(
    (
      _x: number,
      y: number,
      sltpInfo: { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number }
    ): boolean => {
      if (!config.enabled) return false;

      const order = config.orders.find((o) => o.id === sltpInfo.orderId);
      if (order?.status !== 'active') return false;

      setDraggedOrder(order);
      setDragType(sltpInfo.type);
      setPreviewPrice(config.yToPrice(y));
      return true;
    },
    [config]
  );

  const handleMouseDown = useCallback(
    (x: number, y: number): boolean => {
      if (!config.enabled) return false;

      const order = config.getOrderAtPosition(x, y);
      if (!order) return false;

      if (order.status === 'pending') {
        setDraggedOrder(order);
        setDragType('entry');
        return true;
      }

      if (order.status === 'active') {
        setDraggedOrder(order);
        setDragType(null);
        setPreviewPrice(null);
        return true;
      }

      return false;
    },
    [config]
  );

  const handleMouseMove = useCallback(
    (y: number): void => {
      if (!draggedOrder) return;

      const currentPrice = config.yToPrice(y);

      if (dragType === 'entry' && draggedOrder.status === 'pending') {
        setPreviewPrice(currentPrice);
        return;
      }

      if (draggedOrder.status === 'active') {
        const entryY = config.priceToY(draggedOrder.entryPrice);
        const currentY = y;
        
        const isMovingUp = currentY < entryY;
        
        const isCreatingTakeProfit =
          (draggedOrder.type === 'long' && isMovingUp) ||
          (draggedOrder.type === 'short' && !isMovingUp);

        setDragType(isCreatingTakeProfit ? 'takeProfit' : 'stopLoss');
        setPreviewPrice(currentPrice);
        return;
      }
    },
    [draggedOrder, dragType, config]
  );

  const handleMouseUp = useCallback((): void => {
    if (!draggedOrder || !dragType) {
      setDraggedOrder(null);
      setDragType(null);
      setPreviewPrice(null);
      return;
    }

    if (!previewPrice) {
      setDraggedOrder(null);
      setDragType(null);
      setPreviewPrice(null);
      return;
    }

    if (dragType === 'entry' && draggedOrder.status === 'pending') {
      config.updateOrder(draggedOrder.id, {
        entryPrice: previewPrice,
      });

      setDraggedOrder(null);
      setDragType(null);
      setPreviewPrice(null);
      return;
    }

    if (dragType === 'stopLoss' || dragType === 'takeProfit') {
      const relatedOrders = config.orders.filter(
        (order) =>
          order.symbol === draggedOrder.symbol &&
          order.type === draggedOrder.type &&
          order.status === 'active'
      );

      relatedOrders.forEach((order) => {
        config.updateOrder(order.id, {
          [dragType]: previewPrice,
        });
      });
    }

    setDraggedOrder(null);
    setDragType(null);
    setPreviewPrice(null);
  }, [draggedOrder, dragType, previewPrice, config]);

  const cancelDrag = useCallback((): void => {
    setDraggedOrder(null);
    setDragType(null);
    setPreviewPrice(null);
  }, []);

  return {
    handleMouseDown,
    handleSLTPMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancelDrag,
    isDragging: !!draggedOrder,
    draggedOrder,
    dragType,
    previewPrice,
  };
};
