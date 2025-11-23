import type { Order, OrderStatus } from '@shared/types/trading';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTradingStore } from '../store/tradingStore';
import { useNotification } from './useNotification';
import { useToast } from './useToast';

export const useOrderNotifications = () => {
  const { t } = useTranslation();
  const { success, info, warning } = useToast();
  const { showNotification, isSupported } = useNotification();
  const orders = useTradingStore((state) => state.orders);
  
  const orderStatusMap = useMemo(
    () => new Map(orders.map(o => [o.id, { status: o.status, order: o }])),
    [orders]
  );
  
  const prevOrdersRef = useRef<Map<string, { status: OrderStatus; order: Order }>>(new Map());

  useEffect(() => {
    const prevOrders = prevOrdersRef.current;

    if (prevOrders.size === 0) {
      prevOrdersRef.current = orderStatusMap;
      return;
    }

    orderStatusMap.forEach((current, orderId) => {
      const prev = prevOrders.get(orderId);

      if (!prev) return;

      if (prev.status !== current.status) {
        handleStatusChange(current.order, prev.status, current.status);
      }
    });

    prevOrdersRef.current = orderStatusMap;
  }, [orderStatusMap, t, success, info, warning]);

  const handleStatusChange = (order: Order, oldStatus: OrderStatus, newStatus: OrderStatus) => {
    const orderLabel = `${order.symbol} ${t(`trading.ticket.${order.type}`)}`;
    const orderType = order.type === 'long' ? t('trading.order.long') : t('trading.order.short');

    switch (newStatus) {
      case 'active':
        if (oldStatus === 'pending') {
          const toastTitle = t('trading.notifications.orderFilled.title');
          const toastBody = t('trading.notifications.orderFilled.body', { 
            type: orderType,
            symbol: order.symbol,
            quantity: order.quantity,
            price: order.entryPrice.toFixed(2)
          });
          
          success(toastTitle, toastBody);
          
          if (isSupported) {
            showNotification({
              title: toastTitle,
              body: toastBody,
              urgency: 'normal',
            });
          }
        }
        break;

      case 'closed':
        const pnl = order.pnl ?? 0;
        const isProfitable = pnl >= 0;
        const pnlSign = pnl >= 0 ? '+' : '';
        
        const closedTitle = isProfitable
          ? t('trading.notifications.orderClosed.titleProfit')
          : t('trading.notifications.orderClosed.titleLoss');
        
        const closedBody = t('trading.notifications.orderClosed.body', {
          type: orderType,
          symbol: order.symbol,
          quantity: order.quantity,
          pnl: `${pnlSign}$${Math.abs(pnl).toFixed(2)}`
        });
        
        success(closedTitle, closedBody);
        
        if (isSupported) {
          showNotification({
            title: closedTitle,
            body: closedBody,
            urgency: isProfitable ? 'normal' : 'low',
          });
        }
        break;

      case 'cancelled':
        const cancelledTitle = t('trading.notifications.orderCancelled');
        const cancelledBody = t('trading.notifications.orderCancelledDesc', { order: orderLabel });
        
        warning(cancelledTitle, cancelledBody);
        
        if (isSupported) {
          showNotification({
            title: cancelledTitle,
            body: cancelledBody,
            urgency: 'low',
          });
        }
        break;

      case 'expired':
        const expiredTitle = t('trading.notifications.orderExpired');
        const expiredBody = t('trading.notifications.orderExpiredDesc', { order: orderLabel });
        
        info(expiredTitle, expiredBody);
        
        if (isSupported) {
          showNotification({
            title: expiredTitle,
            body: expiredBody,
            urgency: 'low',
          });
        }
        break;

      default:
        break;
    }
  };

  return null;
};
