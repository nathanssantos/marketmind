import { Dialog } from '@/renderer/components/ui/dialog';
import { Box, CloseButton, Flex, Group, HStack, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { TimeframeSelector } from '@renderer/components/Chart/TimeframeSelector';
import type { DirectionMode } from '@renderer/components/Trading/WatcherManager/WatchersList';
import { useBackendAutoTrading, useCapitalLimits, useFilteredSymbolsForQuickStart } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useDebounce } from '@renderer/hooks/useDebounce';
import { trpc } from '@renderer/utils/trpc';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuPlay, LuSettings, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { DirectionBadge } from './DirectionBadge';

interface StartWatchersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartWatchersModal = memo(({ isOpen, onClose }: StartWatchersModalProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id ?? '';

  const [marketType, setMarketType] = useState<MarketType>('FUTURES');
  const [timeframe, setTimeframe] = useState<TimeInterval>('12h');
  const [count, setCount] = useState(20);

  const { startWatchersBulk, isStartingWatchersBulk } = useBackendAutoTrading(walletId);

  const utils = trpc.useUtils();

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId }
  );

  const updateConfig = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => void utils.autoTrading.getConfig.invalidate(),
  });

  const directionMode: DirectionMode = (config?.directionMode as DirectionMode) ?? 'auto';

  const handleDirectionModeChange = (mode: DirectionMode) => {
    if (!walletId) return;
    updateConfig.mutate({ walletId, directionMode: mode });
  };

  const useTrendFilter = config?.useTrendFilter ?? true;
  const debouncedCount = useDebounce(count, 500);

  const {
    filteredSymbols,
    maxAffordableWatchers: filteredMaxAffordable,
    isLoadingFiltered,
    skippedTrend,
  } = useFilteredSymbolsForQuickStart(walletId, marketType, timeframe, debouncedCount, useTrendFilter);

  const maxAffordableWatchers = filteredMaxAffordable ?? AUTO_TRADING_CONFIG.TARGET_COUNT.MAX;
  const effectiveMax = Math.min(maxAffordableWatchers, AUTO_TRADING_CONFIG.TARGET_COUNT.MAX);

  const { formatCapitalTooltip } = useCapitalLimits(walletId, marketType);

  const { data: btcTrendStatus } = trpc.autoTrading.getBtcTrendStatus.useQuery(
    { interval: timeframe },
    {
      enabled: config?.useBtcCorrelationFilter === true,
      staleTime: 60000,
    }
  );

  const { data: fundingRates } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: filteredSymbols },
    {
      enabled: marketType === 'FUTURES' && config?.useFundingFilter === true && filteredSymbols.length > 0,
      staleTime: 60000,
    }
  );

  const finalFilteredSymbols = useMemo(() => {
    const extremeSymbols = new Set(
      marketType === 'FUTURES' && config?.useFundingFilter && fundingRates
        ? fundingRates.filter((f) => f.isExtreme).map((f) => f.symbol)
        : []
    );
    return filteredSymbols.filter(symbol => !extremeSymbols.has(symbol));
  }, [filteredSymbols, fundingRates, config?.useFundingFilter, marketType]);

  const showBtcTrend = useTrendFilter || config?.useBtcCorrelationFilter === true;

  const handleQuickStart = async (): Promise<void> => {
    if (!walletId || finalFilteredSymbols.length === 0) return;
    await startWatchersBulk(finalFilteredSymbols, timeframe, undefined, marketType, count);
    onClose();
  };

  const handleOpenSettings = (): void => {
    globalActions?.openSettings?.();
    onClose();
  };

  if (!walletId) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
            <Dialog.Header borderBottom="1px solid" borderColor="border">
              <Dialog.Title>{t('marketSidebar.watchers.startWatchers')}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
                <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
                  {t('trading.portfolio.noWallet')}
                </Text>
              </Box>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>{t('marketSidebar.watchers.startWatchers')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body py={6}>
            <Stack gap={4}>
              <Box p={4} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200" _dark={{ bg: 'green.900/20', borderColor: 'green.800' }}>
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('tradingProfiles.dynamicSelection.quickStartTitle')}
                  </Text>
                  <DirectionBadge
                    directionMode={directionMode}
                    btcTrendStatus={btcTrendStatus}
                    showBtcTrend={showBtcTrend}
                    skippedTrendCount={skippedTrend.length}
                  />
                </Flex>

                <Stack gap={3}>
                  <Flex gap={3} align="center" wrap="wrap">
                    <Group attached flex="0 0 180px">
                      <Button
                        size="sm"
                        variant={marketType === 'SPOT' ? 'solid' : 'outline'}
                        onClick={() => setMarketType('SPOT')}
                        flex={1}
                      >
                        Spot
                      </Button>
                      <Button
                        size="sm"
                        variant={marketType === 'FUTURES' ? 'solid' : 'outline'}
                        onClick={() => setMarketType('FUTURES')}
                        flex={1}
                      >
                        Futures
                      </Button>
                    </Group>
                    <Box>
                      <TimeframeSelector
                        selectedTimeframe={timeframe}
                        onTimeframeChange={setTimeframe}
                      />
                    </Box>
                    <Flex align="center" gap={2}>
                      <Box flex="0 0 70px">
                        <NumberInput
                          min={AUTO_TRADING_CONFIG.TARGET_COUNT.MIN}
                          max={effectiveMax}
                          value={count}
                          onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                          size="sm"
                          px={3}
                        />
                      </Box>
                      <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" title={formatCapitalTooltip()}>
                        / {isLoadingFiltered ? '...' : effectiveMax} max
                      </Text>
                    </Flex>
                  </Flex>

                  <HStack gap={1}>
                    <Button
                      size="xs"
                      variant={directionMode === 'short_only' ? 'solid' : 'outline'}
                      colorPalette={directionMode === 'short_only' ? 'red' : 'gray'}
                      onClick={() => handleDirectionModeChange(directionMode === 'short_only' ? 'auto' : 'short_only')}
                      disabled={updateConfig.isPending}
                      flex={1}
                    >
                      <LuTrendingDown />
                      {t('settings.algorithmicAutoTrading.directionMode.shortOnly')}
                    </Button>
                    <Button
                      size="xs"
                      variant={directionMode === 'auto' ? 'solid' : 'outline'}
                      colorPalette={directionMode === 'auto' ? 'gray' : 'gray'}
                      onClick={() => handleDirectionModeChange('auto')}
                      disabled={updateConfig.isPending}
                      flex={1}
                    >
                      <LuArrowUpDown />
                      {t('settings.algorithmicAutoTrading.directionMode.auto')}
                    </Button>
                    <Button
                      size="xs"
                      variant={directionMode === 'long_only' ? 'solid' : 'outline'}
                      colorPalette={directionMode === 'long_only' ? 'green' : 'gray'}
                      onClick={() => handleDirectionModeChange(directionMode === 'long_only' ? 'auto' : 'long_only')}
                      disabled={updateConfig.isPending}
                      flex={1}
                    >
                      <LuTrendingUp />
                      {t('settings.algorithmicAutoTrading.directionMode.longOnly')}
                    </Button>
                  </HStack>

                  <Text fontSize="sm" color="fg.muted">
                    {effectiveMax === 0
                      ? t('tradingProfiles.dynamicSelection.insufficientCapital')
                      : t('tradingProfiles.dynamicSelection.quickStartDescription')}
                  </Text>
                </Stack>
              </Box>

              <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900/20' }}>
                <Text fontSize="xs" color="fg.muted">
                  {t('tradingProfiles.dynamicSelection.infoText')}
                </Text>
              </Box>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer borderTop="1px solid" borderColor="border" gap={2}>
            <Button variant="ghost" onClick={handleOpenSettings} size="sm">
              <LuSettings />
              {t('header.settings')}
            </Button>
            <Box flex={1} />
            <Button variant="outline" onClick={onClose} size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              colorPalette="green"
              onClick={() => void handleQuickStart()}
              loading={isStartingWatchersBulk}
              disabled={isLoadingFiltered || finalFilteredSymbols.length === 0 || effectiveMax === 0}
              size="sm"
            >
              <LuPlay />
              {t('tradingProfiles.dynamicSelection.quickStartButton', { count: Math.min(count, effectiveMax) })}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
});

StartWatchersModal.displayName = 'StartWatchersModal';
