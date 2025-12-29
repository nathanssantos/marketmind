import { Badge, Box, Flex, Group, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { Order, OrderStatus, WalletCurrency } from '@marketmind/types';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { Select } from '@renderer/components/ui/select';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useOrderUpdates } from '@renderer/hooks/useOrderUpdates';
import { type OrdersFilterOption, type OrdersSortOption, useUIStore } from '@renderer/store/uiStore';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';
import {
  getOrderId,
  getOrderPrice,
  getOrderQuantity,
  isOrderActive,
  isOrderLong,
  isOrderPending,
} from '@shared/utils';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { BsGrid, BsTable, BsThreeDotsVertical } from 'react-icons/bs';
import { LuBot, LuX } from 'react-icons/lu';

const OrdersListComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const { wallets: backendWallets } = useBackendWallet();
  const activeWalletId = backendWallets[0]?.id;
  useOrderUpdates(activeWalletId ?? '');
  const {
    orders: backendOrdersData,
    tradeExecutions,
    cancelOrder: cancelBackendOrder,
    closeExecution,
    cancelExecution,
  } = useBackendTrading(activeWalletId || '', undefined);

  const orders: Order[] = useMemo(() => {
    const ordersFromApi = backendOrdersData.map((o): Order => ({
      symbol: o.symbol,
      orderId: o.orderId,
      orderListId: 0,
      clientOrderId: '',
      price: o.price || '0',
      origQty: o.origQty || '0',
      executedQty: o.executedQty || '0',
      cummulativeQuoteQty: '0',
      status: (o.status || 'NEW') as any,
      timeInForce: (o.timeInForce || 'GTC') as any,
      type: (o.type || 'LIMIT') as any,
      side: o.side as any,
      time: typeof o.time === 'number' ? o.time : Date.now(),
      updateTime: typeof o.updateTime === 'number' ? o.updateTime : Date.now(),
      isWorking: o.status === 'NEW' || o.status === 'PARTIALLY_FILLED',
      origQuoteOrderQty: '0',
      id: o.orderId.toString(),
      walletId: o.walletId,
      orderDirection: o.side === 'BUY' ? ('long' as const) : ('short' as const),
      entryPrice: parseFloat(o.price || '0'),
      quantity: parseFloat(o.origQty || '0'),
      createdAt: new Date(o.createdAt),
      marketType: o.marketType || 'SPOT',
    }));

    const ordersFromExecutions = tradeExecutions.map((e): Order => ({
      symbol: e.symbol,
      orderId: 0,
      orderListId: 0,
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
      marketType: e.marketType || 'SPOT',

      isAutoTrade: true,
    }));

    return [...ordersFromApi, ...ordersFromExecutions];
  }, [backendOrdersData, tradeExecutions]);

  const wallets = backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance || '0'),
    initialBalance: parseFloat(w.initialBalance || '0'),
    currency: (w.currency || 'USDT') as any,
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

  const cancelOrder = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (order && activeWalletId) {
      if (order.isAutoTrade) {
        await cancelExecution(id);
      } else {
        await cancelBackendOrder({
          walletId: activeWalletId,
          symbol: order.symbol,
          orderId: order.orderId || 0,
        });
      }
    }
  };

  const closeOrder = async (id: string, price: number) => {
    const order = orders.find(o => o.id === id);
    if (order?.isAutoTrade) {
      await closeExecution(id, price.toString());
    }
  };

  const filterStatus = useUIStore((s) => s.ordersFilterStatus);
  const setFilterStatus = useUIStore((s) => s.setOrdersFilterStatus);
  const sortBy = useUIStore((s) => s.ordersSortBy);
  const setSortBy = useUIStore((s) => s.setOrdersSortBy);
  const viewMode = useUIStore((s) => s.ordersViewMode);
  const setViewMode = useUIStore((s) => s.setOrdersViewMode);

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

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.orders.title')}
        </Text>
      </Flex>

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
                <Text fontWeight="medium">{walletOrders.length}</Text>
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

          <Flex gap={2} align="flex-end">
            <ChakraField.Root flex={1}>
              <ChakraField.Label fontSize="xs">{t('trading.orders.filterByStatus')}</ChakraField.Label>
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
                <ChakraField.Label fontSize="xs">{t('trading.orders.sortBy')}</ChakraField.Label>
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

          {filteredOrders.length === 0 ? (
            <Box p={4} textAlign="center" minH="100px">
              <Text fontSize="sm" color="fg.muted">
                {t('trading.orders.empty')}
              </Text>
            </Box>
          ) : viewMode === 'table' ? (
            <OrdersTable
              orders={filteredOrders}
              currency={activeWallet.currency}
              onCancel={(id) => cancelOrder(id)}
              onClose={(id, price) => closeOrder(id, price)}
              onNavigateToSymbol={globalActions?.navigateToSymbol}
            />
          ) : (
            <Stack gap={2}>
              {filteredOrders.map((order) => (
                <OrderCard
                  key={getOrderId(order)}
                  order={order}
                  currency={activeWallet.currency}
                  onCancel={() => cancelOrder(getOrderId(order))}
                  onClose={(price) => closeOrder(getOrderId(order), price)}
                  onNavigateToSymbol={globalActions?.navigateToSymbol}
                />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
};

interface OrderCardProps {
  order: import('@marketmind/types').Order;
  currency: import('@marketmind/types').WalletCurrency;
  onCancel: () => void;
  onClose: (price: number) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const OrderCard = ({ order, currency, onCancel, onClose, onNavigateToSymbol }: OrderCardProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: OrderStatus): string => {
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

  const getStatusTranslationKey = (status: OrderStatus): string => {
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

  const getTypeColor = (isLong: boolean): string => {
    return isLong ? 'green' : 'red';
  };

  const canCancel = isOrderPending(order) || isOrderActive(order);
  const canClose = isOrderActive(order);
  const hasActions = canClose || canCancel;

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={`${getTypeColor(isOrderLong(order))}.500`}
    >
      <Flex justify="space-between" align="flex-start" mb={2}>
        <Stack gap={1.5}>
          <Flex align="center" gap={1.5}>
            {order.isAutoTrade && (
              <Box title={t('trading.orders.autoTrade')}>
                <LuBot size={14} />
              </Box>
            )}
            <Text
              fontWeight="bold"
              fontSize="sm"
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
              onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
            >
              {order.symbol}
            </Text>
          </Flex>
          <Flex gap={2} align="center" flexWrap="wrap">
            <Badge colorPalette={getTypeColor(isOrderLong(order))} size="sm" px={2}>
              {t(`trading.ticket.${isOrderLong(order) ? 'long' : 'short'}`)}
            </Badge>
            <Badge colorPalette={getStatusColor(order.status)} size="sm" px={2}>
              {t(`trading.orders.${getStatusTranslationKey(order.status)}`)}
            </Badge>
            {order.marketType === 'FUTURES' && (
              <Badge colorPalette="orange" size="sm" px={2}>
                FUTURES
              </Badge>
            )}
            {order.setupType && (
              <Badge colorPalette="purple" size="sm" px={2}>
                {t(`setups.${order.setupType}`, { defaultValue: order.setupType })}
              </Badge>
            )}
          </Flex>
        </Stack>
        {hasActions && (
          <MenuRoot id={`order-menu-${getOrderId(order)}`} positioning={{ placement: 'bottom-end' }}>
            <MenuTrigger asChild>
              <IconButton size="2xs" variant="ghost" aria-label="Order options">
                <BsThreeDotsVertical />
              </IconButton>
            </MenuTrigger>
            <Portal>
              <MenuPositioner>
                <MenuContent
                  bg="bg.panel"
                  borderColor="border"
                  shadow="lg"
                  minW="150px"
                  zIndex={99999}
                  p={0}
                >
                  {canClose && (
                    <MenuItem
                      value="close"
                      onClick={() => onClose(order.currentPrice || getOrderPrice(order))}
                      px={4}
                      py={2.5}
                      _hover={{ bg: 'bg.muted' }}
                      borderBottomWidth={canCancel ? '1px' : undefined}
                      borderColor="border"
                    >
                      <LuX />
                      <Text>{t('trading.orders.close')}</Text>
                    </MenuItem>
                  )}
                  {canCancel && (
                    <MenuItem
                      value="cancel"
                      onClick={onCancel}
                      color="red.500"
                      px={4}
                      py={2.5}
                      _hover={{ bg: 'bg.muted' }}
                    >
                      <LuX />
                      <Text>{t('trading.orders.cancel')}</Text>
                    </MenuItem>
                  )}
                </MenuContent>
              </MenuPositioner>
            </Portal>
          </MenuRoot>
        )}
      </Flex>

      <Stack gap={1} fontSize="xs">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.createdAt')}</Text>
          <Text fontWeight="medium">
            {order.createdAt && new Date(order.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Flex>
        {order.updateTime && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.filledAt')}</Text>
            <Text>
              {new Date(order.updateTime).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </Flex>
        )}
        {order.closedAt && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.closedAt')}</Text>
            <Text>
              {new Date(order.closedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </Flex>
        )}
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.quantity')}</Text>
          <Text fontWeight="medium">{getOrderQuantity(order).toFixed(8)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.entryPrice')}</Text>
          <Text>{currency} {getOrderPrice(order).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Flex>
        {order.currentPrice && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.currentPrice')}</Text>
            <Text color="blue.500" fontWeight="medium">{currency} {order.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Flex>
        )}
        {order.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Text color="red.500">{currency} {order.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Flex>
        )}
        {order.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Text color="green.500">{currency} {order.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Flex>
        )}
        {order.pnl !== undefined && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.pnl')}</Text>
            <Text fontWeight="medium" color={parseFloat(order.pnl) >= 0 ? 'green.500' : 'red.500'}>
              {parseFloat(order.pnl) >= 0 ? '+' : ''}{parseFloat(order.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {order.pnlPercent !== undefined && ` (${parseFloat(order.pnl) >= 0 ? '+' : ''}${parseFloat(order.pnlPercent).toFixed(2)}%)`}
            </Text>
          </Flex>
        )}
        {false && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.fees')}</Text>
            <Text color="orange.500">{currency} {(order.commission ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</Text>
          </Flex>
        )}
      </Stack>
    </Box>
  );
};

interface OrdersTableProps {
  orders: Order[];
  currency: WalletCurrency;
  onCancel: (id: string) => void;
  onClose: (id: string, price: number) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const OrdersTable = ({ orders, currency, onCancel, onClose, onNavigateToSymbol }: OrdersTableProps) => {
  const { t } = useTranslation();
  const sortKey = useUIStore((s) => s.ordersTableSortKey);
  const sortDirection = useUIStore((s) => s.ordersTableSortDirection);
  const setOrdersTableSort = useUIStore((s) => s.setOrdersTableSort);
  const orderSymbols = useMemo(() => [...new Set(orders.map((o) => o.symbol))], [orders]);
  const centralizedPrices = usePricesForSymbols(orderSymbols);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setOrdersTableSort(key, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdersTableSort(key, 'desc');
    }
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'symbol':
          return dir * a.symbol.localeCompare(b.symbol);
        case 'pnl': {
          const pnlA = a.pnl ? parseFloat(a.pnl) : 0;
          const pnlB = b.pnl ? parseFloat(b.pnl) : 0;
          return dir * (pnlA - pnlB);
        }
        case 'side':
          return dir * (isOrderLong(a) ? 1 : -1) - (isOrderLong(b) ? 1 : -1);
        case 'status':
          return dir * a.status.localeCompare(b.status);
        case 'type':
          return dir * ((a.marketType || '').localeCompare(b.marketType || ''));
        case 'setup':
          return dir * ((a.setupType || '').localeCompare(b.setupType || ''));
        case 'createdAt':
          return dir * ((a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
        case 'filledAt':
          return dir * ((a.updateTime || 0) - (b.updateTime || 0));
        case 'closedAt':
          return dir * ((a.closedAt?.getTime() || 0) - (b.closedAt?.getTime() || 0));
        case 'quantity':
          return dir * (getOrderQuantity(a) - getOrderQuantity(b));
        case 'entryPrice':
          return dir * (getOrderPrice(a) - getOrderPrice(b));
        case 'currentPrice':
          return dir * ((a.currentPrice || 0) - (b.currentPrice || 0));
        case 'stopLoss':
          return dir * ((a.stopLoss || 0) - (b.stopLoss || 0));
        case 'takeProfit':
          return dir * ((a.takeProfit || 0) - (b.takeProfit || 0));
        default:
          return 0;
      }
    });
  }, [orders, sortKey, sortDirection]);

  const getStatusColor = (status: OrderStatus): string => {
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

  const getStatusTranslationKey = (status: OrderStatus): string => {
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

  const formatDate = (date: Date | number | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    return `${currency} ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: TradingTableColumn[] = [
    { key: 'symbol', header: t('trading.orders.symbol'), sticky: true, minW: '100px' },
    { key: 'pnl', header: t('trading.orders.pnl'), textAlign: 'right', minW: '130px' },
    { key: 'side', header: t('trading.orders.side') },
    { key: 'status', header: t('trading.orders.status') },
    { key: 'setup', header: t('trading.orders.setup') },
    { key: 'type', header: t('trading.orders.type') },
    { key: 'createdAt', header: t('trading.orders.createdAt') },
    { key: 'filledAt', header: t('trading.orders.filledAt') },
    { key: 'closedAt', header: t('trading.orders.closedAt') },
    { key: 'quantity', header: t('trading.orders.quantity'), textAlign: 'right' },
    { key: 'entryPrice', header: t('trading.orders.entryPrice'), textAlign: 'right' },
    { key: 'currentPrice', header: t('trading.orders.currentPrice'), textAlign: 'right' },
    { key: 'stopLoss', header: t('trading.orders.stopLoss'), textAlign: 'right' },
    { key: 'takeProfit', header: t('trading.orders.takeProfit'), textAlign: 'right' },
    { key: 'actions', header: t('trading.orders.actions'), textAlign: 'center', sortable: false },
  ];

  return (
    <TradingTable columns={columns} minW="1400px" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>
      {sortedOrders.map((order) => {
        const canCancel = isOrderPending(order) || isOrderActive(order);
        const canClose = isOrderActive(order);
        const pnl = order.pnl ? parseFloat(order.pnl) : undefined;
        const pnlPercent = order.pnlPercent ? parseFloat(order.pnlPercent) : undefined;
        const centralPrice = centralizedPrices[order.symbol];
        const currentPrice = centralPrice ?? order.currentPrice;

        return (
          <TradingTableRow key={getOrderId(order)}>
            <TradingTableCell sticky>
              <Flex align="center" gap={1}>
                {order.isAutoTrade && <LuBot size={12} />}
                <Text
                  fontWeight="medium"
                  cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                  _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
                  onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
                >
                  {order.symbol}
                </Text>
              </Flex>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              {pnl !== undefined ? (
                <Text fontWeight="medium" color={pnl >= 0 ? 'green.500' : 'red.500'}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                  {pnlPercent !== undefined && ` (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`}
                </Text>
              ) : '-'}
            </TradingTableCell>
            <TradingTableCell>
              <Badge colorPalette={isOrderLong(order) ? 'green' : 'red'} size="sm" px={2}>
                {t(`trading.ticket.${isOrderLong(order) ? 'long' : 'short'}`)}
              </Badge>
            </TradingTableCell>
            <TradingTableCell>
              <Badge colorPalette={getStatusColor(order.status)} size="sm" px={2}>
                {t(`trading.orders.${getStatusTranslationKey(order.status)}`)}
              </Badge>
            </TradingTableCell>
            <TradingTableCell>
              {order.setupType ? (
                <Badge colorPalette="purple" size="sm" px={2}>
                  {t(`setups.${order.setupType}`, { defaultValue: order.setupType })}
                </Badge>
              ) : '-'}
            </TradingTableCell>
            <TradingTableCell>
              {order.marketType === 'FUTURES' ? (
                <Badge colorPalette="orange" size="sm" px={2}>FUTURES</Badge>
              ) : (
                <Badge colorPalette="gray" size="sm" px={2}>SPOT</Badge>
              )}
            </TradingTableCell>
            <TradingTableCell>{formatDate(order.createdAt)}</TradingTableCell>
            <TradingTableCell>{formatDate(order.updateTime)}</TradingTableCell>
            <TradingTableCell>{formatDate(order.closedAt)}</TradingTableCell>
            <TradingTableCell textAlign="right">{getOrderQuantity(order).toFixed(8)}</TradingTableCell>
            <TradingTableCell textAlign="right">{formatPrice(getOrderPrice(order))}</TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="blue.500">{formatPrice(currentPrice)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="red.500">{formatPrice(order.stopLoss)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="green.500">{formatPrice(order.takeProfit)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="center">
              {(canClose || canCancel) && (
                <MenuRoot id={`order-table-menu-${getOrderId(order)}`} positioning={{ placement: 'bottom-end' }}>
                  <MenuTrigger asChild>
                    <IconButton size="2xs" variant="ghost" aria-label="Order options">
                      <BsThreeDotsVertical />
                    </IconButton>
                  </MenuTrigger>
                  <Portal>
                    <MenuPositioner>
                      <MenuContent bg="bg.panel" borderColor="border" shadow="lg" minW="120px" zIndex={99999} p={0}>
                        {canClose && (
                          <MenuItem
                            value="close"
                            onClick={() => onClose(getOrderId(order), currentPrice || getOrderPrice(order))}
                            px={3}
                            py={2}
                            _hover={{ bg: 'bg.muted' }}
                          >
                            <LuX />
                            <Text fontSize="sm">{t('trading.orders.close')}</Text>
                          </MenuItem>
                        )}
                        {canCancel && (
                          <MenuItem
                            value="cancel"
                            onClick={() => onCancel(getOrderId(order))}
                            color="red.500"
                            px={3}
                            py={2}
                            _hover={{ bg: 'bg.muted' }}
                          >
                            <LuX />
                            <Text fontSize="sm">{t('trading.orders.cancel')}</Text>
                          </MenuItem>
                        )}
                      </MenuContent>
                    </MenuPositioner>
                  </Portal>
                </MenuRoot>
              )}
            </TradingTableCell>
          </TradingTableRow>
        );
      })}
    </TradingTable>
  );
};

export const OrdersList = memo(OrdersListComponent);
