import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { Callout, IconButton, Select } from '@renderer/components/ui';
import { MM } from '@renderer/theme/tokens';
import { BrlValue } from '@renderer/components/BrlValue';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import type { PortfolioFilterOption, PortfolioSortOption } from '@renderer/store/uiStore';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { Group } from '@chakra-ui/react';
import { FuturesPositionsPanel } from './FuturesPositionsPanel';
import { OrphanOrderCard, OrphanOrdersTable } from './OrphanOrders';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioTable } from './PortfolioTable';
import { PositionCard } from './PositionCard';
import type { PortfolioProps } from './portfolioTypes';
import { usePortfolioData } from './usePortfolioData';

const PortfolioComponent = ({ headerContent }: PortfolioProps) => {
  if (perfMonitor.isEnabled()) perfMonitor.recordComponentRender('Portfolio');
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const {
    isIB,
    activeWallet,
    activeWalletId,
    positions,
    filteredPositions,
    stats,
    todayPnl,
    summaryExpanded,
    toggleSummary,
    filterOption,
    setFilterOption,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    effectiveCapital,
    stopProtectedPnl,
    tpProjectedProfit,
    totalExposure,
    totalMargin,
    hasLeverage,
    orphanOrders,
    cancelFuturesOrder,
    toastSuccess,
    toastError,
  } = usePortfolioData();

  const { totalPnL, totalPnLPercent, profitableCount, losingCount } = stats;

  return (
    <Stack gap={MM.spacing.section.gap} p={MM.spacing.dialogPadding}>
      {headerContent}
      {!isIB && <FuturesPositionsPanel />}

      {!activeWallet ? (
        <Callout tone="warning" compact>
          {t('trading.portfolio.noWallet')}
        </Callout>
      ) : (
        <>
          <Flex p={3} bg="bg.muted" borderRadius="md" justify="space-between" align="center" fontSize="xs">
            <Stack gap={0}>
              <Text color="fg.muted" fontWeight="medium">{t('trading.portfolio.dailyPnl')}</Text>
              <Text color="fg.muted" fontSize="2xs">{todayPnl?.tradesCount ?? 0} {t('trading.portfolio.trades')}</Text>
            </Stack>
            <Stack gap={0} align="flex-end">
              <Text fontWeight="medium" fontSize="sm" color={!todayPnl ? 'fg.muted' : todayPnl.pnl >= 0 ? 'green.500' : 'red.500'}>
                {todayPnl ? `${todayPnl.pnl >= 0 ? '+' : ''}${todayPnl.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${todayPnl.pnl >= 0 ? '+' : ''}${todayPnl.pnlPercent.toFixed(2)}%)` : '$0.00'}
              </Text>
              <BrlValue usdtValue={todayPnl?.pnl ?? 0} />
            </Stack>
          </Flex>

          {positions.length === 0 && orphanOrders.length === 0 ? (
            <Box p={4} textAlign="center">
              <Text fontSize="sm" color="fg.muted">
                {t('trading.portfolio.empty')}
              </Text>
            </Box>
          ) : (
          <>
          {positions.length > 0 && (
          <>
          <PortfolioSummary
            expanded={summaryExpanded}
            onToggle={toggleSummary}
            positionsCount={positions.length}
            profitableCount={profitableCount}
            losingCount={losingCount}
            totalPnL={totalPnL}
            totalPnLPercent={totalPnLPercent}
            totalExposure={totalExposure}
            totalMargin={totalMargin}
            hasLeverage={hasLeverage}
            walletBalance={activeWallet.walletBalance}
            currency={activeWallet.currency}
            effectiveCapital={effectiveCapital}
            stopProtectedPnl={stopProtectedPnl}
            tpProjectedProfit={tpProjectedProfit}
          />

          <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
            {t('trading.portfolio.positionsTitle')} ({filteredPositions.length})
          </Text>

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
                <PositionCard key={position.id} position={position} currency={activeWallet.currency} walletBalance={activeWallet.walletBalance} onNavigateToSymbol={globalActions?.navigateToSymbol} />
              ))}
            </Stack>
          ) : (
            <PortfolioTable positions={filteredPositions} currency={activeWallet.currency} walletBalance={activeWallet.walletBalance} onNavigateToSymbol={globalActions?.navigateToSymbol} />
          )}
          </>
          )}

          {orphanOrders.length > 0 && (
            <>
              <Text fontSize="xs" fontWeight="semibold" color="orange.500" textTransform="uppercase" letterSpacing="wide">
                {t('trading.portfolio.orphanOrdersTitle')} ({orphanOrders.length})
              </Text>

              {viewMode === 'cards' ? (
                <Stack gap={2}>
                  {orphanOrders.map((orphan) => (
                    <OrphanOrderCard
                      key={orphan.id}
                      orphan={orphan}
                      onCancel={async () => {
                        try {
                          await cancelFuturesOrder({ walletId: activeWalletId!, symbol: orphan.symbol, orderId: orphan.exchangeOrderId, isAlgo: orphan.isAlgo });
                          toastSuccess(t('trading.portfolio.orphanOrdersCancelSuccess'));
                        } catch {
                          toastError(t('trading.portfolio.orphanOrdersCancelFailed'));
                        }
                      }}
                      onNavigateToSymbol={globalActions?.navigateToSymbol}
                    />
                  ))}
                </Stack>
              ) : (
                <OrphanOrdersTable
                  orphans={orphanOrders}
                  walletId={activeWalletId!}
                  cancelFuturesOrder={cancelFuturesOrder}
                  onNavigateToSymbol={globalActions?.navigateToSymbol}
                />
              )}
            </>
          )}
          </>
          )}
        </>
      )}
    </Stack>
  );
};

export const Portfolio = memo(PortfolioComponent);
