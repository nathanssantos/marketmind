import type { OrderStatus, WalletCurrency } from '@marketmind/types';

export const getStatusColor = (status: OrderStatus): string => {
  const colors: Record<OrderStatus, string> = {
    NEW: 'orange',
    PARTIALLY_FILLED: 'green',
    FILLED: 'blue',
    CANCELED: 'red',
    PENDING_CANCEL: 'orange',
    REJECTED: 'red',
    EXPIRED: 'gray',
    EXPIRED_IN_MATCH: 'gray',
    PENDING_NEW: 'orange',
  };
  return colors[status];
};

export const getStatusTranslationKey = (status: OrderStatus): string => {
  const statusMap: Record<OrderStatus, string> = {
    NEW: 'statusPending',
    PENDING_NEW: 'statusPending',
    PARTIALLY_FILLED: 'statusActive',
    FILLED: 'statusFilled',
    CANCELED: 'statusCancelled',
    PENDING_CANCEL: 'statusCancelled',
    REJECTED: 'statusCancelled',
    EXPIRED: 'statusExpired',
    EXPIRED_IN_MATCH: 'statusExpired',
  };
  return statusMap[status] || 'statusPending';
};

export const formatDate = (date: Date | number | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatPrice = (price: number | undefined, currency: WalletCurrency): string => {
  if (price === undefined) return '-';
  return `${currency} ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
