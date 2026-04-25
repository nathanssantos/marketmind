import type { MarketType } from '@marketmind/types';
import { Badge, Button, CryptoIcon, DirectionModeSelector, IconButton, Select, Separator, Slider, TooltipWrapper, type DirectionMode } from '@renderer/components/ui';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendAuth } from '@renderer/hooks/useBackendAuth';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useSignalSuggestions } from '@renderer/hooks/useSignalSuggestions';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from '@renderer/components/Trading/TradingTable';
import { useUIStore } from '@renderer/store/uiStore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuOctagonX, LuPlay, LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { StartWatchersModal } from '@renderer/components/Trading/StartWatchersModal';

interface ActiveWatcher {
  watcherId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
  profileId?: string;
  profileName?: string;
}

const WatchersTabComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { currentUser } = useBackendAuth();
  const { activeWallet } = useActiveWallet();
  const activeWalletId = activeWallet?.id;

  const { watcherStatus, isLoadingWatcherStatus, stopAllWatchers, isStoppingAllWatchers, config, updateConfig, isUpdatingConfig } = useBackendAutoTrading(activeWalletId ?? '');
  const utils = trpc.useUtils();
  const updateConfigFull = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => { void utils.autoTrading.getConfig.invalidate(); },
  });

  const activeWatchers = watcherStatus?.activeWatchers ?? [];
  const directionMode: DirectionMode = (config?.directionMode as DirectionMode) ?? 'auto';

  const [autoTradePercent, setAutoTradePercent] = useState(10);

  useEffect(() => {
    setAutoTradePercent(Number(config?.positionSizePercent ?? 10));
  }, [config?.positionSizePercent]);

  const handleDirectionModeChange = (mode: DirectionMode) => {
    if (!activeWalletId) return;
    void updateConfig({ walletId: activeWalletId, directionMode: mode });
  };

  const handleAutoTradePercentSave = (value: number) => {
    if (!activeWalletId) return;
    updateConfigFull.mutate({ walletId: activeWalletId, positionSizePercent: value.toString() });
  };

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold">
            {t('marketSidebar.watchers.title')}
          </Text>
          <Badge colorPalette="blue" size="xs">
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

      {activeWalletId && (
        <DirectionModeSelector value={directionMode} onChange={handleDirectionModeChange} disabled={isUpdatingConfig} size="2xs" />
      )}

      {activeWalletId && (
        <Box>
          <Flex justify="space-between" align="center" mb={2}>
            <Text fontSize="xs" fontWeight="medium">{t('watcherManager.positionSize.sizePercent')}</Text>
            <Text fontSize="xs" color="fg.muted">{autoTradePercent}%</Text>
          </Flex>
          <Slider
            value={[autoTradePercent]}
            onValueChange={(values) => setAutoTradePercent(values[0] ?? 10)}
            onValueChangeEnd={(values) => handleAutoTradePercentSave(values[0] ?? 10)}
            min={0.3}
            max={100}
            step={0.1}
          />
        </Box>
      )}

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
            variant="outline"
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

      {activeWalletId && <SuggestionsSection walletId={activeWalletId} userId={currentUser?.id?.toString()} />}

      <StartWatchersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Stack>
  );
};

const SuggestionsSection = memo(({ walletId, userId }: { walletId: string; userId?: string }) => {
  const { t } = useTranslation();
  const { suggestions, isLoading, accept, reject, isAccepting, isRejecting } = useSignalSuggestions(walletId, userId);
  const globalActions = useGlobalActionsOptional();

  if (isLoading || suggestions.length === 0) return null;

  return (
    <>
      <Separator />
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold">
            {t('trading.suggestions.title')}
          </Text>
          <Badge colorPalette="yellow" size="xs">
            {suggestions.length}
          </Badge>
        </Flex>
      </Flex>
      <Stack gap={2}>
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onAccept={accept}
            onReject={reject}
            isAccepting={isAccepting}
            isRejecting={isRejecting}
            onNavigate={globalActions?.navigateToSymbol}
          />
        ))}
      </Stack>
    </>
  );
});

SuggestionsSection.displayName = 'SuggestionsSection';

type Suggestion = NonNullable<ReturnType<typeof useSignalSuggestions>['suggestions']>[number];

const formatPrice = (price: string) => {
  const num = Number(price);
  return num >= 1 ? num.toFixed(2) : num.toPrecision(4);
};

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string, positionSizePercent?: number) => Promise<unknown>;
  onReject: (id: string) => Promise<unknown>;
  isAccepting: boolean;
  isRejecting: boolean;
  onNavigate?: (symbol: string, marketType?: MarketType) => void;
}

