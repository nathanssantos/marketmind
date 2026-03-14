import type { Order } from '@marketmind/types';
import type { DirtyFlags } from '@renderer/utils/canvas/CanvasManager';
import { getOrderId, getOrderPrice, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface OrderDragConfig {
  orders: Order[];
  updateOrder: (id: string, updates: Partial<Order>) => void;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  enabled: boolean;
  slDragEnabled?: boolean;
  tpDragEnabled?: boolean;
  slTightenOnly?: boolean;
  getOrderAtPosition: (x: number, y: number) => Order | null;
  markDirty?: (layer: keyof DirtyFlags) => void;
  draggedOrderIdRef?: RefObject<string | null>;
}

export type DragType = 'entry' | 'stopLoss' | 'takeProfit';

export const useOrderDragHandler = (config: OrderDragConfig) => {
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragType, setDragType] = useState<DragType | null>(null);
  const previewPriceRef = useRef<number | null>(null);
  const initialSlPriceRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggedOrderIdRef = config.draggedOrderIdRef ?? { current: null };

  const handleSLTPMouseDown = useCallback(
    (
      _x: number,
      y: number,
      sltpInfo: { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number }
    ): boolean => {
      if (!config.enabled) return false;
      // Consume click even when disabled — prevents fallthrough to entry drag
      if (sltpInfo.type === 'stopLoss' && config.slDragEnabled === false) return true;
      if (sltpInfo.type === 'takeProfit' && config.tpDragEnabled === false) return true;

      const order = config.orders.find((o) => getOrderId(o) === sltpInfo.orderId);
      if (!order || !isOrderActive(order)) return false;

      draggedOrderIdRef.current = getOrderId(order);
      setDraggedOrder(order);
      setDragType(sltpInfo.type);
      previewPriceRef.current = config.yToPrice(y);
      if (sltpInfo.type === 'stopLoss') initialSlPriceRef.current = sltpInfo.price;
      config.markDirty?.('overlays');
      return true;
    },
    [config]
  );

  const handleMouseDown = useCallback(
    (x: number, y: number): boolean => {
      if (!config.enabled) return false;

      const order = config.getOrderAtPosition(x, y);
      if (!order) return false;

      if (isOrderPending(order)) {
        draggedOrderIdRef.current = getOrderId(order);
        setDraggedOrder(order);
        setDragType('entry');
        config.markDirty?.('overlays');
        return true;
      }

      return false;
    },
    [config]
  );

  const handleMouseMove = useCallback(
    (y: number): void => {
      if (!draggedOrder) return;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const currentPrice = config.yToPrice(y);

        if (dragType === 'entry' && isOrderPending(draggedOrder)) {
          previewPriceRef.current = currentPrice;
          config.markDirty?.('overlays');
          return;
        }

        if (dragType === 'stopLoss' || dragType === 'takeProfit') {
          let finalPrice = currentPrice;
          if (dragType === 'stopLoss' && config.slTightenOnly && initialSlPriceRef.current !== null) {
            const initialSl = initialSlPriceRef.current;
            finalPrice = isOrderLong(draggedOrder)
              ? Math.max(currentPrice, initialSl)
              : Math.min(currentPrice, initialSl);
          }
          previewPriceRef.current = finalPrice;
          config.markDirty?.('overlays');
          return;
        }

      });
    },
    [draggedOrder, dragType, config]
  );

  const handleMouseUp = useCallback((): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const previewPrice = previewPriceRef.current;

    const clearDragState = () => {
      draggedOrderIdRef.current = null;
      setDraggedOrder(null);
      setDragType(null);
      previewPriceRef.current = null;
      initialSlPriceRef.current = null;
    };

    if (!draggedOrder || !dragType) {
      clearDragState();
      return;
    }

    if (!previewPrice) {
      clearDragState();
      return;
    }

    if (dragType === 'entry' && isOrderPending(draggedOrder)) {
      config.updateOrder(getOrderId(draggedOrder), {
        entryPrice: previewPrice,
      });

      clearDragState();
      return;
    }

    if (dragType === 'stopLoss' || dragType === 'takeProfit') {
      const entryPrice = getOrderPrice(draggedOrder);
      const isLong = isOrderLong(draggedOrder);
      const isValidSl = dragType === 'stopLoss';
      const isValidTp = dragType === 'takeProfit' && (isLong ? previewPrice > entryPrice : previewPrice < entryPrice);

      if (!isValidSl && !isValidTp) {
        clearDragState();
        return;
      }

      if (dragType === 'stopLoss' && config.slTightenOnly && initialSlPriceRef.current !== null) {
        const initialSl = initialSlPriceRef.current;
        const isTighter = isLong ? previewPrice >= initialSl : previewPrice <= initialSl;
        if (!isTighter) {
          clearDragState();
          return;
        }
      }

      const relatedOrders = config.orders.filter(
        (order) =>
          order.symbol === draggedOrder.symbol &&
          isOrderLong(order) === isOrderLong(draggedOrder) &&
          isOrderActive(order)
      );

      relatedOrders.forEach((order) => {
        config.updateOrder(getOrderId(order), {
          [dragType]: previewPrice,
        });
      });
    }

    clearDragState();
  }, [draggedOrder, dragType, config]);

  const cancelDrag = useCallback((): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    draggedOrderIdRef.current = null;
    setDraggedOrder(null);
    setDragType(null);
    previewPriceRef.current = null;
    initialSlPriceRef.current = null;
    config.markDirty?.('overlays');
  }, [config]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
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
    previewPrice: previewPriceRef.current,
    getPreviewPrice: () => previewPriceRef.current,
  };
};
