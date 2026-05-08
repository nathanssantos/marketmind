import type { OrderStatus } from '@marketmind/types';
import { useBackendTrading } from './useBackendTrading';
import { useBackendWallet } from './useBackendWallet';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIPref } from '../store/preferencesStore';
import { useNotification } from './useNotification';
import { useToast } from './useToast';

export const useOrderNotifications = () => {
  const { t } = useTranslation();
  const { success, info, warning } = useToast();
  const { showNotification, isSupported } = useNotification();
  const [orderToastsEnabled] = useUIPref<boolean>('orderToastsEnabled', true);

  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id;
  const { orders } = useBackendTrading(activeWalletId ?? '', undefined, 'FUTURES', { skipPrices: true });

  const orderStatusMap = useMemo(
    () => new Map(orders.map(o => [o.orderId.toString(), { status: o.status as OrderStatus, order: o }])),
    [orders]
  );

  const prevOrdersRef = useRef<Map<string, { status: OrderStatus; order: typeof orders[0] }>>(new Map());

  useEffect(() => {
    const prevOrders = prevOrdersRef.current;

    if (prevOrders.size === 0) {
      prevOrdersRef.current = orderStatusMap;
      return;
    }

    if (!orderToastsEnabled) {
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
  }, [orderStatusMap, orderToastsEnabled, t, success, info, warning]);

  const handleStatusChange = (order: typeof orders[0], oldStatus: OrderStatus, newStatus: OrderStatus) => {
    const isLong = order.side === 'BUY';
    const orderLabel = `${order.symbol} ${t(`trading.ticket.${isLong ? 'long' : 'short'}`)}`;
    const orderType = isLong ? t('trading.order.long') : t('trading.order.short');
    const meta = { symbol: order.symbol };

    const isActive = newStatus === 'FILLED' || newStatus === 'PARTIALLY_FILLED';
    const wasPending = oldStatus === 'NEW' || oldStatus === 'PENDING_NEW';

    if (isActive && wasPending) {
      const toastTitle = t('trading.notifications.orderFilled.title');
      const toastBody = t('trading.notifications.orderFilled.body', {
        type: orderType,
        symbol: order.symbol,
        quantity: parseFloat(order.origQty ?? '0'),
        price: parseFloat(order.price ?? '0').toFixed(2)
      });

      success(toastTitle, toastBody, meta);

      if (isSupported) {
        void showNotification({
          title: toastTitle,
          body: toastBody,
          urgency: 'normal',
        });
      }
      return;
    }

    if (newStatus === 'CANCELED') {
      const cancelledTitle = t('trading.notifications.orderCancelled');
      const cancelledBody = t('trading.notifications.orderCancelledDesc', { order: orderLabel });

      warning(cancelledTitle, cancelledBody, meta);

      if (isSupported) {
        void showNotification({
          title: cancelledTitle,
          body: cancelledBody,
          urgency: 'low',
        });
      }
      return;
    }

    if (newStatus === 'EXPIRED') {
      const expiredTitle = t('trading.notifications.orderExpired');
      const expiredBody = t('trading.notifications.orderExpiredDesc', { order: orderLabel });

      info(expiredTitle, expiredBody, meta);

      if (isSupported) {
        void showNotification({
          title: expiredTitle,
          body: expiredBody,
          urgency: 'low',
        });
      }
    }
  };

  return null;
};