const SuggestionCard = memo(({ suggestion, onAccept, onReject, isAccepting, isRejecting, onNavigate }: SuggestionCardProps) => {
  const { t } = useTranslation();
  const [sizePercent, setSizePercent] = useState(Number(suggestion.positionSizePercent ?? 10));

  const isLong = suggestion.side === 'LONG';
  const expiresAt = suggestion.expiresAt ? new Date(suggestion.expiresAt) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;

  const handleAccept = useCallback(() => {
    void onAccept(suggestion.id, sizePercent);
  }, [onAccept, suggestion.id, sizePercent]);

  const handleReject = useCallback(() => {
    void onReject(suggestion.id);
  }, [onReject, suggestion.id]);

  return (
    <Box
      bg="bg.muted"
      borderRadius="md"
      p={3}
      borderLeft="3px solid"
      borderLeftColor={isLong ? 'green.500' : 'red.500'}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Flex align="center" gap={2}>
          <CryptoIcon
            symbol={suggestion.symbol}
            size={14}
            onClick={() => onNavigate?.(suggestion.symbol, 'FUTURES')}
            cursor={onNavigate ? 'pointer' : 'default'}
          />
          <Text
            fontWeight="bold"
            fontSize="xs"
            cursor={onNavigate ? 'pointer' : 'default'}
            _hover={onNavigate ? { color: 'blue.500' } : undefined}
            onClick={() => onNavigate?.(suggestion.symbol, 'FUTURES')}
          >
            {suggestion.symbol}
          </Text>
          <Badge colorPalette={isLong ? 'green' : 'red'} size="xs">
            {isLong ? t('common.long') : t('common.short')}
          </Badge>
          <Badge colorPalette="blue" size="xs">{suggestion.interval}</Badge>
        </Flex>
        {isExpired && (
          <Badge colorPalette="orange" size="xs">{t('trading.suggestions.expired')}</Badge>
        )}
      </Flex>

      <Text fontSize="xs" color="fg.muted" mb={1}>{suggestion.setupType}</Text>

      <Flex gap={3} mb={2} wrap="wrap">
        <Box>
          <Text fontSize="2xs" color="fg.muted">{t('common.entry')}</Text>
          <Text fontSize="xs" fontWeight="medium">{formatPrice(suggestion.entryPrice)}</Text>
        </Box>
        {suggestion.stopLoss && (
          <Box>
            <Text fontSize="2xs" color="fg.muted">{t('common.stopLoss')}</Text>
            <Text fontSize="xs" fontWeight="medium" color="red.500">{formatPrice(suggestion.stopLoss)}</Text>
          </Box>
        )}
        {suggestion.takeProfit && (
          <Box>
            <Text fontSize="2xs" color="fg.muted">{t('common.takeProfit')}</Text>
            <Text fontSize="xs" fontWeight="medium" color="green.500">{formatPrice(suggestion.takeProfit)}</Text>
          </Box>
        )}
        {suggestion.riskRewardRatio && (
          <Box>
            <Text fontSize="2xs" color="fg.muted">R:R</Text>
            <Text fontSize="xs" fontWeight="medium">{Number(suggestion.riskRewardRatio).toFixed(1)}</Text>
          </Box>
        )}
      </Flex>

      <Box mb={2}>
        <Flex justify="space-between" align="center" mb={1}>
          <Text fontSize="2xs" color="fg.muted">{t('trading.suggestions.positionSize')}</Text>
          <Text fontSize="2xs" color="fg.muted">{sizePercent}%</Text>
        </Flex>
        <Slider
          value={[sizePercent]}
          onValueChange={(v) => setSizePercent(v[0] ?? 10)}
          min={0.3}
          max={100}
          step={0.1}
        />
      </Box>

      <HStack gap={2}>
        <Button
          size="2xs"
          colorPalette="green"
          onClick={handleAccept}
          loading={isAccepting}
          disabled={isExpired || isRejecting}
          flex={1}
        >
          <LuCheck />
          {t('trading.suggestions.accept')}
        </Button>
        <Button
          size="2xs"
          colorPalette="red"
          variant="outline"
          onClick={handleReject}
          loading={isRejecting}
          disabled={isAccepting}
          flex={1}
        >
          <LuX />
          {t('trading.suggestions.reject')}
        </Button>
      </HStack>
    </Box>
  );
});

SuggestionCard.displayName = 'SuggestionCard';

interface WatchersTableProps {
  watchers: ActiveWatcher[];
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}

const WatchersTable = memo(({ watchers, onNavigateToSymbol }: WatchersTableProps) => {
  const { t } = useTranslation();
  const { profiles, assignToWatcher } = useTradingProfiles();

  const profileOptions = useMemo(() => [
    { value: '', label: t('tradingProfiles.watchers.usingDefault') },
    ...profiles.map((p) => ({ value: p.id, label: p.name })),
  ], [profiles, t]);

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
          return dir * (a.profileName ?? '').localeCompare(b.profileName ?? '');
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
            <Badge colorPalette="blue" size="xs">
              {watcher.interval}
            </Badge>
          </TradingTableCell>
          <TradingTableCell>
            {watcher.marketType === 'FUTURES' ? (
              <Badge colorPalette="orange" size="xs">FUTURES</Badge>
            ) : (
              <Badge colorPalette="gray" size="xs">SPOT</Badge>
            )}
          </TradingTableCell>
          <TradingTableCell>
            <Select
              value={watcher.profileId ?? ''}
              options={profileOptions}
              onChange={(v) => void assignToWatcher(watcher.watcherId, v || null)}
              size="xs"
            />
          </TradingTableCell>
        </TradingTableRow>
      ))}
    </TradingTable>
  );
});

WatchersTable.displayName = 'WatchersTable';

export const WatchersTab = memo(WatchersTabComponent);
