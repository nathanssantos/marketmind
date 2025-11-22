import type { Order, OrderStatus } from '@shared/types/trading';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTradingStore } from '../store/tradingStore';
import { useToast } from './useToast';

export const useOrderNotifications = () => {
  const { t } = useTranslation();
  const { success, info, warning } = useToast();
  const orders = useTradingStore((state) => state.orders);
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    const prevOrders = prevOrdersRef.current;

    if (prevOrders.length === 0) {
      prevOrdersRef.current = [...orders];
      return;
    }

    orders.forEach((currentOrder) => {
      const prevOrder = prevOrders.find((o) => o.id === currentOrder.id);

      if (!prevOrder) return;

      if (prevOrder.status !== currentOrder.status) {
        handleStatusChange(currentOrder, prevOrder.status, currentOrder.status);
      }
    });

    prevOrdersRef.current = [...orders];
  }, [orders, t, success, info, warning]);

  const handleStatusChange = (order: Order, oldStatus: OrderStatus, newStatus: OrderStatus) => {
    const orderLabel = `${order.symbol} ${t(`trading.ticket.${order.type}`)}`;

    switch (newStatus) {
      case 'active':
        if (oldStatus === 'pending') {
          success(
            t('trading.notifications.orderFilled'),
            t('trading.notifications.orderFilledDesc', { 
              order: orderLabel,
              price: order.entryPrice.toFixed(2)
            })
          );
        }
        break;

      case 'closed':
        const pnlColor = (order.pnl ?? 0) >= 0 ? 'profit' : 'loss';
        const pnlSign = (order.pnl ?? 0) >= 0 ? '+' : '';
        success(
          t('trading.notifications.orderClosed'),
          t(`trading.notifications.orderClosed${pnlColor === 'profit' ? 'Profit' : 'Loss'}`, {
            order: orderLabel,
            pnl: `${pnlSign}${order.pnl?.toFixed(2) ?? '0.00'}`,
            percent: `${pnlSign}${order.pnlPercent?.toFixed(2) ?? '0.00'}`
          })
        );
        break;

      case 'cancelled':
        warning(
          t('trading.notifications.orderCancelled'),
          t('trading.notifications.orderCancelledDesc', { order: orderLabel })
        );
        break;

      case 'expired':
        info(
          t('trading.notifications.orderExpired'),
          t('trading.notifications.orderExpiredDesc', { order: orderLabel })
        );
        break;

      default:
        break;
    }
  };

  return null;
};
