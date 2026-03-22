import { Box, Flex, Text } from '@chakra-ui/react';
import { Badge, CryptoIcon, TooltipWrapper } from '@renderer/components/ui';
import { useUIStore } from '@renderer/store/uiStore';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBot } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { StrategyInfoPopover } from './StrategyInfoPopover';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';
import type { NavigateToSymbol, PortfolioPosition } from './portfolioTypes';

interface PortfolioTableProps {
  positions: PortfolioPosition[];
  currency: string;
  walletBalance: number;
  onNavigateToSymbol?: NavigateToSymbol;
}

const PortfolioTableComponent = ({ positions, currency, walletBalance, onNavigateToSymbol }: PortfolioTableProps) => {
  const { t } = useTranslation();
  const { sortKey, sortDirection, setPortfolioTableSort } = useUIStore(useShallow((s) => ({
    sortKey: s.portfolioTableSortKey,
    sortDirection: s.portfolioTableSortDirection,
    setPortfolioTableSort: s.setPortfolioTableSort,
  })));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setPortfolioTableSort(key, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPortfolioTableSort(key, 'desc');
    }
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'symbol':
          return dir * a.symbol.localeCompare(b.symbol);
        case 'pnl':
          return dir * (a.pnl - b.pnl);
        case 'side':
          return dir * a.side.localeCompare(b.side);
        case 'type':
          return dir * ((a.marketType || '').localeCompare(b.marketType || ''));
        case 'setup':
          return dir * ((a.setupType || '').localeCompare(b.setupType || ''));
        case 'opened':
          return dir * (a.openedAt.getTime() - b.openedAt.getTime());
        case 'quantity':
          return dir * (a.quantity - b.quantity);
        case 'avgPrice':
          return dir * (a.avgPrice - b.avgPrice);
        case 'currentPrice':
          return dir * (a.currentPrice - b.currentPrice);
        case 'stopLoss':
          return dir * ((a.stopLoss || 0) - (b.stopLoss || 0));
        case 'takeProfit':
          return dir * ((a.takeProfit || 0) - (b.takeProfit || 0));
        case 'exposure':
          return dir * ((a.avgPrice * a.quantity) - (b.avgPrice * b.quantity));
        default:
          return 0;
      }
    });
  }, [positions, sortKey, sortDirection]);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    return `${currency} ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: TradingTableColumn[] = [
    { key: 'symbol', header: t('trading.orders.symbol'), sticky: true },
    { key: 'pnl', header: t('trading.portfolio.pnl'), textAlign: 'right' },
    { key: 'exposure', header: t('trading.portfolio.exposure'), textAlign: 'right' },
    { key: 'side', header: t('trading.orders.side') },
    { key: 'setup', header: t('trading.orders.setup') },
    { key: 'type', header: t('trading.orders.type') },
    { key: 'opened', header: t('trading.portfolio.opened') },
    { key: 'quantity', header: t('trading.portfolio.quantity'), textAlign: 'right' },
    { key: 'avgPrice', header: t('trading.portfolio.avgPrice'), textAlign: 'right' },
    { key: 'currentPrice', header: t('trading.portfolio.currentPrice'), textAlign: 'right' },
    { key: 'stopLoss', header: t('trading.orders.stopLoss'), textAlign: 'right' },
    { key: 'takeProfit', header: t('trading.orders.takeProfit'), textAlign: 'right' },
    { key: 'auto', header: '', sortable: false },
  ];

  return (
    <TradingTable columns={columns} minW="1100px" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>
      {sortedPositions.map((position) => {
        const isProfitable = position.pnl >= 0;
        const isLong = position.side === 'LONG';

        return (
          <TradingTableRow key={position.id}>
            <TradingTableCell sticky>
              <Flex align="center" gap={1} borderLeft="3px solid" borderColor={isLong ? 'green.500' : 'red.500'} pl={1.5} ml={-1.5} my={-1}>
                <CryptoIcon
                  symbol={position.symbol}
                  size={14}
                  onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
                  cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                />
                <Text
                  fontWeight="medium"
                  cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                  _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
                  onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
                >
                  {position.symbol}
                </Text>
              </Flex>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontWeight="medium" color={isProfitable ? 'green.500' : 'red.500'}>
                {isProfitable ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {' '}({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
              </Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Flex align="center" gap={1} justify="flex-end">
                <Text color="fg.muted">
                  {walletBalance > 0 ? ((position.avgPrice * position.quantity / walletBalance) * 100).toFixed(1) : '0.0'}%
                </Text>
                {position.leverage > 1 && (
                  <Badge colorPalette="purple" size="xs" px={1}>{position.leverage}x</Badge>
                )}
              </Flex>
            </TradingTableCell>
            <TradingTableCell>
              <Flex align="center" gap={1}>
                <Badge colorPalette={isLong ? 'green' : 'red'} size="xs" px={1}>
                  {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
                </Badge>
                {position.count > 1 && (
                  <Badge colorPalette="yellow" size="xs" px={1}>
                    {t('trading.portfolio.entriesCount', { count: position.count })}
                  </Badge>
                )}
              </Flex>
            </TradingTableCell>
            <TradingTableCell>
              {position.setupType ? (
                position.isAutoTrade ? (
                  <StrategyInfoPopover
                    setupType={position.setupType}
                    executionId={position.id}
                    symbol={position.symbol}
                  >
                    <Badge colorPalette="purple" size="xs" px={1}>{position.setupType}</Badge>
                  </StrategyInfoPopover>
                ) : (
                  <Badge colorPalette="purple" size="xs" px={1}>{position.setupType}</Badge>
                )
              ) : '-'}
            </TradingTableCell>
            <TradingTableCell>
              {position.marketType === 'FUTURES' ? (
                <Badge colorPalette="orange" size="xs" px={1}>FUTURES</Badge>
              ) : (
                <Badge colorPalette="gray" size="xs" px={1}>SPOT</Badge>
              )}
            </TradingTableCell>
            <TradingTableCell>
              <Text color="fg.muted">
                {position.openedAt.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">{position.quantity.toFixed(8)}</TradingTableCell>
            <TradingTableCell textAlign="right">{formatPrice(position.avgPrice)}</TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontWeight="medium">{formatPrice(position.currentPrice)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="red.500">{formatPrice(position.stopLoss)}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color="green.500">{formatPrice(position.takeProfit)}</Text>
            </TradingTableCell>
            <TradingTableCell>
              {position.isAutoTrade && (
                <TooltipWrapper label={t('trading.orders.autoTrade')} showArrow>
                  <Box color="blue.500"><LuBot size={14} /></Box>
                </TooltipWrapper>
              )}
            </TradingTableCell>
          </TradingTableRow>
        );
      })}
    </TradingTable>
  );
};

export const PortfolioTable = memo(PortfolioTableComponent);
