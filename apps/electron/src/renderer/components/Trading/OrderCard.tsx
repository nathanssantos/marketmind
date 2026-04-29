import { Badge, CryptoIcon, IconButton } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { Box, Flex, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { MarketType, Order, WalletCurrency } from '@marketmind/types';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuBot, LuX } from 'react-icons/lu';
import { getStatusColor, getStatusTranslationKey } from './orderHelpers';
import { StrategyInfoPopover } from './StrategyInfoPopover';

export interface OrderCardProps {
  order: Order;
  currency: WalletCurrency;
  onCancel: (id: string) => void;
  onClose: (id: string, price: number) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}

const getTypeColor = (isLong: boolean): string => isLong ? 'green' : 'red';

export const OrderCard = memo(({ order, currency, onCancel, onClose, onNavigateToSymbol }: OrderCardProps) => {
  const { t } = useTranslation();
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
            <CryptoIcon
              symbol={order.symbol}
              size={16}
              onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
            />
            <Text
              fontWeight="bold"
              fontSize="sm"
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              _hover={onNavigateToSymbol ? { color: 'accent.solid', textDecoration: 'underline' } : undefined}
              onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
            >
              {order.symbol}
            </Text>
          </Flex>
          <Flex gap={2} align="center" flexWrap="wrap">
            <Badge colorPalette={getTypeColor(isOrderLong(order))} size="xs">
              {t(`trading.ticket.${isOrderLong(order) ? 'long' : 'short'}`)}
            </Badge>
            <Badge colorPalette={getStatusColor(order.status)} size="xs">
              {t(`trading.orders.${getStatusTranslationKey(order.status)}`)}
            </Badge>
            {order.isAutoTrade && (
              <Badge colorPalette="blue" size="xs">
                <Flex align="center" gap={1}>
                  <LuBot size={10} />
                  AUTO
                </Flex>
              </Badge>
            )}
            {order.marketType === 'FUTURES' && (
              <Badge colorPalette="orange" size="xs">
                FUTURES
              </Badge>
            )}
            {order.setupType && order.isAutoTrade && order.id && order.symbol && (
              <StrategyInfoPopover
                setupType={order.setupType}
                executionId={order.id}
                symbol={order.symbol}
              >
                <Badge colorPalette="purple" size="xs" cursor="pointer">
                  {t(`setups.${order.setupType}`, { defaultValue: order.setupType })}
                </Badge>
              </StrategyInfoPopover>
            )}
            {order.setupType && !order.isAutoTrade && (
              <Badge colorPalette="purple" size="xs">
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
                      onClick={() => onClose(getOrderId(order), order.currentPrice ?? getOrderPrice(order))}
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
                      onClick={() => onCancel(getOrderId(order))}
                      color="red.fg"
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
          <Stack gap={0} align="flex-end">
            <Text>{currency} {getOrderPrice(order).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <BrlValue usdtValue={getOrderPrice(order)} />
          </Stack>
        </Flex>
        {order.currentPrice && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.currentPrice')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="blue.fg" fontWeight="medium">{currency} {order.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={order.currentPrice} />
            </Stack>
          </Flex>
        )}
        {order.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="red.fg">{currency} {order.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={order.stopLoss} />
            </Stack>
          </Flex>
        )}
        {order.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="green.fg">{currency} {order.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={order.takeProfit} />
            </Stack>
          </Flex>
        )}
        {order.pnl !== undefined && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.pnl')}</Text>
            <Stack gap={0} align="flex-end">
              <Text fontWeight="medium" color={parseFloat(order.pnl) >= 0 ? 'trading.profit' : 'trading.loss'}>
                {parseFloat(order.pnl) >= 0 ? '+' : ''}{parseFloat(order.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {order.pnlPercent !== undefined && ` (${parseFloat(order.pnl) >= 0 ? '+' : '-'}${Math.abs(parseFloat(order.pnlPercent)).toFixed(2)}%)`}
              </Text>
              <BrlValue usdtValue={parseFloat(order.pnl)} />
            </Stack>
          </Flex>
        )}
      </Stack>
    </Box>
  );
});

OrderCard.displayName = 'OrderCard';
