import { Badge, Box, Flex, Group, IconButton, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { BrlValue } from '@renderer/components/ui/BrlValue';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { Select } from '@renderer/components/ui/select';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useOrderUpdates } from '@renderer/hooks/useOrderUpdates';
import { usePortfolioFilters } from '@renderer/hooks/usePortfolioFilters';
import { usePositionUpdates } from '@renderer/hooks/usePositionUpdates';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { useUIStore, type PortfolioFilterOption, type PortfolioSortOption } from '@renderer/store/uiStore';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { LuBot } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { TooltipWrapper } from '../ui/Tooltip';
import { AutoTradeConsole } from './AutoTradeConsole';
import { FuturesPositionsPanel } from './FuturesPositionsPanel';
import { StrategyInfoPopover } from './StrategyInfoPopover';
import { TradingProfilesModal } from './TradingProfilesModal';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';

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
  const { watcherStatus, isLoadingWatcherStatus } = useBackendAutoTrading(activeWalletId || '');

  const {
    filterOption,
    setFilterOption,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
  } = useUIStore(useShallow((s) => ({
    filterOption: s.portfolioFilterOption,
    setFilterOption: s.setPortfolioFilterOption,
    sortBy: s.portfolioSortBy,
    setSortBy: s.setPortfolioSortBy,
    viewMode: s.portfolioViewMode,
    setViewMode: s.setPortfolioViewMode,
  })));

  const openExecutionSymbols = useMemo(
    () => [...new Set(tradeExecutions.filter((e) => e.status === 'open').map((e) => e.symbol))],
    [tradeExecutions]
  );
  const centralizedPrices = usePricesForSymbols(openExecutionSymbols);

  const positions: PortfolioPosition[] = useMemo(() => {
    return tradeExecutions
      .filter((e) => e.status === 'open')
      .map((e) => {
        const entryPrice = parseFloat(e.entryPrice || '0');
        const quantity = parseFloat(e.quantity || '0');

        const centralPrice = centralizedPrices[e.symbol];
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
    totalDeposits: parseFloat(w.totalDeposits || '0'),
    totalWithdrawals: parseFloat(w.totalWithdrawals || '0'),
    currency: (w.currency || 'USDT'),
    createdAt: new Date(w.createdAt),
  }));

  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  const { positions: filteredPositions, stats } = usePortfolioFilters(positions, filterOption, sortBy);

  const { totalPnL, totalPnLPercent, profitableCount, losingCount } = stats;

  const effectiveCapital = activeWallet
    ? activeWallet.initialBalance + activeWallet.totalDeposits - activeWallet.totalWithdrawals
    : 0;

  const activeWatchers = watcherStatus?.activeWatchers ?? [];

  return (
    <Stack gap={3} p={4}>
      <FuturesPositionsPanel />

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
                <Stack gap={0} align="flex-end">
                  <Text fontWeight="medium">
                    {activeWallet.currency} {positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({((positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0) / activeWallet.balance) * 100).toFixed(1)}%)
                  </Text>
                  <BrlValue usdtValue={positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0)} />
                </Stack>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
                <Stack gap={0} align="flex-end">
                  <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                  </Text>
                  <BrlValue usdtValue={totalPnL} />
                </Stack>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.pnlVsBalance')}</Text>
                <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                  {totalPnL >= 0 ? '+' : ''}{effectiveCapital > 0 ? ((totalPnL / effectiveCapital) * 100).toFixed(2) : '0.00'}%
                </Text>
              </Flex>
            </Stack>
          </Box>

          <Flex gap={2} align="center">
            <ChakraField.Root flex={1}>
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

      {activeWatchers.length > 0 && (
        <WatchersSection
          watchers={activeWatchers}
          isLoading={isLoadingWatcherStatus}
          onNavigateToSymbol={globalActions?.navigateToSymbol}
        />
      )}

      {activeWalletId && (
        <AutoTradeConsole walletId={activeWalletId} hasActiveWatchers={activeWatchers.length > 0} />
      )}
    </Stack>
  );
};

