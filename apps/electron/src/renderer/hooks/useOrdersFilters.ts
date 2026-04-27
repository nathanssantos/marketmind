import type { Order } from '@marketmind/types';
import type { OrdersFilterOption, OrdersSortOption } from '@renderer/store/uiStore';
import { isOrderActive, isOrderPending } from '@shared/utils';
import { useMemo } from 'react';

export const filterOrders = (orders: Order[], filterStatus: OrdersFilterOption): Order[] => {
  return orders.filter((order) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return isOrderPending(order);
    if (filterStatus === 'active') return isOrderActive(order);
    if (filterStatus === 'filled') return order.status === 'FILLED';
    if (filterStatus === 'closed') return !!order.closedAt;
    if (filterStatus === 'cancelled') return order.status === 'CANCELED' || order.status === 'REJECTED';
    if (filterStatus === 'expired') return order.status === 'EXPIRED' || order.status === 'EXPIRED_IN_MATCH';
    return true;
  });
};

export const sortOrders = (orders: Order[], sortBy: OrdersSortOption): Order[] => {
  return [...orders].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return (b.updateTime || b.time) - (a.updateTime || a.time);
      case 'oldest':
        return (a.updateTime || a.time) - (b.updateTime || b.time);
      case 'symbol-asc':
        return a.symbol.localeCompare(b.symbol);
      case 'symbol-desc':
        return b.symbol.localeCompare(a.symbol);
      case 'quantity-desc':
        return (b.quantity ?? 0) - (a.quantity ?? 0);
      case 'quantity-asc':
        return (a.quantity ?? 0) - (b.quantity ?? 0);
      case 'pnl-desc': {
        const pnlA = parseFloat(String(a.pnl ?? 0));
        const pnlB = parseFloat(String(b.pnl ?? 0));
        return pnlB - pnlA;
      }
      case 'pnl-asc': {
        const pnlA = parseFloat(String(a.pnl ?? 0));
        const pnlB = parseFloat(String(b.pnl ?? 0));
        return pnlA - pnlB;
      }
      case 'price-desc':
        return (b.entryPrice ?? 0) - (a.entryPrice ?? 0);
      case 'price-asc':
        return (a.entryPrice ?? 0) - (b.entryPrice ?? 0);
      default:
        return (b.updateTime || b.time) - (a.updateTime || a.time);
    }
  });
};

export const useOrdersFilters = (
  orders: Order[],
  filterStatus: OrdersFilterOption,
  sortBy: OrdersSortOption,
): Order[] =>
  useMemo(() => sortOrders(filterOrders(orders, filterStatus), sortBy), [orders, filterStatus, sortBy]);
