import { Badge, Box, Flex, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { Select } from '@renderer/components/ui/select';
import { useTradingStore } from '@renderer/store/tradingStore';
import type { OrderStatus } from '@shared/types/trading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuX } from 'react-icons/lu';

export const OrdersList = () => {
  const { t } = useTranslation();
  const wallets = useTradingStore((state) => state.wallets);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const orders = useTradingStore((state) => state.orders);
  const cancelOrder = useTradingStore((state) => state.cancelOrder);
  const closeOrder = useTradingStore((state) => state.closeOrder);

  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const walletOrders = activeWallet
    ? orders.filter((o) => o.walletId === activeWallet.id)
    : [];

  const filteredOrders = filterStatus === 'all'
    ? walletOrders
    : walletOrders.filter((o) => o.status === filterStatus);

  const activeOrders = walletOrders.filter((o) => o.status === 'active').length;
  const pendingOrders = walletOrders.filter((o) => o.status === 'pending').length;

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

          <ChakraField.Root>
            <ChakraField.Label fontSize="xs">{t('trading.orders.filterByStatus')}</ChakraField.Label>
            <Select
              size="xs"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value as OrderStatus | 'all')}
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

          <Box maxH="calc(100vh - 400px)" overflowY="auto">
            {filteredOrders.length === 0 ? (
              <Box p={4} textAlign="center">
                <Text fontSize="sm" color="fg.muted">
                  {t('trading.orders.empty')}
                </Text>
              </Box>
            ) : (
              <Stack gap={2}>
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currency={activeWallet.currency}
                    onCancel={() => cancelOrder(order.id)}
                    onClose={(price) => closeOrder(order.id, price)}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
};

interface OrderCardProps {
  order: import('@shared/types/trading').Order;
  currency: import('@shared/types/trading').WalletCurrency;
  onCancel: () => void;
  onClose: (price: number) => void;
}

const OrderCard = ({ order, currency, onCancel, onClose }: OrderCardProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: OrderStatus): string => {
    const colors: Record<OrderStatus, string> = {
      pending: 'orange',
      active: 'green',
      filled: 'blue',
      closed: 'gray',
      cancelled: 'red',
      expired: 'gray',
    };
    return colors[status];
  };

  const getTypeColor = (type: 'long' | 'short'): string => {
    return type === 'long' ? 'green' : 'red';
  };

  const canCancel = order.status === 'pending' || order.status === 'active';
  const canClose = order.status === 'active';
  const hasActions = canClose || canCancel;

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={`${getTypeColor(order.type)}.500`}
    >
      <Flex justify="space-between" align="flex-start" mb={2}>
        <Stack gap={1.5}>
          <Text fontWeight="bold" fontSize="sm">
            {order.symbol}
          </Text>
          <Flex gap={2} align="center">
            <Badge colorPalette={getTypeColor(order.type)} size="sm" px={2}>
              {t(`trading.ticket.${order.type}`)}
            </Badge>
            <Badge colorPalette={getStatusColor(order.status)} size="sm" px={2}>
              {t(`trading.orders.status${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}`)}
            </Badge>
          </Flex>
        </Stack>
        {hasActions && (
          <MenuRoot id={`order-menu-${order.id}`} positioning={{ placement: 'bottom-end' }}>
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
                      onClick={() => onClose(order.currentPrice || order.entryPrice)}
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
            {new Date(order.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Flex>
        {order.filledAt && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.filledAt')}</Text>
            <Text>
              {new Date(order.filledAt).toLocaleString(undefined, {
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
          <Text fontWeight="medium">{order.quantity.toFixed(8)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.entryPrice')}</Text>
          <Text>{currency} {order.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
            <Text fontWeight="medium" color={order.pnl >= 0 ? 'green.500' : 'red.500'}>
              {order.pnl >= 0 ? '+' : ''}{order.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {order.pnlPercent !== undefined && ` (${order.pnl >= 0 ? '+' : ''}${order.pnlPercent.toFixed(2)}%)`}
            </Text>
          </Flex>
        )}
      </Stack>
    </Box>
  );
};