interface ActiveWatcher {
  watcherId: string;
  symbol: string;
  interval: string;
  marketType: 'SPOT' | 'FUTURES';
  profileId?: string;
  profileName?: string;
}

interface WatchersSectionProps {
  watchers: ActiveWatcher[];
  isLoading: boolean;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const WatchersSection = memo(({ watchers, isLoading, onNavigateToSymbol }: WatchersSectionProps) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isLoading) return null;

  return (
    <>
      <Flex justify="space-between" align="center" mb={1}>
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold">
            {t('tradingProfiles.watchers.title')}
          </Text>
          <Badge colorPalette="blue" size="xs" px={1}>{watchers.length}</Badge>
        </Flex>
        <TooltipWrapper label={t('tradingProfiles.modalTitle')} showArrow placement="top">
          <IconButton
            size="2xs"
            aria-label={t('tradingProfiles.modalTitle')}
            onClick={() => setIsModalOpen(true)}
            colorPalette="blue"
            variant="solid"
          >
            <LuBot />
          </IconButton>
        </TooltipWrapper>
      </Flex>

      <WatchersTable watchers={watchers} onNavigateToSymbol={onNavigateToSymbol} />

      <TradingProfilesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
});

WatchersSection.displayName = 'WatchersSection';

interface WatchersTableProps {
  watchers: ActiveWatcher[];
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const WatchersTable = memo(({ watchers, onNavigateToSymbol }: WatchersTableProps) => {
  const { t } = useTranslation();
  const { sortKey, sortDirection, setWatchersTableSort } = useUIStore(useShallow((s) => ({
    sortKey: s.watchersTableSortKey,
    sortDirection: s.watchersTableSortDirection,
    setWatchersTableSort: s.setWatchersTableSort,
  })));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setWatchersTableSort(key, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setWatchersTableSort(key, 'asc');
    }
  };

  const sortedWatchers = useMemo(() => {
    return [...watchers].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'symbol':
          return dir * a.symbol.localeCompare(b.symbol);
        case 'interval':
          return dir * a.interval.localeCompare(b.interval);
        case 'type':
          return dir * a.marketType.localeCompare(b.marketType);
        case 'profile':
          return dir * (a.profileName || '').localeCompare(b.profileName || '');
        default:
          return 0;
      }
    });
  }, [watchers, sortKey, sortDirection]);

  const columns: TradingTableColumn[] = [
    { key: 'symbol', header: t('trading.orders.symbol'), sticky: true, minW: '100px' },
    { key: 'interval', header: t('tradingProfiles.watchers.interval'), minW: '80px' },
    { key: 'type', header: t('trading.orders.type'), minW: '90px' },
    { key: 'profile', header: t('tradingProfiles.watchers.profile'), minW: '150px' },
  ];

  return (
    <TradingTable columns={columns} minW="450px" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>
      {sortedWatchers.map((watcher) => (
        <TradingTableRow key={watcher.watcherId}>
          <TradingTableCell sticky>
            <Flex align="center" gap={1}>
              <CryptoIcon
                symbol={watcher.symbol}
                size={14}
                onClick={() => onNavigateToSymbol?.(watcher.symbol, watcher.marketType)}
                cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              />
              <Text
                fontWeight="medium"
                cursor={onNavigateToSymbol ? 'pointer' : 'default'}
                _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
                onClick={() => onNavigateToSymbol?.(watcher.symbol, watcher.marketType)}
              >
                {watcher.symbol}
              </Text>
            </Flex>
          </TradingTableCell>
          <TradingTableCell>
            <Badge colorPalette="blue" size="xs" px={1}>
              {watcher.interval}
            </Badge>
          </TradingTableCell>
          <TradingTableCell>
            {watcher.marketType === 'FUTURES' ? (
              <Badge colorPalette="orange" size="xs" px={1}>FUTURES</Badge>
            ) : (
              <Badge colorPalette="gray" size="xs" px={1}>SPOT</Badge>
            )}
          </TradingTableCell>
          <TradingTableCell>
            <Text fontSize="xs" color="fg.muted">
              {watcher.profileName || t('tradingProfiles.watchers.usingDefault')}
            </Text>
          </TradingTableCell>
        </TradingTableRow>
      ))}
    </TradingTable>
  );
});

