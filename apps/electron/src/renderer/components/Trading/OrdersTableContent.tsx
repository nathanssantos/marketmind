import { Box, Flex, Portal, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { MarketType, Order, WalletCurrency } from '@marketmind/types';
import { Badge, CryptoIcon, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { useUIStore } from '@renderer/store/uiStore';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuBot, LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { formatDate, formatPrice, getStatusColor, getStatusTranslationKey } from './orderHelpers';
import { StrategyInfoPopover } from './StrategyInfoPopover';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';

export interface OrdersTableContentProps {
  orders: Order[];
  currency: WalletCurrency;
  onCancel: (id: string) => void;
  onClose: (id: string, price: number) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}

export const OrdersTableContent = memo(({ orders, currency, onCancel, onClose, onNavigateToSymbol }: OrdersTableContentProps) => {
  const { t } = useTranslation();
  const { sortKey, sortDirection, setOrdersTableSort } = useUIStore(useShallow((s) => ({
    sortKey: s.ordersTableSortKey,
    sortDirection: s.ordersTableSortDirection,
    setOrdersTableSort: s.setOrdersTableSort,
  })));
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
          return dir * ((a.marketType ?? '').localeCompare(b.marketType ?? ''));
        case 'setup':
          return dir * ((a.setupType ?? '').localeCompare(b.setupType ?? ''));
        case 'createdAt':
          return dir * ((a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
        case 'filledAt':
          return dir * ((a.updateTime || 0) - (b.updateTime || 0));
        case 'closedAt':
          return dir * ((a.closedAt?.getTime() ?? 0) - (b.closedAt?.getTime() ?? 0));
        case 'quantity':
          return dir * (getOrderQuantity(a) - getOrderQuantity(b));
        case 'entryPrice':
          return dir * (getOrderPrice(a) - getOrderPrice(b));
        case 'currentPrice':
          return dir * ((a.currentPrice ?? 0) - (b.currentPrice ?? 0));
        case 'stopLoss':
          return dir * ((a.stopLoss ?? 0) - (b.stopLoss ?? 0));
        case 'takeProfit':
          return dir * ((a.takeProfit ?? 0) - (b.takeProfit ?? 0));
        default:
          return 0;
      }
    });
  }, [orders, sortKey, sortDirection]);

  const columns: TradingTableColumn[] = [
    { key: 'symbol', header: t('trading.orders.symbol'), sticky: true },
    { key: 'pnl', header: t('trading.orders.pnl'), textAlign: 'right' },
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
    { key: 'auto', header: '', sortable: false },
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
        // Closed orders display their actual exit price (so the price
        // shown matches the recorded P&L). Open / pending / cancelled
        // orders fall back to the live ticker.
        const isClosed = order.status === 'FILLED' && order.closedAt !== undefined;
        const currentPrice = isClosed
          ? (order.exitPrice ?? centralPrice ?? order.currentPrice)
          : (centralPrice ?? order.currentPrice);

        return (
          <TradingTableRow key={getOrderId(order)}>
            <TradingTableCell sticky>
              <Flex align="center" gap={1} borderLeft="3px solid" borderColor={isOrderLong(order) ? 'trading.long' : 'trading.short'} pl={1.5} ml={-1.5} my={-1}>
                <CryptoIcon
                  symbol={order.symbol}
                  size={14}
                  onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
                  cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                />
                <Text
                  fontWeight="medium"
                  cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                  _hover={onNavigateToSymbol ? { color: 'accent.solid', textDecoration: 'underline' } : undefined}
                  onClick={() => onNavigateToSymbol?.(order.symbol, order.marketType)}
                >
                  {order.symbol}
                </Text>
              </Flex>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              {pnl !== undefined ? (
                <Text fontWeight="medium" color={pnl >= 0 ? 'trading.profit' : 'trading.loss'}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                  {pnlPercent !== undefined && ` (${pnl >= 0 ? '+' : '-'}${Math.abs(pnlPercent).toFixed(2)}%)`}
                </Text>
              ) : '-'}
            </TradingTableCell>
            <TradingTableCell>
              <Badge colorPalette={isOrderLong(order) ? 'green' : 'red'} size="xs">
                {t(`trading.ticket.${isOrderLong(order) ? 'long' : 'short'}`)}
              </Badge>
            </TradingTableCell>
            <TradingTableCell>
              <Badge colorPalette={getStatusColor(order.status)} size="xs">
                {t(`trading.orders.${getStatusTranslationKey(order.status)}`)}
              </Badge>
            </TradingTableCell>
            <TradingTableCell>
              {order.setupType && order.isAutoTrade && order.id && order.symbol ? (
                <StrategyInfoPopover
                  setupType={order.setupType}
                  executionId={order.id}
                  symbol={order.symbol}
                >
                  <Badge colorPalette="purple" size="xs" cursor="pointer">
                    {t(`setups.${order.setupType}`, { defaultValue: order.setupType })}
                  </Badge>
                </StrategyInfoPopover>
              ) : order.setupType ? (
                <Badge colorPalette="purple" size="xs">
                  {t(`setups.${order.setupType}`, { defaultValue: order.setupType })}
                </Badge>
              ) : '-'}
            </TradingTableCell>
            <TradingTableCell>
              {order.marketType === 'FUTURES' ? (
                <Badge colorPalette="orange" size="xs">FUTURES</Badge>
              ) : (
                <Badge colorPalette="gray" size="xs">SPOT</Badge>
              )}
            </TradingTableCell>
            <TradingTableCell>{formatDate(order.createdAt)}</TradingTableCell>
            <TradingTableCell>{formatDate(order.updateTime)}</TradingTableCell>
            <TradingTableCell>{formatDate(order.closedAt)}</TradingTableCell>
            <TradingTableCell textAlign="right">
              {order.status === 'PARTIALLY_FILLED' ? (
                <Text>{parseFloat(order.executedQty).toFixed(8)}/{parseFloat(order.origQty).toFixed(8)}</Text>
              ) : (
                getOrderQuantity(order).toFixed(8)
              )}
            </TradingTableCell>
            <TradingTableCell textAlign="right">{formatPrice(getOrderPrice(order), currency)}</TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="blue.fg">{formatPrice(currentPrice, currency)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="trading.loss">{formatPrice(order.stopLoss, currency)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="trading.profit">{formatPrice(order.takeProfit, currency)}</Text>
            </TradingTableCell>
            <TradingTableCell>
              {order.isAutoTrade && (
                <TooltipWrapper label={t('trading.orders.autoTrade')} showArrow>
                  <Box color="blue.fg"><LuBot size={14} /></Box>
                </TooltipWrapper>
              )}
            </TradingTableCell>
            <TradingTableCell textAlign="center">
              {(canClose || canCancel) && (
                <MenuRoot id={`order-table-menu-${getOrderId(order)}`} positioning={{ placement: 'bottom-end' }}>
                  <MenuTrigger asChild>
                    <IconButton size="xs" variant="ghost" aria-label="Order options">
                      <BsThreeDotsVertical />
                    </IconButton>
                  </MenuTrigger>
                  <Portal>
                    <MenuPositioner>
                      <MenuContent bg="bg.panel" borderColor="border" shadow="lg" minW="120px" zIndex={99999} p={0}>
                        {canClose && (
                          <MenuItem
                            value="close"
                            onClick={() => onClose(getOrderId(order), currentPrice ?? getOrderPrice(order))}
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
                            color="red.fg"
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
});

OrdersTableContent.displayName = 'OrdersTableContent';
