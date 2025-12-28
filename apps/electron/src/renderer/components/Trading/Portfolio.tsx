import { Badge, Box, Flex, Group, IconButton, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { Select } from '@renderer/components/ui/select';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useOrderUpdates } from '@renderer/hooks/useOrderUpdates';
import { usePortfolioFilters } from '@renderer/hooks/usePortfolioFilters';
import { usePositionUpdates } from '@renderer/hooks/usePositionUpdates';
import { type PortfolioFilterOption, type PortfolioSortOption, useUIStore } from '@renderer/store/uiStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { LuBot } from 'react-icons/lu';
import { FuturesPositionsPanel } from './FuturesPositionsPanel';

interface PortfolioPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  setupType?: string;
  openedAt: Date;
  id: string;
  status: 'open' | 'pending';
  limitEntryPrice?: number;
  expiresAt?: Date;
  marketType?: 'SPOT' | 'FUTURES';
  isAutoTrade?: boolean;
}

const PortfolioComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const { wallets: backendWallets } = useBackendWallet();
  const activeWalletId = backendWallets[0]?.id;
  useOrderUpdates(activeWalletId ?? '');
  usePositionUpdates(activeWalletId || '');
  const { tradeExecutions, tickerPrices } = useBackendTrading(activeWalletId || '', undefined);

  const filterOption = useUIStore((s) => s.portfolioFilterOption);
  const setFilterOption = useUIStore((s) => s.setPortfolioFilterOption);
  const sortBy = useUIStore((s) => s.portfolioSortBy);
  const setSortBy = useUIStore((s) => s.setPortfolioSortBy);
  const viewMode = useUIStore((s) => s.portfolioViewMode);
  const setViewMode = useUIStore((s) => s.setPortfolioViewMode);

  const centralizedPrices = usePriceStore((s) => s.prices);

  const positions: PortfolioPosition[] = useMemo(() => {
    return tradeExecutions
      .filter((e) => e.status === 'open')
      .map((e) => {
        const entryPrice = parseFloat(e.entryPrice || '0');
        const quantity = parseFloat(e.quantity || '0');

        const centralPrice = centralizedPrices[e.symbol]?.price;
        const tickerPrice = tickerPrices[e.symbol];
        const currentPrice = centralPrice ?? (tickerPrice ? parseFloat(String(tickerPrice)) : entryPrice);

        let pnl = 0;
        if (e.side === 'LONG') {
          pnl = (currentPrice - entryPrice) * quantity;
        } else {
          pnl = (entryPrice - currentPrice) * quantity;
        }
        const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
        const adjustedPnlPercent = e.side === 'LONG' ? pnlPercent : -pnlPercent;

        return {
          id: e.id,
          symbol: e.symbol,
          side: e.side,
          quantity,
          avgPrice: entryPrice,
          currentPrice,
          pnl,
          pnlPercent: adjustedPnlPercent,
          stopLoss: e.stopLoss ? parseFloat(e.stopLoss) : undefined,
          takeProfit: e.takeProfit ? parseFloat(e.takeProfit) : undefined,
          setupType: e.setupType || undefined,
          openedAt: new Date(e.openedAt),
          status: 'open',
          marketType: e.marketType || 'SPOT',
          isAutoTrade: true,
        };
      });
  }, [tradeExecutions, tickerPrices, centralizedPrices]);

  const wallets = backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance || '0'),
    initialBalance: parseFloat(w.initialBalance || '0'),
    currency: (w.currency || 'USDT'),
    createdAt: new Date(w.createdAt),
  }));

  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  const { positions: filteredPositions, stats } = usePortfolioFilters(positions, filterOption, sortBy);

  const { totalPnL, totalPnLPercent, profitableCount, losingCount } = stats;

  return (
    <Stack gap={3} p={4}>
      <FuturesPositionsPanel />

      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.portfolio.title')}
        </Text>
      </Flex>

      {!activeWallet ? (
        <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
          <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
            {t('trading.portfolio.noWallet')}
          </Text>
        </Box>
      ) : positions.length === 0 ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="fg.muted">
            {t('trading.portfolio.empty')}
          </Text>
        </Box>
      ) : (
        <>
          <Box p={3} bg="bg.muted" borderRadius="md">
            <Stack gap={1} fontSize="xs">
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.activePositions')}</Text>
                <Text fontWeight="medium">{positions.length}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.profitable')}</Text>
                <Text fontWeight="medium" color="green.500">{profitableCount}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.losing')}</Text>
                <Text fontWeight="medium" color="red.500">{losingCount}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.totalExposure')}</Text>
                <Text fontWeight="medium">
                  {activeWallet.currency} {positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}
                  <Text as="span" color="fg.muted" fontSize="2xs">
                    ({((positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0) / activeWallet.balance) * 100).toFixed(1)}%)
                  </Text>
                </Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
                <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                </Text>
              </Flex>
            </Stack>
          </Box>

          <Flex gap={2} align="flex-end">
            <ChakraField.Root flex={1}>
              <ChakraField.Label fontSize="xs">{t('trading.portfolio.filterBy')}</ChakraField.Label>
              <Select
                size="xs"
                value={filterOption}
                onChange={(value) => setFilterOption(value as PortfolioFilterOption)}
                options={[
                  { value: 'all', label: t('trading.portfolio.filterAll') },
                  { value: 'long', label: t('trading.portfolio.filterLong') },
                  { value: 'short', label: t('trading.portfolio.filterShort') },
                  { value: 'profitable', label: t('trading.portfolio.filterProfitable') },
                  { value: 'losing', label: t('trading.portfolio.filterLosing') },
                ]}
                usePortal
              />
            </ChakraField.Root>

            {viewMode === 'cards' && (
              <ChakraField.Root flex={1}>
                <ChakraField.Label fontSize="xs">{t('trading.portfolio.sortBy')}</ChakraField.Label>
                <Select
                  size="xs"
                  value={sortBy}
                  onChange={(value) => setSortBy(value as PortfolioSortOption)}
                  options={[
                    { value: 'pnl-desc', label: t('trading.portfolio.sortPnlDesc') },
                    { value: 'pnl-asc', label: t('trading.portfolio.sortPnlAsc') },
                    { value: 'newest', label: t('trading.portfolio.sortNewest') },
                    { value: 'oldest', label: t('trading.portfolio.sortOldest') },
                    { value: 'symbol-asc', label: t('trading.portfolio.sortSymbolAsc') },
                    { value: 'symbol-desc', label: t('trading.portfolio.sortSymbolDesc') },
                    { value: 'exposure-desc', label: t('trading.portfolio.sortExposureDesc') },
                    { value: 'exposure-asc', label: t('trading.portfolio.sortExposureAsc') },
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

          {viewMode === 'cards' ? (
            <Stack gap={2}>
              {filteredPositions.map((position) => (
                <PositionCard key={position.id} position={position} currency={activeWallet.currency} onNavigateToSymbol={globalActions?.navigateToSymbol} />
              ))}
            </Stack>
          ) : (
            <PortfolioTable positions={filteredPositions} currency={activeWallet.currency} onNavigateToSymbol={globalActions?.navigateToSymbol} />
          )}
        </>
      )}
    </Stack>
  );
};

interface PortfolioTableProps {
  positions: PortfolioPosition[];
  currency: string;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const PortfolioTable = ({ positions, currency, onNavigateToSymbol }: PortfolioTableProps) => {
  const { t } = useTranslation();
  const sortKey = useUIStore((s) => s.portfolioTableSortKey);
  const sortDirection = useUIStore((s) => s.portfolioTableSortDirection);
  const setPortfolioTableSort = useUIStore((s) => s.setPortfolioTableSort);

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
    { key: 'symbol', header: t('trading.orders.symbol'), sticky: true, minW: '100px' },
    { key: 'pnl', header: t('trading.portfolio.pnl'), textAlign: 'right', minW: '130px' },
    { key: 'side', header: t('trading.orders.side'), minW: '80px' },
    { key: 'type', header: t('trading.orders.type'), minW: '90px' },
    { key: 'setup', header: t('trading.orders.setup'), minW: '100px' },
    { key: 'opened', header: t('trading.portfolio.opened'), minW: '110px' },
    { key: 'quantity', header: t('trading.portfolio.quantity'), textAlign: 'right', minW: '100px' },
    { key: 'avgPrice', header: t('trading.portfolio.avgPrice'), textAlign: 'right', minW: '110px' },
    { key: 'currentPrice', header: t('trading.portfolio.currentPrice'), textAlign: 'right', minW: '110px' },
    { key: 'stopLoss', header: t('trading.orders.stopLoss'), textAlign: 'right', minW: '100px' },
    { key: 'takeProfit', header: t('trading.orders.takeProfit'), textAlign: 'right', minW: '100px' },
  ];

  return (
    <TradingTable columns={columns} minW="1100px" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>
      {sortedPositions.map((position) => {
        const isProfitable = position.pnl >= 0;
        const isLong = position.side === 'LONG';

        return (
          <TradingTableRow key={position.id}>
            <TradingTableCell sticky>
              <Flex align="center" gap={1}>
                {position.isAutoTrade && <LuBot size={12} />}
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
            <TradingTableCell>
              <Badge colorPalette={isLong ? 'green' : 'red'} size="sm" px={2}>
                {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
              </Badge>
            </TradingTableCell>
            <TradingTableCell>
              {position.marketType === 'FUTURES' ? (
                <Badge colorPalette="orange" size="sm" px={2}>FUTURES</Badge>
              ) : (
                <Badge colorPalette="gray" size="sm" px={2}>SPOT</Badge>
              )}
            </TradingTableCell>
            <TradingTableCell>
              {position.setupType ? (
                <Badge colorPalette="purple" size="sm" px={2}>{position.setupType}</Badge>
              ) : '-'}
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
          </TradingTableRow>
        );
      })}
    </TradingTable>
  );
};

interface PositionCardProps {
  position: PortfolioPosition;
  currency: string;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const PositionCard = ({ position, currency, onNavigateToSymbol }: PositionCardProps) => {
  const { t } = useTranslation();
  const isProfitable = position.pnl >= 0;
  const isLong = position.side === 'LONG';

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isLong ? 'green.500' : 'red.500'}
    >
      <Stack gap={1.5} mb={2}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={1.5}>
            {position.isAutoTrade && (
              <Box title={t('trading.orders.autoTrade')}>
                <LuBot size={14} />
              </Box>
            )}
            <Text
              fontWeight="bold"
              fontSize="sm"
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
              onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
            >
              {position.symbol}
            </Text>
          </Flex>
          <Text fontSize="xs" color="fg.muted">
            {position.openedAt.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Flex>
        <Flex gap={2} align="center" flexWrap="wrap">
          <Badge colorPalette={isLong ? 'green' : 'red'} size="sm" px={2}>
            {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
          </Badge>
          {position.marketType === 'FUTURES' && (
            <Badge colorPalette="orange" size="sm" px={2}>
              FUTURES
            </Badge>
          )}
          {position.setupType && (
            <Badge colorPalette="purple" size="sm" px={2}>
              {position.setupType}
            </Badge>
          )}
        </Flex>
      </Stack>

      <Stack gap={1} fontSize="xs">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.quantity')}</Text>
          <Text fontWeight="medium">{position.quantity.toFixed(8)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.avgPrice')}</Text>
          <Text>{currency} {position.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.currentPrice')}</Text>
          <Text fontWeight="medium">{currency} {position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Flex>
        {position.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Text color="red.500">{currency} {position.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Flex>
        )}
        {position.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Text color="green.500">{currency} {position.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Flex>
        )}
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.pnl')}</Text>
          <Text fontWeight="medium" color={isProfitable ? 'green.500' : 'red.500'}>
            {isProfitable ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
};

export const Portfolio = memo(PortfolioComponent);