WatchersTable.displayName = 'WatchersTable';

interface PortfolioTableProps {
  positions: PortfolioPosition[];
  currency: string;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const PortfolioTable = memo(({ positions, currency, onNavigateToSymbol }: PortfolioTableProps) => {
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
    { key: 'setup', header: t('trading.orders.setup'), minW: '100px' },
    { key: 'type', header: t('trading.orders.type'), minW: '90px' },
    { key: 'opened', header: t('trading.portfolio.opened'), minW: '110px' },
    { key: 'quantity', header: t('trading.portfolio.quantity'), textAlign: 'right', minW: '100px' },
    { key: 'avgPrice', header: t('trading.portfolio.avgPrice'), textAlign: 'right', minW: '110px' },
    { key: 'currentPrice', header: t('trading.portfolio.currentPrice'), textAlign: 'right', minW: '110px' },
    { key: 'stopLoss', header: t('trading.orders.stopLoss'), textAlign: 'right', minW: '100px' },
    { key: 'takeProfit', header: t('trading.orders.takeProfit'), textAlign: 'right', minW: '100px' },
    { key: 'auto', header: '', minW: '40px', sortable: false },
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
            <TradingTableCell>
              <Badge colorPalette={isLong ? 'green' : 'red'} size="xs" px={1}>
                {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
              </Badge>
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
});

PortfolioTable.displayName = 'PortfolioTable';

interface PositionCardProps {
  position: PortfolioPosition;
  currency: string;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const PositionCard = memo(({ position, currency, onNavigateToSymbol }: PositionCardProps) => {
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
            <CryptoIcon
              symbol={position.symbol}
              size={16}
              onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
            />
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
          <Badge colorPalette={isLong ? 'green' : 'red'} size="xs" px={1}>
            {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
          </Badge>
          {position.isAutoTrade && (
            <Badge colorPalette="blue" size="xs" px={1}>
              <Flex align="center" gap={1}>
                <LuBot size={10} />
                AUTO
              </Flex>
            </Badge>
          )}
          {position.marketType === 'FUTURES' && (
            <Badge colorPalette="orange" size="xs" px={1}>
              FUTURES
            </Badge>
          )}
          {position.setupType && (
            position.isAutoTrade ? (
              <StrategyInfoPopover
                setupType={position.setupType}
                executionId={position.id}
                symbol={position.symbol}
              >
                <Badge colorPalette="purple" size="xs" px={1}>
                  {position.setupType}
                </Badge>
              </StrategyInfoPopover>
            ) : (
              <Badge colorPalette="purple" size="xs" px={1}>
                {position.setupType}
              </Badge>
            )
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
          <Stack gap={0} align="flex-end">
            <Text>{currency} {position.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <BrlValue usdtValue={position.avgPrice} />
          </Stack>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.currentPrice')}</Text>
          <Stack gap={0} align="flex-end">
            <Text fontWeight="medium">{currency} {position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <BrlValue usdtValue={position.currentPrice} />
          </Stack>
        </Flex>
        {position.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="red.500">{currency} {position.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={position.stopLoss} />
            </Stack>
          </Flex>
        )}
        {position.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="green.500">{currency} {position.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={position.takeProfit} />
            </Stack>
          </Flex>
        )}
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.pnl')}</Text>
          <Stack gap={0} align="flex-end">
            <Text fontWeight="medium" color={isProfitable ? 'green.500' : 'red.500'}>
              {isProfitable ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
            </Text>
            <BrlValue usdtValue={position.pnl} />
          </Stack>
        </Flex>
      </Stack>
    </Box>
  );
});

PositionCard.displayName = 'PositionCard';

export const Portfolio = memo(PortfolioComponent);
