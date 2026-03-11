import { Badge, Box, Flex, Group, IconButton, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { BrlValue } from '@renderer/components/ui/BrlValue';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { Select } from '@renderer/components/ui/select';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useOrderUpdates } from '@renderer/hooks/useOrderUpdates';
import { usePortfolioFilters } from '@renderer/hooks/usePortfolioFilters';
import { usePositionUpdates } from '@renderer/hooks/usePositionUpdates';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { trpc } from '@renderer/utils/trpc';
import { QUERY_CONFIG } from '@shared/constants';
import { useUIPref } from '@renderer/store/preferencesStore';
import { useUIStore, type PortfolioFilterOption, type PortfolioSortOption } from '@renderer/store/uiStore';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { LuBot, LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { TooltipWrapper } from '../ui/Tooltip';
import { FuturesPositionsPanel } from './FuturesPositionsPanel';
import { StrategyInfoPopover } from './StrategyInfoPopover';
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
  count: number;
}

const PortfolioComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const [summaryExpanded, setSummaryExpanded] = useUIPref('portfolioSummaryExpanded', true);
  const toggleSummary = useCallback(() => setSummaryExpanded(!summaryExpanded), [summaryExpanded, setSummaryExpanded]);

  const { activeWallet: rawActiveWallet, isIB, wallets: backendWallets } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;
  useOrderUpdates(activeWalletId ?? '');
  usePositionUpdates(activeWalletId || '');
  const { tickerPrices } = useBackendTrading(activeWalletId || '', undefined);
  const { data: openTradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: activeWalletId ?? '', status: 'open', limit: 500 },
    { enabled: !!activeWalletId, refetchInterval: QUERY_CONFIG.BACKUP_POLLING_INTERVAL, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );
  const tradeExecutions = openTradeExecutions ?? [];

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
    const openExecutions = tradeExecutions.filter((e) => e.status === 'open');
    const groups = new Map<string, typeof openExecutions>();

    for (const e of openExecutions) {
      const key = `${e.symbol}-${e.side}`;
      const group = groups.get(key) ?? [];
      group.push(e);
      groups.set(key, group);
    }

    return Array.from(groups.values()).flatMap((group) => {
      const primary = group[0];
      if (!primary) return [];
      const totalQty = group.reduce((sum, e) => sum + parseFloat(e.quantity || '0'), 0);
      const avgPrice = group.reduce((sum, e) => sum + parseFloat(e.entryPrice || '0') * parseFloat(e.quantity || '0'), 0) / (totalQty || 1);

      const centralPrice = centralizedPrices[primary.symbol];
      const tickerPrice = tickerPrices[primary.symbol];
      const currentPrice = centralPrice ?? (tickerPrice ? parseFloat(String(tickerPrice)) : avgPrice);

      const pnl = primary.side === 'LONG'
        ? (currentPrice - avgPrice) * totalQty
        : (avgPrice - currentPrice) * totalQty;
      const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 * (primary.leverage || 1) : 0;
      const adjustedPnlPercent = primary.side === 'LONG' ? pnlPercent : -pnlPercent;

      return {
        id: primary.id,
        symbol: primary.symbol,
        side: primary.side,
        quantity: totalQty,
        avgPrice,
        currentPrice,
        pnl,
        pnlPercent: adjustedPnlPercent,
        stopLoss: primary.stopLoss ? parseFloat(primary.stopLoss) : undefined,
        takeProfit: primary.takeProfit ? parseFloat(primary.takeProfit) : undefined,
        setupType: primary.setupType || undefined,
        openedAt: new Date(primary.openedAt),
        status: 'open' as const,
        marketType: primary.marketType || 'FUTURES',
        isAutoTrade: !!primary.setupType,
        count: group.length,
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

  const stopProtectedValue = useMemo(() => {
    let total = 0;
    let positionsWithStops = 0;
    for (const pos of positions) {
      if (!pos.stopLoss) continue;
      positionsWithStops++;
      if (pos.side === 'LONG') {
        total += pos.stopLoss * pos.quantity;
      } else {
        total += (2 * pos.avgPrice - pos.stopLoss) * pos.quantity;
      }
    }
    return { total, positionsWithStops };
  }, [positions]);

  const tpProjectedProfit = useMemo(() => {
    let total = 0;
    let positionsWithTp = 0;
    for (const pos of positions) {
      if (!pos.takeProfit) continue;
      positionsWithTp++;
      if (pos.side === 'LONG') total += (pos.takeProfit - pos.avgPrice) * pos.quantity;
      else total += (pos.avgPrice - pos.takeProfit) * pos.quantity;
    }
    return { total, positionsWithTp };
  }, [positions]);

  const totalExposure = useMemo(
    () => positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0),
    [positions]
  );

  return (
    <Stack gap={3} p={4}>
      {!isIB && <FuturesPositionsPanel />}

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
            <Stack gap={2.5} fontSize="xs">
              {summaryExpanded && (
                <>
                  <Stack gap={1}>
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
                  </Stack>

                  <Box h="1px" w="100%" bg="fg.muted" opacity={0.2} />

                  <Stack gap={1}>
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('trading.portfolio.totalExposure')}</Text>
                      <Stack gap={0} align="flex-end">
                        <Text fontWeight="medium">
                          {activeWallet.currency} {totalExposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({((totalExposure / activeWallet.balance) * 100).toFixed(1)}%)
                        </Text>
                        <BrlValue usdtValue={totalExposure} />
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

                  {(stopProtectedValue.positionsWithStops > 0 || tpProjectedProfit.positionsWithTp > 0) && (
                    <>
                      <Box h="1px" w="100%" bg="fg.muted" opacity={0.2} />

                      <Stack gap={1}>
                        {stopProtectedValue.positionsWithStops > 0 && (
                          <Flex justify="space-between">
                            <Text color="fg.muted" flexShrink={0}>
                              {t('trading.portfolio.stopProtected')} ({stopProtectedValue.positionsWithStops}/{positions.length})
                            </Text>
                            <Stack gap={0} align="flex-end">
                              <Text fontWeight="medium" color="orange.500" textAlign="right">
                                {activeWallet.currency} {stopProtectedValue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                              <Text color="orange.500" textAlign="right">
                                {totalExposure > 0 ? ((stopProtectedValue.total / totalExposure) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.stopProtectedOfExposure')}
                              </Text>
                              <Text color="orange.500" textAlign="right">
                                {activeWallet.balance > 0 ? ((stopProtectedValue.total / activeWallet.balance) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.stopProtectedOfBalance')}
                              </Text>
                              <BrlValue usdtValue={stopProtectedValue.total} />
                            </Stack>
                          </Flex>
                        )}
                        {tpProjectedProfit.positionsWithTp > 0 && (
                          <Flex justify="space-between">
                            <Text color="fg.muted" flexShrink={0}>
                              {t('trading.portfolio.tpProjected')} ({tpProjectedProfit.positionsWithTp}/{positions.length})
                            </Text>
                            <Stack gap={0} align="flex-end">
                              <Text fontWeight="medium" color="green.500" textAlign="right">
                                +{activeWallet.currency} {tpProjectedProfit.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                              <Text color="green.500" textAlign="right">
                                {totalExposure > 0 ? ((tpProjectedProfit.total / totalExposure) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.tpProjectedOfExposure')}
                              </Text>
                              <Text color="green.500" textAlign="right">
                                {activeWallet.balance > 0 ? ((tpProjectedProfit.total / activeWallet.balance) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.tpProjectedOfBalance')}
                              </Text>
                              <BrlValue usdtValue={tpProjectedProfit.total} />
                            </Stack>
                          </Flex>
                        )}
                      </Stack>
                    </>
                  )}
                </>
              )}

              {!summaryExpanded && (
                <Flex justify="space-between" align="center">
                  <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
                  <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                  </Text>
                </Flex>
              )}

              <Flex justify="center">
                <IconButton
                  aria-label={summaryExpanded ? 'Collapse' : 'Expand'}
                  size="2xs"
                  variant="ghost"
                  colorPalette="gray"
                  h="14px"
                  w="100%"
                  onClick={toggleSummary}
                >
                  {summaryExpanded ? <LuChevronUp /> : <LuChevronDown />}
                </IconButton>
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
    </Stack>
  );
};

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
          {position.count > 1 && (
            <Badge colorPalette="yellow" size="xs" px={1}>
              {t('trading.portfolio.entriesCount', { count: position.count })}
            </Badge>
          )}
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
