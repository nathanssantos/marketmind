import { Box, Flex, Group, Stack, Text } from '@chakra-ui/react';
import { Button, IconButton, Select } from '@renderer/components/ui';
import { Field as ChakraField } from '@chakra-ui/react/field';
import type { Order, OrderSide, OrderStatus, OrderType, TimeInForce, WalletCurrency } from '@marketmind/types';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { trpc } from '@renderer/utils/trpc';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { useUIStore, type OrdersFilterOption, type OrdersSortOption } from '@renderer/store/uiStore';
import {
  getOrderId,
  isOrderActive,
  isOrderPending,
} from '@shared/utils';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@renderer/hooks/useToast';
import { BsGrid, BsTable } from 'react-icons/bs';
import { useShallow } from 'zustand/react/shallow';
import { OrderCard } from './OrderCard';
import { OrdersTableContent } from './OrdersTableContent';

const OrdersListComponent = () => {
  if (perfMonitor.isEnabled()) perfMonitor.recordComponentRender('OrdersList');
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const globalActions = useGlobalActionsOptional();

  const { activeWallet: rawActiveWallet, wallets: backendWallets } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;
  const {
    orders: backendOrdersData,
    tradeExecutions,
    cancelOrder: cancelBackendOrder,
    closeExecution,
    cancelExecution,
  } = useBackendTrading(activeWalletId || '', undefined);

  const { data: statsData } = trpc.trading.getOrdersStats.useQuery(
    { walletId: activeWalletId ?? '' },
    { enabled: !!activeWalletId }
  );

  const orders: Order[] = useMemo(() => {
    const ordersFromApi = backendOrdersData.map((o): Order => ({
      symbol: o.symbol,
      orderId: o.orderId,
      orderListId: '0',
      clientOrderId: '',
      price: o.price || '0',
      origQty: o.origQty || '0',
      executedQty: o.executedQty || '0',
      cummulativeQuoteQty: '0',
      status: (o.status || 'NEW') as OrderStatus,
      timeInForce: (o.timeInForce || 'GTC') as TimeInForce,
      type: (o.type || 'LIMIT') as OrderType,
      side: o.side as OrderSide,
      time: typeof o.time === 'number' ? o.time : Date.now(),
      updateTime: typeof o.updateTime === 'number' ? o.updateTime : Date.now(),
      isWorking: o.status === 'NEW' || o.status === 'PARTIALLY_FILLED',
      origQuoteOrderQty: '0',
      id: o.orderId,
      walletId: o.walletId,
      orderDirection: o.side === 'BUY' ? ('long' as const) : ('short' as const),
      entryPrice: parseFloat(o.price || '0'),
      quantity: parseFloat(o.origQty || '0'),
      createdAt: new Date(o.createdAt),
      marketType: o.marketType || 'FUTURES',
    }));

    const ordersFromExecutions = tradeExecutions.map((e): Order => ({
      symbol: e.symbol,
      orderId: '0',
      orderListId: '0',
      clientOrderId: e.id,
      price: e.entryPrice,
      origQty: e.quantity,
      executedQty: e.quantity,
      cummulativeQuoteQty: '0',
      status: e.status === 'open' ? 'FILLED' : e.status === 'closed' ? 'FILLED' : 'CANCELED',
      timeInForce: 'GTC',
      type: 'MARKET',
      side: e.side === 'LONG' ? 'BUY' : 'SELL',
      time: new Date(e.openedAt).getTime(),
      updateTime: new Date(e.openedAt).getTime(),
      isWorking: e.status === 'open',
      origQuoteOrderQty: '0',
      id: e.id,
      walletId: e.walletId,
      orderDirection: e.side === 'LONG' ? ('long' as const) : ('short' as const),
      entryPrice: parseFloat(e.entryPrice),
      quantity: parseFloat(e.quantity),
      createdAt: new Date(e.createdAt),
      stopLoss: e.stopLoss ? parseFloat(e.stopLoss) : undefined,
      takeProfit: e.takeProfit ? parseFloat(e.takeProfit) : undefined,
      pnl: e.pnl || undefined,
      pnlPercent: e.pnlPercent || undefined,
      closedAt: e.closedAt ? new Date(e.closedAt) : undefined,
      setupType: e.setupType || undefined,
      marketType: e.marketType || 'FUTURES',

      isAutoTrade: !!e.setupType,
    }));

    return [...ordersFromApi, ...ordersFromExecutions];
  }, [backendOrdersData, tradeExecutions]);

  const wallets = backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance || '0'),
    initialBalance: parseFloat(w.initialBalance || '0'),
    currency: (w.currency || 'USDT') as WalletCurrency,
    createdAt: new Date(w.createdAt),
    performance: [],
    makerCommission: 0,
    takerCommission: 0,
    buyerCommission: 0,
    sellerCommission: 0,
    commissionRates: { maker: '0', taker: '0', buyer: '0', seller: '0' },
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    brokered: false,
    requireSelfTradePrevention: false,
    preventSor: false,
    updateTime: Date.now(),
    accountType: 'SPOT' as const,
    balances: [],
    permissions: ['SPOT'],
  }));

  const cancelOrder = useCallback(async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order || !activeWalletId) return;
    try {
      if (order.isAutoTrade) {
        await cancelExecution(id);
      } else {
        await cancelBackendOrder({
          walletId: activeWalletId,
          symbol: order.symbol,
          orderId: order.orderId || '0',
        });
      }
      toastSuccess(t('trading.order.cancelSuccess'));
    } catch (error) {
      toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
    }
  }, [orders, activeWalletId, cancelExecution, cancelBackendOrder, toastSuccess, toastError, t]);

  const closeOrder = useCallback(async (id: string, price: number) => {
    const order = orders.find(o => o.id === id);
    if (!order?.isAutoTrade) return;
    try {
      await closeExecution(id, price.toString());
    } catch (error) {
      toastError(t('trading.order.closeFailed'), error instanceof Error ? error.message : undefined);
    }
  }, [orders, closeExecution, toastError, t]);

  const {
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    setOrdersDialogOpen,
  } = useUIStore(useShallow((s) => ({
    filterStatus: s.ordersFilterStatus,
    setFilterStatus: s.setOrdersFilterStatus,
    sortBy: s.ordersSortBy,
    setSortBy: s.setOrdersSortBy,
    viewMode: s.ordersViewMode,
    setViewMode: s.setOrdersViewMode,
    setOrdersDialogOpen: s.setOrdersDialogOpen,
  })));

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const walletOrders = activeWallet
    ? orders.filter((o) => o.walletId === activeWallet.id)
    : [];

  const filteredOrders = useMemo(() => {
    const filtered = walletOrders.filter((order) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'pending') return isOrderPending(order);
      if (filterStatus === 'active') return isOrderActive(order);
      if (filterStatus === 'filled') return order.status === 'FILLED';
      if (filterStatus === 'closed') return !!order.closedAt;
      if (filterStatus === 'cancelled') return order.status === 'CANCELED' || order.status === 'REJECTED';
      if (filterStatus === 'expired') return order.status === 'EXPIRED' || order.status === 'EXPIRED_IN_MATCH';
      return true;
    });

    return filtered.sort((a, b) => {
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
  }, [walletOrders, filterStatus, sortBy]);

  const activeOrders = walletOrders.filter((o) => isOrderActive(o)).length;
  const pendingOrders = walletOrders.filter((o) => isOrderPending(o)).length;
  const totalCount = (statsData?.ordersCount ?? 0) + (statsData?.executionsCount ?? 0);

  return (
    <Stack gap={3} p={4}>

      {!activeWallet ? (
        <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
          <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
            {t('trading.orders.noWallet')}
          </Text>
        </Box>
      ) : (
        <>
          <Box p={3} bg="bg.muted" borderRadius="md">
            <Stack gap={1} fontSize="xs">
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.orders.total')}</Text>
                <Text fontWeight="medium">{totalCount}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.orders.active')}</Text>
                <Text fontWeight="medium" color="green.500">{activeOrders}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.orders.pending')}</Text>
                <Text fontWeight="medium" color="orange.500">{pendingOrders}</Text>
              </Flex>
            </Stack>
          </Box>

          <Flex justify="flex-end">
            <Button size="xs" variant="ghost" onClick={() => setOrdersDialogOpen(true)}>
              {t('trading.orders.viewAll')}
            </Button>
          </Flex>

          <Flex gap={2} align="center">
            <ChakraField.Root flex={1}>
              <Select
                size="xs"
                value={filterStatus}
                onChange={(value) => setFilterStatus(value as OrdersFilterOption)}
                options={[
                  { value: 'all', label: t('trading.orders.allStatuses') },
                  { value: 'pending', label: t('trading.orders.statusPending') },
                  { value: 'active', label: t('trading.orders.statusActive') },
                  { value: 'filled', label: t('trading.orders.statusFilled') },
                  { value: 'closed', label: t('trading.orders.statusClosed') },
                  { value: 'cancelled', label: t('trading.orders.statusCancelled') },
                  { value: 'expired', label: t('trading.orders.statusExpired') },
                ]}
                usePortal
              />
            </ChakraField.Root>

            {viewMode === 'cards' && (
              <ChakraField.Root flex={1}>
                <Select
                  size="xs"
                  value={sortBy}
                  onChange={(value) => setSortBy(value as OrdersSortOption)}
                  options={[
                    { value: 'newest', label: t('trading.orders.sortNewest') },
                    { value: 'oldest', label: t('trading.orders.sortOldest') },
                    { value: 'symbol-asc', label: t('trading.orders.sortSymbolAsc') },
                    { value: 'symbol-desc', label: t('trading.orders.sortSymbolDesc') },
                    { value: 'quantity-desc', label: t('trading.orders.sortQuantityDesc') },
                    { value: 'quantity-asc', label: t('trading.orders.sortQuantityAsc') },
                    { value: 'pnl-desc', label: t('trading.orders.sortPnlDesc') },
                    { value: 'pnl-asc', label: t('trading.orders.sortPnlAsc') },
                    { value: 'price-desc', label: t('trading.orders.sortPriceDesc') },
                    { value: 'price-asc', label: t('trading.orders.sortPriceAsc') },
                  ]}
                  usePortal
                />
              </ChakraField.Root>
            )}

            <Group attached>
              <IconButton
                aria-label={t('trading.viewMode.cards')}
                size="2xs"
                variant={viewMode === 'cards' ? 'solid' : 'outline'}
                onClick={() => setViewMode('cards')}
              >
                <BsGrid />
              </IconButton>
              <IconButton
                aria-label={t('trading.viewMode.table')}
                size="2xs"
                variant={viewMode === 'table' ? 'solid' : 'outline'}
                onClick={() => setViewMode('table')}
              >
                <BsTable />
              </IconButton>
            </Group>
          </Flex>

          {filteredOrders.length === 0 ? (
            <Box p={4} textAlign="center" minH="100px">
              <Text fontSize="sm" color="fg.muted">
                {t('trading.orders.empty')}
              </Text>
            </Box>
          ) : viewMode === 'table' ? (
            <OrdersTableContent
              orders={filteredOrders}
              currency={activeWallet.currency}
              onCancel={(id) => { void cancelOrder(id); }}
              onClose={(id, price) => { void closeOrder(id, price); }}
              onNavigateToSymbol={globalActions?.navigateToSymbol}
            />
          ) : (
            <Stack gap={2}>
              {filteredOrders.map((order) => (
                <OrderCard
                  key={getOrderId(order)}
                  order={order}
                  currency={activeWallet.currency}
                  onCancel={(id) => { void cancelOrder(id); }}
                  onClose={(id, price) => { void closeOrder(id, price); }}
                  onNavigateToSymbol={globalActions?.navigateToSymbol}
                />
              ))}
            </Stack>
          )}

          <Flex justify="flex-end">
            <Button size="xs" variant="ghost" onClick={() => setOrdersDialogOpen(true)}>
              {t('trading.orders.viewAll')}
            </Button>
          </Flex>
        </>
      )}
    </Stack>
  );
};

export const OrdersList = memo(OrdersListComponent);
