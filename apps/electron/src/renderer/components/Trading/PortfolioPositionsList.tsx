import { Flex, Stack } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { Group } from '@chakra-ui/react';
import { Callout, EmptyState, IconButton, Select } from '@renderer/components/ui';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import type { PortfolioFilterOption, PortfolioSortOption } from '@renderer/store/uiStore';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsGrid, BsTable } from 'react-icons/bs';
import { PortfolioTable } from './PortfolioTable';
import { PositionCard } from './PositionCard';
import { usePortfolioData } from './usePortfolioData';

const PortfolioPositionsListComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const {
    activeWallet,
    filteredPositions,
    positions,
    filterOption,
    setFilterOption,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
  } = usePortfolioData();

  if (!activeWallet) {
    return (
      <Stack gap={2}>
        <Callout tone="warning" compact>
          {t('trading.portfolio.noWallet')}
        </Callout>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {positions.length === 0 ? (
        <EmptyState size="sm" title={t('trading.portfolio.empty')} />
      ) : (
        <>
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
                <PositionCard
                  key={position.id}
                  position={position}
                  currency={activeWallet.currency}
                  walletBalance={activeWallet.walletBalance}
                  onNavigateToSymbol={globalActions?.navigateToSymbol}
                />
              ))}
            </Stack>
          ) : (
            <PortfolioTable
              positions={filteredPositions}
              currency={activeWallet.currency}
              walletBalance={activeWallet.walletBalance}
              onNavigateToSymbol={globalActions?.navigateToSymbol}
            />
          )}
        </>
      )}
    </Stack>
  );
};

export const PortfolioPositionsList = memo(PortfolioPositionsListComponent);
