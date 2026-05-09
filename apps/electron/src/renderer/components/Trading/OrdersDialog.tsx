import { DialogShell, EmptyState, IconButton, Input, LoadingSpinner, Select } from '@renderer/components/ui';
import { Box, Flex, Group, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { MM } from '@marketmind/tokens';
import type { Order, OrderStatus, OrderType, TimeInForce, WalletCurrency } from '@marketmind/types';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { trpc } from '@renderer/utils/trpc';
import { useUIStore, type OrdersFilterOption } from '@renderer/store/uiStore';
import { isOrderActive, isOrderPending } from '@shared/utils';
import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { OrderCard } from './OrderCard';
import { OrdersTableContent } from './OrdersTableContent';

const PAGE_SIZE = 25;

const OrdersDialogComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const { isOrdersDialogOpen, setOrdersDialogOpen } = useUIStore(useShallow((s) => ({
    isOrdersDialogOpen: s.isOrdersDialogOpen,
    setOrdersDialogOpen: s.setOrdersDialogOpen,
  })));

  const { activeWallet: rawActiveWallet, wallets: backendWallets } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;

  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrdersFilterOption>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [page, setPage] = useState(0);

  const deferredSearch = useDeferredValue(searchInput);

  const { data: ordersData, isLoading: isLoadingOrders } = trpc.trading.getOrders.useQuery(
    { walletId: activeWalletId ?? '', search: deferredSearch || undefined, limit: 500 },
    { enabled: !!activeWalletId && isOrdersDialogOpen }
  );

  const { data: executionsData, isLoading: isLoadingExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: activeWalletId ?? '', search: deferredSearch || undefined, limit: 500 },
    { enabled: !!activeWalletId && isOrdersDialogOpen }
  );

  const { data: statsData } = trpc.trading.getOrdersStats.useQuery(
    { walletId: activeWalletId ?? '' },
    { enabled: !!activeWalletId && isOrdersDialogOpen }
  );

  const activeWallet = useMemo(() => {
    const w = backendWallets.find((w) => w.id === activeWalletId);
    if (!w) return null;
    return { id: w.id, currency: (w.currency ?? 'USDT') as WalletCurrency };
  }, [backendWallets, activeWalletId]);

  const orders: Order[] = useMemo(() => {
    const ordersFromApi = (ordersData ?? []).map((o): Order => ({
      symbol: o.symbol,
      orderId: o.orderId,
      orderListId: '0',
      clientOrderId: '',
      price: o.price ?? '0',
      origQty: o.origQty ?? '0',
      executedQty: o.executedQty ?? '0',
      cummulativeQuoteQty: '0',
      status: (o.status || 'NEW') as OrderStatus,
      timeInForce: (o.timeInForce ?? 'GTC') as TimeInForce,
      type: (o.type || 'LIMIT') as OrderType,
      side: o.side,
      time: typeof o.time === 'number' ? o.time : Date.now(),
      updateTime: typeof o.updateTime === 'number' ? o.updateTime : Date.now(),
      isWorking: o.status === 'NEW' || o.status === 'PARTIALLY_FILLED',
      origQuoteOrderQty: '0',
      id: o.orderId.toString(),
      walletId: o.walletId,
      orderDirection: o.side === 'BUY' ? ('long' as const) : ('short' as const),
      entryPrice: parseFloat(o.price ?? '0'),
      quantity: parseFloat(o.origQty ?? '0'),
      createdAt: new Date(o.createdAt),
      marketType: o.marketType ?? 'FUTURES',
    }));

    const ordersFromExecutions = (executionsData ?? []).map((e): Order => ({
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
      pnl: e.pnl ?? undefined,
      pnlPercent: e.pnlPercent ?? undefined,
      closedAt: e.closedAt ? new Date(e.closedAt) : undefined,
      setupType: e.setupType ?? undefined,
      marketType: e.marketType ?? 'FUTURES',
      isAutoTrade: !!e.setupType,
    }));

    return [...ordersFromApi, ...ordersFromExecutions].sort((a, b) => (b.updateTime || b.time) - (a.updateTime || a.time));
  }, [ordersData, executionsData]);

  const filteredOrders = useMemo(() => {
    setPage(0);
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
   
  }, [orders, filterStatus]);

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const pageOrders = filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const activeOrders = useMemo(() => orders.filter((o) => isOrderActive(o)).length, [orders]);
  const pendingOrders = useMemo(() => orders.filter((o) => isOrderPending(o)).length, [orders]);
  const totalCount = (statsData?.ordersCount ?? 0) + (statsData?.executionsCount ?? 0);

  const handleClose = useCallback(() => setOrdersDialogOpen(false), [setOrdersDialogOpen]);

  const handleCancel = useCallback((_id: string) => {}, []);
  const handleClose2 = useCallback((_id: string, _price: number) => {}, []);

  const isLoading = isLoadingOrders || isLoadingExecutions;

  return (
    <DialogShell
      isOpen={isOrdersDialogOpen}
      onClose={handleClose}
      size="xl"
      title={t('trading.orders.dialogTitle')}
      hideFooter
    >
            <Box p={MM.spacing.sectionPadding} bg="bg.muted" borderRadius={MM.borderRadius.card}>
              <Flex gap={4} fontSize={MM.font.body.size} flexWrap="wrap">
                <Flex gap={MM.spacing.inline.gap}>
                  <Text color="fg.muted">{t('trading.orders.total')}</Text>
                  <Text fontWeight="medium">{totalCount}</Text>
                </Flex>
                <Flex gap={MM.spacing.inline.gap}>
                  <Text color="fg.muted">{t('trading.orders.active')}</Text>
                  <Text fontWeight="medium" color="green.fg">{activeOrders}</Text>
                </Flex>
                <Flex gap={MM.spacing.inline.gap}>
                  <Text color="fg.muted">{t('trading.orders.pending')}</Text>
                  <Text fontWeight="medium" color="orange.fg">{pendingOrders}</Text>
                </Flex>
              </Flex>
            </Box>

            <Flex gap={MM.spacing.inline.gap} align="center" flexWrap="wrap">
              <Input
                size="xs"
                placeholder={t('trading.orders.search')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxW="240px"
              />
              <ChakraField.Root minW="140px">
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
                  usePortal={false}
                />
              </ChakraField.Root>
              <Group attached ml="auto">
                <IconButton
                  aria-label={t('trading.viewMode.cards')}
                  size="xs"
                  variant={viewMode === 'cards' ? 'solid' : 'outline'}
                  onClick={() => setViewMode('cards')}
                >
                  <BsGrid />
                </IconButton>
                <IconButton
                  aria-label={t('trading.viewMode.table')}
                  size="xs"
                  variant={viewMode === 'table' ? 'solid' : 'outline'}
                  onClick={() => setViewMode('table')}
                >
                  <BsTable />
                </IconButton>
              </Group>
            </Flex>

            {isLoading ? (
              <LoadingSpinner />
            ) : filteredOrders.length === 0 ? (
              <EmptyState size="sm" title={t('trading.orders.noResults')} />
            ) : activeWallet ? (
              viewMode === 'table' ? (
                <OrdersTableContent
                  orders={pageOrders}
                  currency={activeWallet.currency}
                  onCancel={handleCancel}
                  onClose={handleClose2}
                  onNavigateToSymbol={globalActions?.navigateToSymbol}
                />
              ) : (
                <Stack gap={2}>
                  {pageOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currency={activeWallet.currency}
                      onCancel={handleCancel}
                      onClose={handleClose2}
                      onNavigateToSymbol={globalActions?.navigateToSymbol}
                    />
                  ))}
                </Stack>
              )
            ) : null}

            {totalPages > 1 && (
              <Flex justify="center" align="center" gap={3} pt={2}>
                <IconButton
                  size="xs"
                  variant="outline"
                  aria-label={t('common.previous')}
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <LuChevronLeft />
                </IconButton>
                <Text fontSize="xs" color="fg.muted">
                  {t('trading.orders.page', { page: page + 1, total: totalPages })}
                </Text>
                <IconButton
                  size="xs"
                  variant="outline"
                  aria-label={t('common.next')}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <LuChevronRight />
                </IconButton>
              </Flex>
            )}
    </DialogShell>
  );
};

export const OrdersDialog = memo(OrdersDialogComponent);
