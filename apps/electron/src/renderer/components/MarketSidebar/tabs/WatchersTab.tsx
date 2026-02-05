import { Badge, Box, Button, Flex, IconButton, Stack, Text } from '@chakra-ui/react';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { TooltipWrapper } from '@renderer/components/ui/Tooltip';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from '@renderer/components/Trading/TradingTable';
import { useUIStore } from '@renderer/store/uiStore';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuOctagonX, LuPlay } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { StartWatchersModal } from '@renderer/components/Trading/StartWatchersModal';

interface ActiveWatcher {
  watcherId: string;
  symbol: string;
  interval: string;
  marketType: 'SPOT' | 'FUTURES';
  profileId?: string;
  profileName?: string;
}

const WatchersTabComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { activeWallet } = useActiveWallet();
  const activeWalletId = activeWallet?.id;

  const { watcherStatus, isLoadingWatcherStatus, stopAllWatchers, isStoppingAllWatchers } = useBackendAutoTrading(activeWalletId || '');

  const activeWatchers = watcherStatus?.activeWatchers ?? [];

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold">
            {t('marketSidebar.watchers.title')}
          </Text>
          <Badge colorPalette="blue" size="xs" px={1}>
            {activeWatchers.length}
          </Badge>
        </Flex>
        <Flex gap={1}>
          <TooltipWrapper label={t('marketSidebar.watchers.startWatchers')} showArrow placement="top">
            <IconButton
              size="2xs"
              aria-label={t('marketSidebar.watchers.startWatchers')}
              onClick={() => setIsModalOpen(true)}
              colorPalette="green"
              variant="solid"
            >
              <LuPlay />
            </IconButton>
          </TooltipWrapper>
        </Flex>
      </Flex>

      {!activeWalletId ? (
        <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
          <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
            {t('trading.portfolio.noWallet')}
          </Text>
        </Box>
      ) : isLoadingWatcherStatus ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="fg.muted">{t('common.loading')}</Text>
        </Box>
      ) : activeWatchers.length === 0 ? (
        <Box p={4} textAlign="center" bg="bg.muted" borderRadius="md">
          <Text fontSize="sm" color="fg.muted">
            {t('marketSidebar.watchers.empty')}
          </Text>
          <Button
            size="sm"
            colorPalette="blue"
            mt={3}
            px={4}
            onClick={() => setIsModalOpen(true)}
          >
            <LuPlay />
            {t('marketSidebar.watchers.startWatchers')}
          </Button>
        </Box>
      ) : (
        <>
          <WatchersTable
            watchers={activeWatchers}
            onNavigateToSymbol={globalActions?.navigateToSymbol}
          />

          <Flex gap={2} mt={2}>
            <Button
              size="xs"
              colorPalette="red"
              variant="outline"
              onClick={() => void stopAllWatchers()}
              loading={isStoppingAllWatchers}
              flex={1}
            >
              <LuOctagonX />
              {t('marketSidebar.watchers.stopAll')}
            </Button>
          </Flex>
        </>
      )}

      <StartWatchersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Stack>
  );
};

interface WatchersTableProps {
  watchers: ActiveWatcher[];
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const WatchersTable = memo(({ watchers, onNavigateToSymbol }: WatchersTableProps) => {
  const { t } = useTranslation();
  const { sortKey, sortDirection, setWatchersTableSort } = useUIStore(
    useShallow((s) => ({
      sortKey: s.watchersTableSortKey,
      sortDirection: s.watchersTableSortDirection,
      setWatchersTableSort: s.setWatchersTableSort,
    }))
  );

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
    <TradingTable
      columns={columns}
      minW="450px"
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
    >
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

export const WatchersTab = memo(WatchersTabComponent);
