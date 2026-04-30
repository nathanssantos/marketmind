import { formatDateTimeTooltip } from '@/renderer/utils/formatters';
import { HStack, Stack, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import type { Order } from '@marketmind/types';
import {
  getOrderCreatedAt,
  getOrderPrice,
  getOrderQuantity,
  getOrderType,
  isOrderActive,
  isOrderLong,
  isOrderPending,
} from '@shared/utils';
import { useTranslation } from 'react-i18next';
import { TooltipContainer } from './TooltipContainer';

interface PositionMetadata {
  isPosition?: boolean;
  positionData?: {
    symbol: string;
    type: 'long' | 'short';
    avgPrice: number;
    totalQuantity: number;
    totalPnL: number;
    orders: Order[];
    setupTypes?: string[];
  };
}

interface OrderTooltipProps {
  order: Order;
  currentPrice?: number;
  left: number;
  top: number;
}

export const OrderTooltip = ({ order, currentPrice, left, top }: OrderTooltipProps) => {
  const { t } = useTranslation();

  const isLong = isOrderLong(order);
  const isActive = isOrderActive(order);
  const isPending = isOrderPending(order);
  const metadata = (order as unknown as { metadata?: PositionMetadata }).metadata;
  const isPosition = metadata?.isPosition ?? false;
  const positionData = isPosition ? metadata?.positionData : null;

  let pnl = 0;
  let pnlPercent = 0;

  if (isActive && currentPrice) {
    if (isPosition && positionData) {
      pnl = positionData.totalPnL;
      const totalInvestment = positionData.avgPrice * positionData.totalQuantity;
      pnlPercent = (pnl / totalInvestment) * 100;
    } else {
      const entryPrice = getOrderPrice(order);
      const quantity = getOrderQuantity(order);
      const priceChange = currentPrice - entryPrice;
      pnl = priceChange * quantity * (isLong ? 1 : -1);
      pnlPercent = (pnl / (entryPrice * quantity)) * 100;
    }
  }

  const isProfitable = pnl >= 0;

  return (
    <TooltipContainer left={left} top={top}>
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {formatDateTimeTooltip(getOrderCreatedAt(order))}
      </Text>
      <HStack gap={1.5}>
        <Text>{isLong ? '📈' : '📉'}</Text>
        <Text fontWeight="semibold" color={isLong ? 'trading.long' : 'trading.short'}>
          {t(`trading.ticket.${getOrderType(order)}`)} {isPosition ? '' : isPending ? `(${t('trading.orders.statusPending')})` : ''}
        </Text>
      </HStack>

      {isPosition && positionData && (
        <>
          <HStack justify="space-between">
            <Text color="fg.muted">{t('trading.portfolio.orderCount')}:</Text>
            <Text fontWeight="medium">{positionData.orders.length}x</Text>
          </HStack>
          {positionData.setupTypes && positionData.setupTypes.length > 0 && (
            <HStack justify="space-between" flexWrap="wrap" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">{t('trading.portfolio.setups')}:</Text>
              <Stack gap={0.5} align="flex-end" bg="bg.subtle" p={1} borderRadius="sm">
                {positionData.setupTypes.map((setup, idx) => (
                  <Badge key={idx} colorScheme="blue" fontSize="2xs">
                    {setup.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                ))}
              </Stack>
            </HStack>
          )}
        </>
      )}

      {!isPosition && (
        <HStack justify="space-between" flexWrap="wrap">
          <Text color="fg.muted">{t('trading.portfolio.source')}:</Text>
          {order.setupType ? (
            <Badge colorScheme="purple" fontSize="2xs">
              {order.setupType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
          ) : (
            <Badge colorScheme="gray" fontSize="2xs">{t('trading.portfolio.manual')}</Badge>
          )}
        </HStack>
      )}

      <HStack justify="space-between">
        <Text color="fg.muted">{t('trading.ticket.symbol')}:</Text>
        <Text fontWeight="medium">{order.symbol}</Text>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted">{isPosition ? t('trading.portfolio.totalQuantity') : t('trading.ticket.quantity')}:</Text>
        <Text fontWeight="medium">{getOrderQuantity(order).toFixed(8)}</Text>
      </HStack>

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">{isPosition ? t('trading.portfolio.avgPrice') : t('trading.ticket.entryPrice')}:</Text>
        <Text fontWeight="medium">{getOrderPrice(order).toFixed(2)}</Text>
      </HStack>

      {isActive && currentPrice && (
        <>
          <HStack justify="space-between">
            <Text color="fg.muted">{t('trading.portfolio.currentPrice')}:</Text>
            <Text fontWeight="medium">{currentPrice.toFixed(2)}</Text>
          </HStack>

          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">{t('trading.portfolio.pnl')}:</Text>
            <Text fontWeight="semibold" color={isProfitable ? 'trading.profit' : 'trading.loss'}>
              {isProfitable ? '+' : ''}
              {pnl.toFixed(2)} ({isProfitable ? '+' : ''}
              {pnlPercent.toFixed(2)}%)
            </Text>
          </HStack>
        </>
      )}

      {order.stopLoss !== undefined && order.stopLoss > 0 && (
        <HStack justify="space-between">
          <Text color="fg.muted">Stop Loss:</Text>
          <Text fontWeight="medium" color="trading.loss">{order.stopLoss.toFixed(2)}</Text>
        </HStack>
      )}

      {order.takeProfit !== undefined && order.takeProfit > 0 && (
        <HStack justify="space-between">
          <Text color="fg.muted">Take Profit:</Text>
          <Text fontWeight="medium" color="trading.profit">{order.takeProfit.toFixed(2)}</Text>
        </HStack>
      )}

      {order.totalFees !== undefined && parseFloat(order.totalFees) > 0 && (
        <>
          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">Trading Fees:</Text>
            <Text fontWeight="medium" color="orange.fg">
              {parseFloat(order.totalFees).toFixed(4)}
            </Text>
          </HStack>
          {order.entryFee !== undefined && (
            <HStack justify="space-between">
              <Text color="fg.muted" fontSize="2xs" pl={2}>• Entry:</Text>
              <Text fontSize="2xs" color="fg.muted">{parseFloat(order.entryFee).toFixed(4)}</Text>
            </HStack>
          )}
          {order.exitFee !== undefined && (
            <HStack justify="space-between">
              <Text color="fg.muted" fontSize="2xs" pl={2}>• Exit (est):</Text>
              <Text fontSize="2xs" color="fg.muted">{parseFloat(order.exitFee).toFixed(4)}</Text>
            </HStack>
          )}
        </>
      )}

      {order.netPnl !== undefined && isActive && currentPrice && (
        <HStack justify="space-between">
          <Text color="fg.muted">Net P&L:</Text>
          <Text fontWeight="semibold" color={parseFloat(order.netPnl) >= 0 ? 'trading.profit' : 'trading.loss'}>
            {parseFloat(order.netPnl) >= 0 ? '+' : ''}
            {parseFloat(order.netPnl).toFixed(2)}
            {order.netPnlPercent !== undefined && ` (${parseFloat(order.netPnl) >= 0 ? '+' : ''}${parseFloat(order.netPnlPercent).toFixed(2)}%)`}
          </Text>
        </HStack>
      )}
    </TooltipContainer>
  );
};
